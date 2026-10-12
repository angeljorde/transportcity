/**
 * Posición estimada de los vehículos de una línea (EMT y FGV no publican GPS).
 *
 * Método: se consultan las llegadas en directo en varias paradas repartidas por el
 * recorrido. Si en la parada k "el 70 llega en m min", ese vehículo está en el punto
 * del recorrido por el que la línea pasa m min antes de k (tiempos GTFS entre paradas).
 * Cada parada consultada solo "ve" el tramo hasta la consultada anterior, así un mismo
 * vehículo no se cuenta dos veces. Entre consultas, el vehículo avanza con el reloj.
 */
import { getEmtArrivals } from './arrivals';
import { getFgvDepartures } from './departures';
import type { LngLat } from './geo';
import { goesOurWay } from './live-leg';
import type { Pattern } from './router';

/** Separación (min de recorrido) entre paradas consultadas. */
const SAMPLE_GAP_MIN = 7;
/** Detecciones más cercanas que esto (min) se consideran el mismo vehículo. */
const MERGE_MIN = 2.5;

export type VehicleEstimate = {
  /** Minuto del recorrido (desde la primera parada) en el que estaba al consultar. */
  t: number;
  line: string;
  fetchedAt: number;
};

/** Índices de parada a consultar: aprox. cada SAMPLE_GAP_MIN y siempre la penúltima. */
export function sampleStops(p: Pattern): number[] {
  const out: number[] = [];
  let last = 0;
  for (let k = 1; k < p.stops.length; k++) {
    const isLast = k === p.stops.length - 1;
    if (p.t[k] - p.t[last] >= SAMPLE_GAP_MIN || isLast) {
      out.push(k);
      last = k;
    }
  }
  return out;
}

async function arrivalsAt(p: Pattern, k: number, signal?: AbortSignal) {
  const id = p.stops[k].split(':')[1];
  return p.op === 'emt' ? (await getEmtArrivals(id, signal)).arrivals : (await getFgvDepartures(id, signal)).departures;
}

export async function estimateVehicles(p: Pattern, lines: string[], signal?: AbortSignal): Promise<VehicleEstimate[]> {
  const samples = sampleStops(p);
  const fetchedAt = Date.now();
  const results = await Promise.allSettled(samples.map((k) => arrivalsAt(p, k, signal)));

  const found: VehicleEstimate[] = [];
  samples.forEach((k, si) => {
    const r = results[si];
    if (r.status !== 'fulfilled') return;
    const prev = si === 0 ? 0 : samples[si - 1];
    const span = p.t[k] - p.t[prev];
    const ours = r.value.filter((v) => lines.includes(v.line) && v.minutes != null);
    // Sentido: el destino anunciado debe estar más adelante (en EMT, si no casa, vale la línea:
    // cada parada suele atender un solo sentido).
    const dir = ours.filter((v) => goesOurWay(p, k, v.destination));
    const vehicles = dir.length || p.op !== 'emt' ? dir : ours;
    for (const v of vehicles) {
      const m = v.minutes as number;
      // Solo el tramo entre la parada consultada anterior y esta (+1 min de tolerancia por redondeo).
      if (m > span + 1) continue;
      found.push({ t: Math.max(0, p.t[k] - m), line: v.line, fetchedAt });
    }
  });

  // Fusiona detecciones a menos de MERGE_MIN: es el mismo vehículo visto desde dos paradas
  // (FGV redondea al minuto y además lista algunos trenes duplicados con 2 min de diferencia).
  // Dos vehículos de una misma línea no van tan pegados.
  found.sort((a, b) => a.t - b.t);
  // Se compara por línea: L3 y L5 comparten vía y sí pueden ir seguidos.
  const merged: VehicleEstimate[] = [];
  const lastByLine = new Map<string, number>();
  for (const v of found) {
    const last = lastByLine.get(v.line);
    if (last != null && v.t - last < MERGE_MIN) continue;
    lastByLine.set(v.line, v.t);
    merged.push(v);
  }
  return merged;
}

// ---------- geometría: punto del recorrido en un minuto dado ----------

const cumCache = new WeakMap<Pattern, number[]>();

/** Longitud acumulada del trazado (en grados, suficiente para interpolar). */
function cumulative(p: Pattern): number[] {
  let c = cumCache.get(p);
  if (c) return c;
  c = [0];
  for (let i = 1; i < p.shape.length; i++) {
    const [x1, y1] = p.shape[i - 1];
    const [x2, y2] = p.shape[i];
    c.push(c[i - 1] + Math.hypot(x2 - x1, (y2 - y1) * 1.3));
  }
  cumCache.set(p, c);
  return c;
}

function pointAtDistance(p: Pattern, d: number): { coord: LngLat; bearing: number } {
  const c = cumulative(p);
  let i = 1;
  while (i < c.length - 1 && c[i] < d) i++;
  const [x1, y1] = p.shape[i - 1];
  const [x2, y2] = p.shape[i];
  const f = c[i] === c[i - 1] ? 0 : Math.min(1, Math.max(0, (d - c[i - 1]) / (c[i] - c[i - 1])));
  const bearing = (Math.atan2(x2 - x1, y2 - y1) * 180) / Math.PI;
  return { coord: [x1 + (x2 - x1) * f, y1 + (y2 - y1) * f], bearing };
}

/** Posición en el recorrido en el minuto `t` (interpolando entre las paradas que lo rodean). */
export function positionAt(p: Pattern, t: number): { coord: LngLat; bearing: number } | null {
  if (t < 0 || t > p.t[p.t.length - 1]) return null;
  let k = 1;
  while (k < p.t.length - 1 && p.t[k] < t) k++;
  const span = p.t[k] - p.t[k - 1];
  const f = span <= 0 ? 0 : (t - p.t[k - 1]) / span;
  const c = cumulative(p);
  const dA = c[p.si[k - 1]];
  const dB = c[p.si[k]];
  return pointAtDistance(p, dA + (dB - dA) * f);
}
