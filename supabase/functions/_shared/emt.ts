/**
 * Llegadas en tiempo real de la EMT: petición + parser del fragmento HTML de busca_parada.php:
 *
 *   <span class="imagenParada"><img src="…/62bigW.gif" title="62" …></span>
 *   <span class="llegadaHome">&nbsp;&nbsp;Benimàmet - 2 min.</span><br>
 *
 * Código compartido sin dependencias: lo usan la Edge Function `arrivals` (Deno) y la
 * app nativa, que llama a la EMT directamente porque la EMT bloquea las IPs de la nube.
 */

export const EMT_ARRIVALS_URL = 'https://www.emtvalencia.es/ciudadano/modules/mod_tiempo/busca_parada.php';
// La EMT exige este Referer: sin él responde "Temporalmente no disponible".
export const EMT_REFERER = 'https://www.emtvalencia.es/ciudadano/index.php';

export type Arrival = {
  line: string;
  destination: string;
  /** 0 = "Próximo"; null si la EMT da un texto que no sabemos convertir. */
  minutes: number | null;
  raw: string;
};

export type ParseResult =
  | { status: 'ok'; arrivals: Arrival[] }
  | { status: 'empty'; arrivals: [] }
  | { status: 'unavailable'; arrivals: [] };

const ENTITIES: Record<string, string> = { nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' };

function decodeEntities(s: string): string {
  return s.replace(/&(#\d+|#x[\da-f]+|\w+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Minutos que faltan para `hh:mm` en hora de Madrid. */
function minutesUntil(hh: number, mm: number, now: Date): number | null {
  if (typeof Intl === 'undefined' || !Intl.DateTimeFormat.prototype.formatToParts) return null;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, p) => ((acc[p.type] = p.value), acc), {});
  const nowMin = Number(parts.hour) * 60 + Number(parts.minute);
  let diff = hh * 60 + mm - nowMin;
  if (diff < -60) diff += 24 * 60; // pasa de medianoche
  return Math.max(0, diff);
}

export function parseValue(value: string, now = new Date()): number | null {
  const v = value.trim();
  if (/^pr[oó]xim/i.test(v)) return 0;
  const min = v.match(/(\d+)\s*min/i);
  if (min) return Number(min[1]);
  const hhmm = v.match(/^(\d{1,2}):(\d{2})/);
  if (hhmm) return minutesUntil(Number(hhmm[1]), Number(hhmm[2]), now);
  return null;
}

export function parseArrivals(html: string, now = new Date()): ParseResult {
  if (!html.trim()) return { status: 'empty', arrivals: [] };
  if (/temporalmente no disponible/i.test(html)) return { status: 'unavailable', arrivals: [] };

  const arrivals: Arrival[] = [];
  const re = /title="([^"]*)"[\s\S]*?class="llegadaHome">([\s\S]*?)<\/span>/g;
  for (const [, line, body] of html.matchAll(re)) {
    const text = decodeEntities(body.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
    const sep = text.lastIndexOf(' - ');
    const destination = sep >= 0 ? text.slice(0, sep).trim() : text;
    const value = sep >= 0 ? text.slice(sep + 3) : '';
    arrivals.push({ line: decodeEntities(line).trim(), destination, minutes: parseValue(value, now), raw: value.trim() });
  }

  if (arrivals.length === 0) return { status: 'empty', arrivals: [] };
  arrivals.sort((a, b) => (a.minutes ?? 999) - (b.minutes ?? 999));
  return { status: 'ok', arrivals };
}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

/** Pide a la EMT las llegadas de una parada; reintenta una vez si responde "no disponible". */
export async function fetchEmtArrivals(
  stopId: string,
  { fetchFn = fetch as unknown as FetchLike, signal, userAgent }: { fetchFn?: FetchLike; signal?: AbortSignal; userAgent?: string } = {},
): Promise<ParseResult> {
  const call = async () => {
    const res = await fetchFn(EMT_ARRIVALS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: EMT_REFERER,
        ...(userAgent ? { 'User-Agent': userAgent } : {}),
      },
      body: `parada=${encodeURIComponent(stopId)}&adaptados=0&idioma=es&usuario=Anonimo`,
      signal,
    });
    if (!res.ok) throw new Error(`EMT HTTP ${res.status}`);
    return parseArrivals(await res.text());
  };
  const first = await call();
  if (first.status !== 'unavailable') return first;
  await new Promise((r) => setTimeout(r, 400));
  return call();
}
