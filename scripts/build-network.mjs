#!/usr/bin/env node
/**
 * Genera `src/data/network.json`: la red que usa el planificador de rutas de la app.
 *
 * Para cada "patrón" (línea + secuencia exacta de paradas) guarda:
 *   - las paradas en orden y el tiempo acumulado desde la primera (mediana de los viajes),
 *   - el trazado simplificado (shape) y en qué punto del trazado cae cada parada,
 *   - cuántos viajes salen por hora en un día laborable, sábado y domingo de referencia
 *     (de ahí sale la frecuencia y si la línea funciona a esa hora).
 *
 * Uso: npm run data:network
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';

import { decode, parseCsv } from './lib/gtfs.mjs';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/network.json');
const EMT_CKAN = 'https://opendata.vlci.valencia.es/api/3/action/package_show?id=google-transit-lines-stops-bus-schedules';
const FGV_URL = 'https://www.metrovalencia.es/google_transit_feed/google_transit.zip';

/** Variantes con menos viajes que esto (respecto al total de la línea) se descartan como ruido. */
const MIN_PATTERN_SHARE = 0.05;
const MIN_PATTERN_TRIPS = 8;
/** Tolerancia de simplificación del trazado, en grados (~8 m). */
const SIMPLIFY_TOLERANCE = 0.00008;
/** Cuántos vértices por delante se buscan al encajar cada parada en el trazado. */
const SNAP_WINDOW = 40;

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function emtUrl() {
  const meta = await (await fetch(EMT_CKAN)).json();
  return (meta.result.resources.find((r) => /zip/i.test(r.format)) ?? meta.result.resources[0]).url;
}

// ---------- calendario ----------

const ymd = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
const DAY_COLS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** Próximo miércoles, sábado y domingo (a partir de mañana): días "tipo" sin sorpresas de hoy. */
function referenceDates() {
  const out = {};
  const want = { wk: 3, sa: 6, su: 0 };
  for (const [key, dow] of Object.entries(want)) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    while (d.getDay() !== dow) d.setDate(d.getDate() + 1);
    out[key] = d;
  }
  return out;
}

function activeServices(calendar, calendarDates, date) {
  const day = ymd(date);
  const col = DAY_COLS[date.getDay()];
  const active = new Set(
    calendar.filter((c) => c[col] === '1' && c.start_date <= day && day <= c.end_date).map((c) => c.service_id),
  );
  for (const cd of calendarDates) {
    if (cd.date !== day) continue;
    if (cd.exception_type === '1') active.add(cd.service_id);
    if (cd.exception_type === '2') active.delete(cd.service_id);
  }
  return active;
}

// ---------- geometría ----------

function simplify(points, tol) {
  if (points.length <= 2) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [x1, y1] = points[a];
    const [x2, y2] = points[b];
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy || 1e-12;
    let maxD = 0, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const [x, y] = points[i];
      const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len2));
      const ex = x1 + t * dx - x, ey = y1 + t * dy - y;
      const d = ex * ex + ey * ey;
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (idx >= 0 && maxD > tol * tol) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Índice del punto del trazado más cercano a cada parada, avanzando siempre (soporta lazos). */
function snapStops(shape, coords) {
  const out = [];
  let from = 0;
  for (const [lon, lat] of coords) {
    let best = from, bestD = Infinity;
    // Ventana hacia delante: evita "saltar" a la otra mitad de una línea circular.
    for (let i = from; i < Math.min(shape.length, from + SNAP_WINDOW); i++) {
      const d = (shape[i][0] - lon) ** 2 + (shape[i][1] - lat) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    out.push(best);
    from = best;
  }
  return out;
}

const r5 = (n) => Math.round(n * 1e5) / 1e5;
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};
const toSec = (t) => {
  const [h, m, s] = t.split(':').map(Number);
  return h * 3600 + m * 60 + (s || 0);
};

// ---------- un feed ----------

