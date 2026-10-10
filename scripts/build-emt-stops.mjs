#!/usr/bin/env node
/**
 * Descarga el GTFS de la EMT desde el CKAN del Ajuntament y genera
 * `src/data/emt-stops.json` y `src/data/emt-routes.json`.
 *
 * Uso: npm run data:emt
 *
 * Temporal: cuando exista la Edge Function `ingest-gtfs`, la app leerá las
 * paradas de Supabase/PostGIS y este JSON quedará solo como fallback offline.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';

import { decode, lineOrder, linesByStop, parseCsv, titleCase } from './lib/gtfs.mjs';

const CKAN = 'https://opendata.vlci.valencia.es/api/3/action/package_show?id=google-transit-lines-stops-bus-schedules';
const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data');

async function main() {
  console.log('→ Resolviendo URL del GTFS en CKAN…');
  const meta = await (await fetch(CKAN)).json();
  const resource = meta.result.resources.find((r) => /zip/i.test(r.format)) ?? meta.result.resources[0];
  console.log(`  ${resource.url}`);

  console.log('→ Descargando…');
  const zipBuf = new Uint8Array(await (await fetch(resource.url)).arrayBuffer());
  const files = unzipSync(zipBuf, { filter: (f) => ['stops.txt', 'routes.txt', 'trips.txt', 'stop_times.txt', 'feed_info.txt'].includes(f.name) });
  const read = (name) => parseCsv(decode(files[name]));

  const routes = read('routes.txt');
  const trips = read('trips.txt');
  const stops = read('stops.txt');
  console.log(`  ${routes.length} rutas, ${trips.length} viajes, ${stops.length} paradas`);

  const routeById = new Map(routes.map((r) => [r.route_id, r]));
  const lineByTrip = new Map(trips.map((t) => [t.trip_id, routeById.get(t.route_id)?.route_short_name]));

  console.log('→ Cruzando stop_times…');
  const linesByStopId = linesByStop(decode(files['stop_times.txt']), lineByTrip);

  const outStops = stops
    .filter((s) => s.location_type === '' || s.location_type === '0')
    .map((s) => ({
      id: s.stop_id,
      name: s.stop_name.replace(/\s{2,}/g, ' '),
      lat: Number(Number(s.stop_lat).toFixed(6)),
      lon: Number(Number(s.stop_lon).toFixed(6)),
      lines: [...(linesByStopId.get(s.stop_id) ?? [])].sort(lineOrder),
    }))
    .filter((s) => s.lines.length > 0)
    .sort((a, b) => Number(a.id) - Number(b.id));

  // Una misma línea puede tener varios route_id (variantes): nos quedamos con uno por línea.
  const routeByLine = new Map();
  for (const r of routes) {
    if (routeByLine.has(r.route_short_name)) continue;
    const long = r.route_long_name.replace(new RegExp(`^${r.route_short_name}\\s*-\\s*`), '').replace(/\s{2,}/g, ' ');
    routeByLine.set(r.route_short_name, { id: r.route_id, line: r.route_short_name, name: titleCase(long), color: `#${r.route_color || 'E30613'}` });
  }
  const outRoutes = [...routeByLine.values()].sort((a, b) => lineOrder(a.line, b.line));

  const feedVersion = files['feed_info.txt'] ? read('feed_info.txt')[0]?.feed_version : undefined;
  const generatedAt = new Date().toISOString();

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(resolve(OUT_DIR, 'emt-stops.json'), JSON.stringify({ source: resource.url, feedVersion, generatedAt, stops: outStops }));
  await writeFile(resolve(OUT_DIR, 'emt-routes.json'), JSON.stringify({ source: resource.url, feedVersion, generatedAt, routes: outRoutes }, null, 2));
  console.log(`✓ ${outStops.length} paradas con servicio y ${outRoutes.length} líneas → src/data/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
