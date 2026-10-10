/**
 * Planificador de rutas en el propio dispositivo (sin servidor).
 *
 * Busca itinerarios de a pie + bus/metro/tranvía con hasta un transbordo sobre la red
 * de `network.json` (patrones GTFS con tiempos entre paradas y salidas por hora).
 * La espera se estima con la frecuencia real de esa hora (mitad del intervalo); luego
 * `live-leg.ts` la sustituye por la llegada en tiempo real del primer vehículo.
 *
 * Es una versión acotada de RAPTOR: dos rondas, con lo mejor por destino precalculado
 * por patrón para que la segunda ronda sea O(1) por combinación.
 */
import networkJson from '@/data/network.json';
import { placeByKey, places } from '@/data/places';

import { madridSecondsOfDay } from '../../supabase/functions/_shared/time';
import { distance, type LngLat } from './geo';

export type Op = 'emt' | 'fgv';
type DayType = 'wk' | 'sa' | 'su';

export type Pattern = {
  id: string;
  op: Op;
  line: string;
  headsign: string;
  /** Claves de lugar ("emt:2277", "fgv:24") en orden. */
  stops: string[];
  /** Minutos acumulados desde la primera parada. */
  t: number[];
  shape: LngLat[];
  /** Índice en `shape` de cada parada. */
  si: number[];
  /** Salidas por hora (0-23) en laborable, sábado y domingo. */
  hw: Record<DayType, number[]>;
};

export type WalkLeg = { kind: 'walk'; from: LngLat; to: LngLat; meters: number; minutes: number; toKey?: string };
export type RideLeg = {
  kind: 'ride';
  op: Op;
  line: string;
  /** Líneas alternativas que hacen el mismo tramo (p. ej. metro L3 y L5): sirve cualquiera. */
  lines: string[];
  pattern: Pattern;
  fromIdx: number;
  toIdx: number;
  fromKey: string;
  toKey: string;
  rideMin: number;
  /** Espera estimada por frecuencia (min). */
  waitMin: number;
  /** Intervalo entre vehículos a esa hora (min). */
  headwayMin: number;
};
export type Leg = WalkLeg | RideLeg;

export type Itinerary = {
  id: string;
  legs: Leg[];
  /** Minutos desde ahora hasta llegar (con la espera estimada). */
  totalMin: number;
  walkMin: number;
  transfers: number;
};

// ---------- parámetros ----------

const WALK_M_PER_MIN = 80; // 4,8 km/h
const DETOUR = 1.25; // línea recta → calle
const MAX_ACCESS_M = 1000;
const MAX_TRANSFER_M = 350;
const MAX_WALK_ONLY_M = 2500;
const TRANSFER_PENALTY = 4; // min "percibidos" por transbordo
const WALK_PENALTY = 0.3; // min extra percibidos por cada minuto andando
const MAX_WAIT = 30;
const MAX_RESULTS = 5;

export const walkMinutes = (m: number) => (m * DETOUR) / WALK_M_PER_MIN;

// ---------- red e índices (perezosos) ----------

type Net = {
  patterns: Pattern[];
  servedBy: Map<string, { p: Pattern; i: number }[]>;
  byLine: Map<string, Pattern[]>;
  transfers: Map<string, { key: string; meters: number }[]>;
};

let net: Net | null = null;

