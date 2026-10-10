/**
 * Próximas salidas de Metrovalencia/TRAM desde el geoportal del Ajuntament:
 *
 *   GET https://geoportal.valencia.es/geoportal-services/api/v1/salidas-metro.html?estacion=24&lang=es
 *
 *   <img src="/geoportal-services/images/linea_metro_2.png" title="1" …>
 *   <span>2 - Paterna - Torrent Avinguda</span>, <span>Destino</span> <b>Paterna</b> - <span>19:32:00</span>
 *
 * Ojo: el `title` de la imagen no es fiable (pone "1" en trenes de la línea 2); la línea
 * se toma del texto de la ruta. Cada tren aparece una vez por variante de ruta: deduplicamos.
 */
import { secondsUntil } from './time.ts';

export const FGV_DEPARTURES_URL = 'https://geoportal.valencia.es/geoportal-services/api/v1/salidas-metro.html';

export type Departure = {
  line: string;
  destination: string;
  /** Hora de salida "HH:MM" (hora de Madrid). */
  time: string;
  /** Minutos que faltan en el momento de la consulta (0 = sale ya). */
  minutes: number | null;
};

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

export function parseFgvDepartures(html: string, now = new Date()): Departure[] {
  const re = /<span>([^<]*)<\/span>\s*,\s*<span>\s*Destino\s*<\/span>\s*<b>([^<]*)<\/b>\s*-\s*<span>(\d{1,2}):(\d{2})(?::(\d{2}))?<\/span>/g;
  const seen = new Set<string>();
  const out: Departure[] = [];
  for (const [, route, dest, hh, mm, ss] of html.matchAll(re)) {
    const line = decode(route).match(/^(\d+)/)?.[1] ?? '?';
    const destination = decode(dest);
    const time = `${hh.padStart(2, '0')}:${mm}`;
    const key = `${line}|${destination}|${time}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const secs = secondsUntil(Number(hh), Number(mm), Number(ss ?? 0), now);
    // Trenes que ya salieron (más de 1 min) fuera.
    if (secs != null && secs < -60) continue;
    out.push({ line, destination, time, minutes: secs == null ? null : Math.max(0, Math.floor(secs / 60)) });
  }
  return out.sort((a, b) => (a.minutes ?? 9999) - (b.minutes ?? 9999));
}
