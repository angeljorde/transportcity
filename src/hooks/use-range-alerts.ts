import { useEffect } from 'react';

import { placeByKey } from '@/data/places';
import { scheduleLeaveAlerts, todayAt, type LeaveAlert } from '@/lib/alerts';
import type { Favorite } from '@/lib/favorites';
import { SAFETY_MARGIN_MIN } from '@/lib/live-leg';
import { addMinutes, clock } from '@/lib/time-format';

import type { FavoriteLive } from './use-favorite-live';

/**
 * Con datos en directo, programa un "¡Sal ya!" por cada vehículo que se puede coger
 * dentro de la franja del favorito (salida con 3 min de margen en la parada).
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
      .map((arrivesIn) => ({ arrivesIn, leaveAt: addMinutes(now, arrivesIn - live.walkBefore - SAFETY_MARGIN_MIN) }))
      .filter(({ leaveAt }) => leaveAt <= end)
      .map(({ arrivesIn, leaveAt }) => ({
        leaveAt,
        detail: `El ${lines} pasa por ${stop} a las ${clock(addMinutes(now, arrivesIn))}. Saliendo ahora llegas ${SAFETY_MARGIN_MIN} min antes.`,
      }));
    scheduleLeaveAlerts(fav, alerts).catch(() => {});
  }, [fav, best]);
}