function network(): Net {
  if (net) return net;
  const raw = (networkJson as unknown as { patterns: (Omit<Pattern, 'stops'> & { stops: string[] })[] }).patterns;
  const patterns: Pattern[] = raw
    .map((p) => ({ ...p, stops: p.stops.map((s) => `${p.op}:${s}`) }))
    .filter((p) => p.stops.every((k) => placeByKey.has(k)));

  const servedBy = new Map<string, { p: Pattern; i: number }[]>();
  const byLine = new Map<string, Pattern[]>();
  for (const p of patterns) {
    p.stops.forEach((k, i) => {
      if (i === p.stops.length - 1) return; // en la última parada no se sube nadie
      let arr = servedBy.get(k);
      if (!arr) servedBy.set(k, (arr = []));
      arr.push({ p, i });
    });
    const lk = `${p.op}:${p.line}`;
    byLine.set(lk, [...(byLine.get(lk) ?? []), p]);
  }

  // Transbordos a pie: lugares a < MAX_TRANSFER_M (rejilla espacial de ~300 m)
  const CELL = 0.003;
  const grid = new Map<string, typeof places>();
  const cell = (lon: number, lat: number) => `${Math.floor(lon / CELL)}|${Math.floor(lat / CELL)}`;
  for (const pl of places) {
    const c = cell(pl.lon, pl.lat);
    grid.set(c, [...(grid.get(c) ?? []), pl]);
  }
  const transfers = new Map<string, { key: string; meters: number }[]>();
  for (const pl of places) {
    const cx = Math.floor(pl.lon / CELL), cy = Math.floor(pl.lat / CELL);
    const near: { key: string; meters: number }[] = [{ key: pl.key, meters: 0 }];
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (const o of grid.get(`${cx + dx}|${cy + dy}`) ?? []) {
          if (o.key === pl.key) continue;
          const m = distance([pl.lon, pl.lat], [o.lon, o.lat]);
          if (m <= MAX_TRANSFER_M) near.push({ key: o.key, meters: m });
        }
    transfers.set(pl.key, near);
  }

  net = { patterns, servedBy, byLine, transfers };
  return net;
}

// ---------- tiempo ----------

function madridClock(now: Date): { day: DayType; minuteOfDay: number } {
  let dow = now.getDay();
  try {
    const wd = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', weekday: 'short' }).format(now);
    dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd);
  } catch {
    // sin Intl con zonas: hora local del dispositivo
  }
  const secs = madridSecondsOfDay(now) ?? now.getHours() * 3600 + now.getMinutes() * 60;
  return { day: dow === 0 ? 'su' : dow === 6 ? 'sa' : 'wk', minuteOfDay: secs / 60 };
}

/**
 * Salidas por hora de una línea en el sentido de `p` desde la parada i: suma todas
 * las variantes de la misma línea que pasan por esa parada y la siguiente.
 */
function departuresPerHour(p: Pattern, i: number, day: DayType, hour: number): number {
  const a = p.stops[i], b = p.stops[i + 1];
  let n = 0;
  for (const q of network().byLine.get(`${p.op}:${p.line}`) ?? []) {
    const qi = q.stops.indexOf(a);
    if (qi >= 0 && q.stops[qi + 1] === b) n += q.hw[day][hour % 24];
  }
  return n;
}

// Memo: la misma (patrón, parada, día, hora) se consulta miles de veces por búsqueda.
const departuresMemo = new Map<string, number>();

function waitAt(p: Pattern, i: number, day: DayType, minuteOfDay: number): { wait: number; headway: number } | null {
  const hour = Math.floor(minuteOfDay / 60) % 24;
  const key = `${p.id}|${i}|${day}|${hour}`;
  let n = departuresMemo.get(key);
  if (n == null) departuresMemo.set(key, (n = departuresPerHour(p, i, day, hour)));
  if (n === 0) return null;
  const headway = 60 / n;
  return { wait: Math.min(MAX_WAIT, Math.max(1, headway / 2)), headway };
}

// ---------- búsqueda ----------

type Egress = { cost: number; j: number; walk: number };

