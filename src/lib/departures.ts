import type { Departure } from '../../supabase/functions/_shared/fgv';
import type { ArrivalGroup } from './arrivals';
import { callFunction } from './supabase';

export type { Departure };

export type Departures = {
  status: 'ok' | 'empty';
  departures: Departure[];
  fetchedAt: string;
};

/** Próximas salidas de Metrovalencia/TRAM (vía Edge Function: el geoportal no bloquea a Supabase). */
export function getFgvDepartures(stationId: string, signal?: AbortSignal): Promise<Departures> {
  return callFunction<Departures>('fgv-departures', { station: stationId }, signal);
}

/** Agrupa por línea + destino, igual que las llegadas de EMT, conservando la hora del primer tren. */
export function groupDepartures(departures: Departure[]): ArrivalGroup[] {
  const groups = new Map<string, ArrivalGroup>();
  for (const d of departures) {
    const key = `${d.line}|${d.destination}`;
    const g = groups.get(key) ?? { line: d.line, destination: d.destination, minutes: [], firstTime: d.time };
    g.minutes.push(d.minutes);
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => (a.minutes[0] ?? 999) - (b.minutes[0] ?? 999));
}
