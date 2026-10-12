import { usePolling } from '@/hooks/use-polling';
import type { Favorite } from '@/lib/favorites';
import type { LngLat } from '@/lib/geo';
import { liveBoarding, type LiveBoarding } from '@/lib/live-leg';
import { planRoutes, type Itinerary, type RideLeg } from '@/lib/router';

const REFRESH_MS = 30_000;

export type FavoriteLive = { itinerary: Itinerary; live: LiveBoarding; firstRide: RideLeg | null };

/**
 * Mejor opción en este momento para un favorito, con el primer vehículo en directo.
 * Solo consulta mientras `active` (p. ej. en su ventana de salida) para no gastar datos.
 */
export function useFavoriteLive(fav: Favorite, location: LngLat | null, active: boolean): FavoriteLive | null {
  const origin = fav.origin.isMe ? location : fav.origin.coord;
  const margin = fav.schedule.marginMin;
  const key = active && origin ? `${fav.id}|${margin}|${origin[0].toFixed(3)},${origin[1].toFixed(3)}` : null;

  const { data } = usePolling(
    key,
    async (signal) => {
      const its = planRoutes(origin!, fav.destination.coord);
      if (!its.length) return null;
      // Probamos las 3 mejores con datos en directo y nos quedamos con la que antes te deja allí.
      const withLive = await Promise.all(
        its.slice(0, 3).map(async (itinerary) => ({ itinerary, live: await liveBoarding(itinerary, signal, margin).catch(() => ({ status: 'unavailable' }) as LiveBoarding) })),
      );
      const total = (x: (typeof withLive)[number]) => (x.live.status === 'live' ? x.live.totalMin : x.itinerary.totalMin);
      const best = withLive.sort((a, b) => total(a) - total(b))[0];
      return { ...best, firstRide: (best.itinerary.legs.find((l) => l.kind === 'ride') as RideLeg | undefined) ?? null };
    },
    REFRESH_MS,
  );
  return data ?? null;
}