function buildFeed(op, zip) {
  const files = unzipSync(zip, {
    filter: (f) => ['stops.txt', 'routes.txt', 'trips.txt', 'stop_times.txt', 'shapes.txt', 'calendar.txt', 'calendar_dates.txt'].includes(f.name),
  });
  const read = (n) => (files[n] ? parseCsv(decode(files[n])) : []);
  const routes = new Map(read('routes.txt').map((r) => [r.route_id, r]));
  const trips = new Map(read('trips.txt').map((t) => [t.trip_id, t]));
  const stops = new Map(read('stops.txt').map((s) => [s.stop_id, [Number(s.stop_lon), Number(s.stop_lat)]]));
  const calendar = read('calendar.txt');
  const calendarDates = read('calendar_dates.txt');

  const refs = referenceDates();
  const services = Object.fromEntries(Object.entries(refs).map(([k, d]) => [k, activeServices(calendar, calendarDates, d)]));

  // stop_times → viajes [ [seq, stopId, sec] ] (a mano: son cientos de miles de filas)
  const lines = decode(files['stop_times.txt']).split(/\r?\n/);
  const head = lines[0].replace(/^﻿/, '').split(',').map((h) => h.trim());
  const iT = head.indexOf('trip_id'), iS = head.indexOf('stop_id'), iQ = head.indexOf('stop_sequence'), iD = head.indexOf('departure_time');
  const byTrip = new Map();
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const c = lines[i].split(',');
    const tid = c[iT].trim();
    let arr = byTrip.get(tid);
    if (!arr) byTrip.set(tid, (arr = []));
    arr.push([Number(c[iQ]), c[iS].trim(), toSec(c[iD].trim())]);
  }

  // Agrupa viajes por patrón (línea + secuencia de paradas)
  const patterns = new Map();
  const tripsPerLine = new Map();
  for (const [tid, st] of byTrip) {
    const trip = trips.get(tid);
    const route = trip && routes.get(trip.route_id);
    if (!route) continue;
    st.sort((a, b) => a[0] - b[0]);
    const line = route.route_short_name;
    const key = `${line}|${st.map((x) => x[1]).join('>')}`;
    let p = patterns.get(key);
    if (!p) patterns.set(key, (p = { line, stops: st.map((x) => x[1]), trips: [] }));
    p.trips.push({ trip, st });
    tripsPerLine.set(line, (tripsPerLine.get(line) ?? 0) + 1);
  }

  // Trazados
  const shapePts = new Map();
  for (const s of read('shapes.txt')) {
    let arr = shapePts.get(s.shape_id);
    if (!arr) shapePts.set(s.shape_id, (arr = []));
    arr.push([Number(s.shape_pt_sequence), Number(s.shape_pt_lon), Number(s.shape_pt_lat)]);
  }
  for (const arr of shapePts.values()) arr.sort((a, b) => a[0] - b[0]);

  const out = [];
  let n = 0;
  for (const p of patterns.values()) {
    const total = tripsPerLine.get(p.line);
    if (p.trips.length < MIN_PATTERN_TRIPS && p.trips.length / total < MIN_PATTERN_SHARE) continue;
    if (p.stops.length < 2 || p.stops.some((s) => !stops.has(s))) continue;

    // Tiempo acumulado (min) desde la primera parada: mediana sobre los viajes
    const t = p.stops.map((_, i) => Math.round(median(p.trips.map(({ st }) => st[i][2] - st[0][2])) / 6) / 10);

    // Salidas por hora en cada día de referencia
    const hw = {};
    for (const [k, active] of Object.entries(services)) {
      const counts = new Array(24).fill(0);
      for (const { trip, st } of p.trips) if (active.has(trip.service_id)) counts[Math.floor(st[0][2] / 3600) % 24]++;
      hw[k] = counts;
    }
    if (Object.values(hw).every((c) => c.every((x) => x === 0))) continue; // no circula en ningún día tipo

    // Trazado más común entre los viajes del patrón; si no hay, línea recta entre paradas
    const shapeId = mode(p.trips.map(({ trip }) => trip.shape_id));
    const coords = p.stops.map((s) => stops.get(s));
    const raw = shapePts.get(shapeId)?.map(([, lon, lat]) => [lon, lat]);
    const shape = simplify(raw && raw.length > 1 ? raw : coords, SIMPLIFY_TOLERANCE).map(([lon, lat]) => [r5(lon), r5(lat)]);

    out.push({
      id: `${op}-${p.line}-${n++}`,
      op,
      line: p.line,
      headsign: mode(p.trips.map(({ trip }) => trip.trip_headsign).filter(Boolean)) ?? '',
      stops: p.stops,
      t,
      shape,
      si: snapStops(shape, coords),
      hw,
    });
  }
  return out;
}

function mode(xs) {
  const c = new Map();
  for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1);
  let best, bestN = -1;
  for (const [x, n] of c) if (n > bestN) { best = x; bestN = n; }
  return best;
}

async function main() {
  const emt = await emtUrl();
  console.log('→ Descargando GTFS de EMT y FGV…');
  const [emtZip, fgvZip] = await Promise.all([download(emt), download(FGV_URL)]);
  console.log('→ Construyendo patrones…');
  const patterns = [...buildFeed('emt', emtZip), ...buildFeed('fgv', fgvZip)];
  const refs = Object.fromEntries(Object.entries(referenceDates()).map(([k, d]) => [k, ymd(d)]));
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), referenceDates: refs, patterns }));
  const byOp = (op) => patterns.filter((p) => p.op === op).length;
  console.log(`✓ ${patterns.length} patrones (EMT ${byOp('emt')}, FGV ${byOp('fgv')}) → src/data/network.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
