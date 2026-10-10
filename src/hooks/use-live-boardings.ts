import { usePolling } from '@/hooks/use-polling';
import { liveBoarding, type LiveBoarding } from '@/lib/live-leg';
import type { Itinerary } from '@/lib/router';

const REFRESH_MS = 30_000;

/** Tiempo real del primer vehículo de cada itinerario, refrescado cada 30 s. */
export function useLiveBoardings(itineraries: Itinerary[]): Map<string, LiveBoarding> {
  const key = itineraries.map((i) => i.id).join(',') || null;
  const { data } = usePolling(
    key,
    async (signal) => {
      const results = await Promise.allSettled(itineraries.map((it) => liveBoarding(it, signal)));
      return new Map(
        itineraries.map((it, i) => {
          const r = results[i];
          return [it.id, r.status === 'fulfilled' ? r.value : ({ status: 'unavailable' } as LiveBoarding)];
        }),
      );
    },
    REFRESH_MS,
  );
  return data ?? new Map();
}