export function planRoutes(origin: LngLat, destination: LngLat, now = new Date()): Itinerary[] {
  const { servedBy, transfers } = network();
  const { day, minuteOfDay } = madridClock(now);

  const near = (pt: LngLat) =>
    places
      .map((pl) => ({ key: pl.key, meters: distance(pt, [pl.lon, pl.lat]) }))
      .filter((x) => x.meters <= MAX_ACCESS_M);
  const access = near(origin);
  const egress = new Map(near(destination).map((x) => [x.key, walkMinutes(x.meters)]));

  // Para cada patrón e índice: mejor forma de llegar al destino bajándose más adelante.
  const egressCache = new Map<string, Egress[]>();
  const egressOf = (p: Pattern): Egress[] => {
    let res = egressCache.get(p.id);
    if (res) return res;
    res = new Array(p.stops.length);
    let best = Infinity, bestJ = -1;
    for (let i = p.stops.length - 1; i >= 0; i--) {
      res[i] = { cost: best - p.t[i], j: bestJ, walk: bestJ >= 0 ? (egress.get(p.stops[bestJ]) ?? 0) : 0 };
      const e = egress.get(p.stops[i]);
      if (e != null && p.t[i] + e < best) {
        best = p.t[i] + e;
        bestJ = i;
      }
    }
    egressCache.set(p.id, res);
    return res;
  };

  type Candidate = { score: number; it: Itinerary };
  const best = new Map<string, Candidate>();
  const consider = (signature: string, it: Itinerary) => {
    const score = it.totalMin + it.transfers * TRANSFER_PENALTY + it.walkMin * WALK_PENALTY;
    const prev = best.get(signature);
    if (!prev || score < prev.score) best.set(signature, { score, it });
  };

  const placeCoord = (k: string): LngLat => {
    const pl = placeByKey.get(k)!;
    return [pl.lon, pl.lat];
  };
  const walkLeg = (from: LngLat, to: LngLat, toKey?: string): WalkLeg => {
    const meters = distance(from, to) * DETOUR;
    return { kind: 'walk', from, to, meters, minutes: meters / WALK_M_PER_MIN, toKey };
  };
  const rideLeg = (p: Pattern, i: number, j: number, w: { wait: number; headway: number }): RideLeg => ({
    kind: 'ride',
    op: p.op,
    line: p.line,
    lines: [p.line],
    pattern: p,
    fromIdx: i,
    toIdx: j,
    fromKey: p.stops[i],
    toKey: p.stops[j],
    rideMin: p.t[j] - p.t[i],
    waitMin: w.wait,
    headwayMin: w.headway,
  });

  // Solo a pie
  const direct = distance(origin, destination);
  if (direct <= MAX_WALK_ONLY_M) {
    const leg = walkLeg(origin, destination);
    consider('walk', { id: 'walk', legs: [leg], totalMin: leg.minutes, walkMin: leg.minutes, transfers: 0 });
  }

  // Ronda 1: un vehículo. De paso, guardamos a qué paradas se llega y cuándo (para la ronda 2).
  type Reached = { arr: number; accessKey: string; walkA: number; p: Pattern; i: number; k: number; w: { wait: number; headway: number } };
  const reached = new Map<string, Reached>();
  for (const a of access) {
    const walkA = walkMinutes(a.meters);
    for (const { p, i } of servedBy.get(a.key) ?? []) {
      const w = waitAt(p, i, day, minuteOfDay + walkA);
      if (!w) continue;
      const start = walkA + w.wait;

      const e = egressOf(p)[i];
      if (e.j > i) {
        const legs: Leg[] = [walkLeg(origin, placeCoord(a.key), a.key), rideLeg(p, i, e.j, w), walkLeg(placeCoord(p.stops[e.j]), destination)];
        consider(`${p.op}:${p.line}`, {
          id: `${p.id}:${i}-${e.j}`,
          legs,
          totalMin: start + e.cost,
          walkMin: walkA + e.walk,
          transfers: 0,
        });
      }
      for (let k = i + 1; k < p.stops.length; k++) {
        const arr = start + p.t[k] - p.t[i];
        const prev = reached.get(p.stops[k]);
        if (!prev || arr < prev.arr) reached.set(p.stops[k], { arr, accessKey: a.key, walkA, p, i, k, w });
      }
    }
  }

  // Ronda 2: un transbordo (a pie hasta MAX_TRANSFER_M si hace falta).
  for (const [k, r] of reached) {
    for (const t of transfers.get(k) ?? []) {
      const tw = walkMinutes(t.meters);
      for (const { p: q, i: i2 } of servedBy.get(t.key) ?? []) {
        if (q.op === r.p.op && q.line === r.p.line) continue;
        const e = egressOf(q)[i2];
        if (e.j <= i2) continue;
        const w2 = waitAt(q, i2, day, minuteOfDay + r.arr + tw);
        if (!w2) continue;
        const total = r.arr + tw + w2.wait + e.cost;
        const legs: Leg[] = [
          walkLeg(origin, placeCoord(r.accessKey), r.accessKey),
          rideLeg(r.p, r.i, r.k, r.w),
          walkLeg(placeCoord(k), placeCoord(t.key), t.key),
          rideLeg(q, i2, e.j, w2),
          walkLeg(placeCoord(q.stops[e.j]), destination),
        ];
        consider(`${r.p.op}:${r.p.line}>${q.op}:${q.line}`, {
          id: `${r.p.id}:${r.i}-${r.k}>${q.id}:${i2}-${e.j}`,
          legs,
          totalMin: total,
          walkMin: r.walkA + tw + e.walk,
          transfers: 1,
        });
      }
    }
  }

  return postProcess([...best.values()].map((c) => c.it));
}

