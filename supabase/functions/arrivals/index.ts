/**
 * GET /functions/v1/arrivals?stop=2277
 *
 * Próximas llegadas a una parada de la EMT, en JSON. Hace de proxy hacia el
 * endpoint que usa la web de la EMT (no es una API oficial) y cachea cada
 * parada unos segundos para no repetir llamadas si muchos usuarios miran la misma.
 *
 * ⚠️ A 10/10/2026 la EMT descarta las conexiones desde IPs de AWS (donde corre
 * Supabase), así que aquí responde 502. La app nativa no pasa por esta función.
 */
import { fetchEmtArrivals, type ParseResult } from '../_shared/emt.ts';

const USER_AGENT = 'TransportCity/0.1 (+https://github.com/transportcity)';

const CACHE_TTL_MS = 20_000;
const FETCH_TIMEOUT_MS = 8_000;

type Payload = ParseResult & { stopId: string; fetchedAt: string };

// Caché en memoria por instancia: suficiente mientras la función está caliente.
const cache = new Map<string, { at: number; payload: Payload }>();
// Peticiones en vuelo: si llegan varias a la vez para la misma parada, se comparte una.
const inflight = new Map<string, Promise<Payload>>();

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', ...extra },
  });
}

async function load(stopId: string): Promise<Payload> {
  const result = await fetchEmtArrivals(stopId, { userAgent: USER_AGENT, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  return { ...result, stopId, fetchedAt: new Date().toISOString() };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);

  const stopId = new URL(req.url).searchParams.get('stop')?.trim() ?? '';
  if (!/^\d{1,5}$/.test(stopId)) return json({ error: 'invalid_stop', message: 'Usa ?stop=<número de parada>' }, 400);

  const hit = cache.get(stopId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return json({ ...hit.payload, cached: true }, 200, { 'Cache-Control': 'public, max-age=10' });
  }

  try {
    let pending = inflight.get(stopId);
    if (!pending) {
      pending = load(stopId).finally(() => inflight.delete(stopId));
      inflight.set(stopId, pending);
    }
    const payload = await pending;
    // No cacheamos los "no disponible": que el siguiente intento vuelva a preguntar.
    if (payload.status !== 'unavailable') cache.set(stopId, { at: Date.now(), payload });
    return json({ ...payload, cached: false }, 200, { 'Cache-Control': 'public, max-age=10' });
  } catch (err) {
    console.error('arrivals', stopId, err);
    // Si la EMT falla pero tenemos un dato reciente (< 2 min), mejor algo que nada.
    if (hit && Date.now() - hit.at < 120_000) return json({ ...hit.payload, cached: true, stale: true });
    return json({ error: 'upstream_error', message: 'La EMT no responde ahora mismo' }, 502);
  }
});
