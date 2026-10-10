#!/usr/bin/env node
/**
 * Descarga el GTFS de FGV (Metrovalencia + TRAM) y genera `src/data/fgv-stations.json`
 * con las estaciones, las líneas que pasan por cada una y los metadatos de cada línea.
 *
 * Uso: npm run data:fgv
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';

import { decode, lineOrder, linesByStop, parseCsv } from './lib/gtfs.mjs';

const GTFS_URL = 'https://www.metrovalencia.es/google_transit_feed/google_transit.zip';
const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data');

// El GTFS trae varios colores por línea (uno por variante); usamos los del plano oficial.
// Las líneas 4, 6, 8 y 10 son tranvía; el resto, metro.
const LINES = {
  1: { mode: 'metro', color: '#F2C200' },
  2: { mode: 'metro', color: '#D7348A' },
  3: { mode: 'metro', color: '#D2232A' },
  4: { mode: 'tram', color: '#1B8A3E' },
  5: { mode: 'metro', color: '#00905F' },
  6: { mode: 'tram', color: '#7D4E9F' },
  7: { mode: 'metro', color: '#F08A00' },
  8: { mode: 'tram', color: '#1FA2DD' },
  9: { mode: 'metro', color: '#A57B3D' },
  10: { mode: 'tram', color: '#8DC63F' },
};

async function main() {
  console.log(`→ Descargando ${GTFS_URL}…`);
  const zip = new Uint8Array(await (await fetch(GTFS_URL)).arrayBuffer());
  const files = unzipSync(zip, { filter: (f) => ['stops.txt', 'routes.txt', 'trips.txt', 'stop_times.txt'].includes(f.name) });
  const read = (n) => parseCsv(decode(files[n]));

  const routes = read('routes.txt');
  const trips = read('trips.txt');
  const stops = read('stops.txt');
  console.log(`  ${routes.length} variantes de ruta, ${trips.length} viajes, ${stops.length} estaciones`);

  const routeById = new Map(routes.map((r) => [r.route_id, r]));
  const lineByTrip = new Map(trips.map((t) => [t.trip_id, routeById.get(t.route_id)?.route_short_name]));
  const lines = linesByStop(decode(files['stop_times.txt']), lineByTrip);

  // Nombre de cada línea: el de su variante con más viajes ("1 - Bétera - Castelló" → "Bétera - Castelló").
  const tripsPerRoute = new Map();
  for (const t of trips) tripsPerRoute.set(t.route_id, (tripsPerRoute.get(t.route_id) ?? 0) + 1);
  const best = new Map();
  for (const r of routes) {
    const n = tripsPerRoute.get(r.route_id) ?? 0;
    if (n > (best.get(r.route_short_name)?.n ?? -1)) best.set(r.route_short_name, { n, name: r.route_long_name.replace(/^\d+\s*-\s*/, '') });
  }

  const outLines = Object.entries(LINES)
    .map(([line, meta]) => ({ line, ...meta, name: best.get(line)?.name ?? `Línea ${line}` }))
    .sort((a, b) => lineOrder(a.line, b.line));

  const outStations = stops
    .map((s) => ({
      id: s.stop_id,
      name: s.stop_name,
      lat: Number(Number(s.stop_lat).toFixed(6)),
      lon: Number(Number(s.stop_lon).toFixed(6)),
      lines: [...(lines.get(s.stop_id) ?? [])].filter((l) => LINES[l]).sort(lineOrder),
    }))
    .filter((s) => s.lines.length > 0)
    .sort((a, b) => Number(a.id) - Number(b.id));

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(
    resolve(OUT_DIR, 'fgv-stations.json'),
    JSON.stringify({ source: GTFS_URL, generatedAt: new Date().toISOString(), lines: outLines, stations: outStations }),
  );
  console.log(`✓ ${outStations.length} estaciones y ${outLines.length} líneas → src/data/fgv-stations.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
