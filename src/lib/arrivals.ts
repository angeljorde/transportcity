import { Platform } from 'react-native';

import { fetchEmtArrivals, type Arrival } from '../../supabase/functions/_shared/emt';
import { callFunction } from './supabase';

export type { Arrival };

export type Arrivals = {
  status: 'ok' | 'empty' | 'unavailable';
  arrivals: Arrival[];
  fetchedAt: string;
};

/**
 * Llegadas en tiempo real a una parada de EMT.
 *
 * - iOS/Android: el móvil llama directamente a la EMT. La EMT bloquea las IPs de la
 *   nube (AWS), pero no las de los usuarios.
 * - Web: el navegador no puede (CORS + no deja fijar el Referer), así que va por la
 *   Edge Function `arrivals`. Hoy falla porque la EMT bloquea a Supabase.
 */
export async function getEmtArrivals(stopId: string, signal?: AbortSignal): Promise<Arrivals> {
  if (Platform.OS === 'web') {
    return callFunction<Arrivals>('arrivals', { stop: stopId }, signal);
  }
  const result = await fetchEmtArrivals(stopId, { signal });
  return { ...result, fetchedAt: new Date().toISOString() };
}

export type ArrivalGroup = {
  line: string;
  destination: string;
  minutes: (number | null)[];
  /** Hora del primer vehículo ("19:42"), cuando la fuente la da. */
  firstTime?: string;
};

/** Agrupa por línea + destino ("70 → La Fontsanta: 0, 9 min"), ordenado por la primera llegada. */
export function groupArrivals(arrivals: Arrival[]): ArrivalGroup[] {
  const groups = new Map<string, ArrivalGroup>();
  for (const a of arrivals) {
    const key = `${a.line}|${a.destination}`;
    const g = groups.get(key) ?? { line: a.line, destination: a.destination, minutes: [] };
    g.minutes.push(a.minutes);
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => (a.minutes[0] ?? 999) - (b.minutes[0] ?? 999));
}
