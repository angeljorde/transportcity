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

const CKAN = 'https://opendata.vlci.valencia.es/api/3/action/package_show?id=google-transit-lines-stops-bus-schedules';
const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data');

// El GTFS de EMT mezcla codificaciones por fichero (stops.txt en UTF-8,
// routes.txt en Latin-1): probamos UTF-8 estricto y si falla, Latin-1.
const utf8 = new TextDecoder('utf-8', { fatal: true });
const latin1 = new TextDecoder('latin1');
const decode = (buf) => {
  try {
    return utf8.decode(buf);
  } catch {
    return latin1.decode(buf);
  }
};

/** CSV mínimo para GTFS: soporta comillas y comas dentro de campos. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field.trim()); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field.trim()); field = '';
      if (row.length > 1 || row[0]) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field || row.length) { row.push(field.trim()); rows.push(row); }
  const [header, ...body] = rows;
  const keys = header.map((h) => h.replace(/^﻿/, ''));
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? ''])));
}

/** Orden natural de líneas: 1, 2, 10, 99, C1, N1… */
const lineOrder = (a, b) => {
  const na = Number(a), nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  if (!Number.isNaN(na)) return -1;
  if (!Number.isNaN(nb)) return 1;
  return a.localeCompare(b, 'es', { numeric: true });
};

/** "PL. DE L'AJUNTAMENT" → "Pl. de l'Ajuntament" (route_long_name viene en mayúsculas). */
function titleCase(s) {
  const small = new Set(['de', 'del', 'la', 'les', 'el', 'els', 'i', 'y', 'a']);
  return s
    .toLowerCase()
    .replace(/(^|[\s\-/(])([\p{L}])/gu, (_, p, ch) => p + ch.toUpperCase())
    .replace(/\b(De|Del|La|Les|El|Els|I|Y|A)\b/g, (w, _m, off) => (off === 0 ? w : small.has(w.toLowerCase()) ? w.toLowerCase() : w))
    .replace(/\bL'(\p{L})/gu, (_, ch) => `l'${ch.toUpperCase()}`)
    .replace(/\bD'(\p{L})/gu, (_, ch) => `d'${ch.toUpperCase()}`);
}

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

  // stop_times es grande (~800k filas): lo recorremos a mano sin construir objetos.
  console.log('→ Cruzando stop_times…');
  const linesByStop = new Map();
  const st = decode(files["stop_times.txt"]).split(/\r?\n/);
  const head = st[0].replace(/^﻿/, '').split(',');
  const iTrip = head.indexOf('trip_id');
  const iStop = head.indexOf('stop_id');
  for (let i = 1; i < st.length; i++) {
    if (!st[i]) continue;
    const cols = st[i].split(',');
    const line = lineByTrip.get(cols[iTrip]);
    if (!line) continue;
    const stopId = cols[iStop];
    let set = linesByStop.get(stopId);
    if (!set) linesByStop.set(stopId, (set = new Set()));
    set.add(line);
  }

  const outStops = stops
    .filter((s) => s.location_type === '' || s.location_type === '0')
    .map((s) => ({
      id: s.stop_id,
      name: s.stop_name.replace(/\s{2,}/g, ' '),
      lat: Number(Number(s.stop_lat).toFixed(6)),
      lon: Number(Number(s.stop_lon).toFixed(6)),
      lines: [...(linesByStop.get(s.stop_id) ?? [])].sort(lineOrder),
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
