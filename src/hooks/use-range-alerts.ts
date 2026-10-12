import { useEffect } from 'react';

import { placeByKey } from '@/data/places';
import { scheduleLeaveAlerts, todayAt, type LeaveAlert } from '@/lib/alerts';
import type { Favorite } from '@/lib/favorites';
import { addMinutes, clock } from '@/lib/time-format';

import type { FavoriteLive } from './use-favorite-live';

/**
 * Con datos en directo, programa un "¡Sal ya!" por cada vehículo que se puede coger
 * dentro de la franja del favorito (llegando a la parada con el margen elegido).
 */
export function useRangeAlerts(fav: Favorite, best: FavoriteLive | null) {
  useEffect(() => {
    const live = best?.live;
    if (!live || live.status !== 'live' || !best.firstRide) return;
    const now = new Date();
    const end = todayAt(fav.schedule.to, now);
    const stop = placeByKey.get(best.firstRide.fromKey)?.name ?? 'tu parada';
    const lines = best.firstRide.lines.join(' / ');

    const alerts: LeaveAlert[] = live.upcoming
      .map((arrivesIn) => ({ arrivesIn, leaveAt: addMinutes(now, arrivesIn - live.walkBefore - live.margin) }))
      .filter(({ leaveAt }) => leaveAt <= end)
      .map(({ arrivesIn, leaveAt }) => ({
        leaveAt,
        detail: `El ${lines} pasa por ${stop} a las ${clock(addMinutes(now, arrivesIn))}. Saliendo ahora llegas ${live.margin} min antes.`,
      }));
    scheduleLeaveAlerts(fav, alerts).catch(() => {});
  }, [fav, best]);
}