const score = (it: Itinerary) => it.totalMin + it.transfers * TRANSFER_PENALTY + it.walkMin * WALK_PENALTY;

/** Une líneas que hacen el mismo recorrido, quita lo dominado y ordena. */
function postProcess(candidates: Itinerary[]): Itinerary[] {
  // 1) Mismo recorrido (mismas paradas de subida/bajada) con líneas distintas → una sola opción
  //    "L3 / L5" con la frecuencia combinada: sirve el primer vehículo de cualquiera.
  const groups = new Map<string, Itinerary[]>();
  for (const it of candidates) {
    const key = it.legs
      .filter((l): l is RideLeg => l.kind === 'ride')
      .map((l) => `${l.fromKey}>${l.toKey}`)
      .join('|') || 'walk';
    groups.set(key, [...(groups.get(key) ?? []), it]);
  }
  const merged: Itinerary[] = [];
  for (const group of groups.values()) {
    const base = group.reduce((a, b) => (b.totalMin < a.totalMin ? b : a));
    if (group.length === 1) {
      merged.push(base);
      continue;
    }
    let total = base.totalMin;
    const legs = base.legs.map((leg, li) => {
      if (leg.kind !== 'ride') return leg;
      const alts = group.map((g) => g.legs[li]).filter((l): l is RideLeg => l?.kind === 'ride');
      const lines = [...new Set(alts.map((l) => l.line))].sort((x, y) => x.localeCompare(y, 'es', { numeric: true }));
      if (lines.length === 1) return leg;
      const headway = 1 / alts.filter((l, i) => alts.findIndex((x) => x.line === l.line) === i).reduce((acc, l) => acc + 1 / l.headwayMin, 0);
      const wait = Math.min(MAX_WAIT, Math.max(1, headway / 2));
      total += wait - leg.waitMin;
      return { ...leg, lines, headwayMin: headway, waitMin: wait };
    });
    merged.push({ ...base, legs, totalMin: total });
  }

  // 2) Fuera lo dominado: otra opción igual o más rápida, sin más transbordos y sin andar más.
  const kept = merged.filter(
    (x) =>
      !merged.some(
        (y) =>
          y !== x &&
          y.totalMin <= x.totalMin &&
          y.transfers <= x.transfers &&
          y.walkMin <= x.walkMin + 2 &&
          (y.totalMin < x.totalMin || y.transfers < x.transfers || y.walkMin < x.walkMin),
      ),
  );

  // 3) Si ir andando es lo más rápido, el transporte solo se ofrece si ahorra tiempo.
  const walk = kept.find((it) => it.id === 'walk');
  const useful = walk ? kept.filter((it) => it === walk || it.totalMin < walk.totalMin) : kept;

  const ranked = useful.sort((a, b) => score(a) - score(b));
  if (!ranked.length) return [];
  const limit = ranked[0].totalMin * 1.8 + 10;
  return ranked
    .filter((it) => it.totalMin <= limit)
    .slice(0, MAX_RESULTS)
    .map((it) => ({ ...it, legs: it.legs.filter((l) => l.kind === 'ride' || l.minutes >= 0.5) }));
}
