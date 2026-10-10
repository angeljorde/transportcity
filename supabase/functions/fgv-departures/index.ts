/**
 * GET /functions/v1/fgv-departures?station=24
 *
 * Próximas salidas de Metrovalencia/TRAM en una estación, en JSON. El geoportal del
 * Ajuntament sí responde desde Supabase (a diferencia de la web de la EMT).
 */
import { FGV_DEPARTURES_URL, parseFgvDepartures, type Departure } from '../_shared/fgv.ts';

const CACHE_TTL_MS = 20_000;
const FETCH_TIMEOUT_MS = 8_000;

type Payload = { stationId: string; status: 'ok' | 'empty'; departures: Departure[]; fetchedAt: string };

const cache = new Map<string, { at: number; html: string }>();
const inflight = new Map<string, Promise<string>>();

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=10' },
  });

class UnknownStation extends Error {}

async function fetchHtml(stationId: string): Promise<string> {
  const url = `${FGV_DEPARTURES_URL}?estacion=${encodeURIComponent(stationId)}&lang=es`;
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { 'User-Agent': 'TransportCity/0.1' } });
  // El geoportal responde 500 a estaciones que no existen.
  if (res.status === 500) throw new UnknownStation();
  if (!res.ok) throw new Error(`geoportal HTTP ${res.status}`);
  return await res.text();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);

  const stationId = new URL(req.url).searchParams.get('station')?.trim() ?? '';
  if (!/^\d{1,4}$/.test(stationId)) return json({ error: 'invalid_station', message: 'Usa ?station=<código de estación>' }, 400);

  try {
    // Cacheamos el HTML (no los minutos): así los minutos se recalculan en cada respuesta.
    let html = cache.get(stationId);
    if (!html || Date.now() - html.at > CACHE_TTL_MS) {
      let pending = inflight.get(stationId);
      if (!pending) {
        pending = fetchHtml(stationId).finally(() => inflight.delete(stationId));
        inflight.set(stationId, pending);
      }
      html = { at: Date.now(), html: await pending };
      cache.set(stationId, html);
    }
    const departures = parseFgvDepartures(html.html);
    const payload: Payload = {
      stationId,
      status: departures.length ? 'ok' : 'empty',
      departures,
      fetchedAt: new Date(html.at).toISOString(),
    };
    return json(payload);
  } catch (err) {
    if (err instanceof UnknownStation) return json({ error: 'unknown_station', message: 'Estación desconocida' }, 404);
    console.error('fgv-departures', stationId, err);
    return json({ error: 'upstream_error', message: 'FGV no responde ahora mismo' }, 502);
  }
});
