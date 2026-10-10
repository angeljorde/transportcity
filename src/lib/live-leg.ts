/**
 * "Sal en X min": para el primer vehículo de un itinerario, busca su llegada en tiempo
 * real a la parada de subida y calcula cuándo hay que salir para no perderlo.
 */
import { placeByKey } from '@/data/places';

import { getEmtArrivals } from './arrivals';
import { getFgvDepartures } from './departures';
import { normalize } from './geocode';
import type { Itinerary, RideLeg } from './router';

/** Margen de seguridad: llegar a la parada al menos 3 min antes de que pase el vehículo. */
export const SAFETY_MARGIN_MIN = 3;

export type LiveBoarding =
  | {
      status: 'live';
      line: string;
      /** Minutos hasta que el vehículo llega a la parada. */
      arrivesIn: number;
      /** Minutos hasta que hay que salir, con el margen de seguridad incluido (0 = ya). */
      leaveIn: number;
      /** Solo se llega andando sin margen: hay que salir ya y aun así es justo. */
      tight: boolean;
      /** Siguientes vehículos alcanzables (min). */
      later: number[];
      /** Total del itinerario con la espera real en lugar de la estimada. */
      totalMin: number;
    }
  | { status: 'none' } // no hay ningún vehículo de esas líneas en camino
  | { status: 'unavailable' }; // sin datos en tiempo real (p. ej. EMT en web)

/** ¿El destino que anuncia el vehículo está más adelante en nuestro recorrido? (sentido correcto) */
function goesOurWay(leg: RideLeg, destination: string): boolean {
  const d = normalize(destination);
  if (!d) return false;
  const ahead = [leg.pattern.headsign, ...leg.pattern.stops.slice(leg.fromIdx + 1).map((k) => placeByKey.get(k)?.name ?? '')];
  const dWords = d.split(' ').filter((w) => w.length >= 4);
  return ahead.some((name) => {
    const n = normalize(name);
    if (!n) return false;
    if (n.includes(d) || d.includes(n)) return true;
    // Abreviaturas de la EMT ("Est.J.Sorolla", "P. Ajuntament"): basta con una palabra significativa.
    return dWords.some((w) => n.split(' ').includes(w));
  });
}

export async function liveBoarding(it: Itinerary, signal?: AbortSignal): Promise<LiveBoarding> {
  const firstRide = it.legs.findIndex((l) => l.kind === 'ride');
  if (firstRide < 0) return { status: 'unavailable' };
  const leg = it.legs[firstRide] as RideLeg;
  const walkBefore = it.legs.slice(0, firstRide).reduce((acc, l) => acc + (l.kind === 'walk' ? l.minutes : 0), 0);
  const stopId = leg.fromKey.split(':')[1];

  let vehicles: { line: string; destination: string; minutes: number | null }[];
  try {
    vehicles =
      leg.op === 'emt'
        ? (await getEmtArrivals(stopId, signal)).arrivals
        : (await getFgvDepartures(stopId, signal)).departures;
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    return { status: 'unavailable' };
  }

  const ofOurLines = vehicles.filter((v) => leg.lines.includes(v.line) && v.minutes != null);
  let candidates = ofOurLines.filter((v) => goesOurWay(leg, v.destination));
  // En EMT cada parada suele estar en un solo sentido: si no casa el nombre, aceptamos la línea.
  // En metro/tranvía pasan ambos sentidos por el mismo andén: ahí exigimos que case.
  if (!candidates.length && leg.op === 'emt') candidates = ofOurLines;

  const reachable = candidates
    .map((v) => v.minutes as number)
    .filter((m) => m >= walkBefore - 0.5)
    .sort((a, b) => a - b);
  // FGV solo publica las próximas ~10 salidas de todas las líneas: que no salga la nuestra
  // no significa que no circule. Ahí caemos a la frecuencia; en EMT sí es "no viene ninguno".
  if (!reachable.length) return { status: leg.op === 'emt' ? 'none' : 'unavailable' };

  // Preferimos el primer vehículo que se coge con margen; si solo queda uno "a la carrera",
  // lo mostramos igualmente como justo.
  const withMargin = reachable.findIndex((m) => m >= walkBefore + SAFETY_MARGIN_MIN);
  const idx = withMargin >= 0 ? withMargin : 0;
  const tight = withMargin < 0;
  const arrivesIn = reachable[idx];
  const later = reachable.slice(idx + 1);
  const estimatedBoarding = walkBefore + leg.waitMin;
  return {
    status: 'live',
    line: candidates.find((v) => v.minutes === arrivesIn)?.line ?? leg.line,
    arrivesIn,
    leaveIn: Math.max(0, Math.floor(arrivesIn - walkBefore - SAFETY_MARGIN_MIN)),
    tight,
    later: later.slice(0, 2),
    totalMin: it.totalMin - estimatedBoarding + Math.max(arrivesIn, walkBefore),
  };
}
