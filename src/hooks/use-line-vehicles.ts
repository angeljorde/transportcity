import type { Feature, FeatureCollection, Point } from 'geojson';
import { useEffect, useMemo, useState } from 'react';

import { fgvLineByLine } from '@/data/fgv';
import { usePolling } from '@/hooks/use-polling';
import type { Itinerary, RideLeg } from '@/lib/router';
import { estimateVehicles, positionAt, type VehicleEstimate } from '@/lib/vehicles';
import { lineColor } from '@/theme/lines';
import type { VehicleIcon } from '@/theme/vehicle-icons';

const REFRESH_MS = 30_000;
// Cada cuánto avanzan los vehículos entre consultas. Más a menudo satura a maplibre-gl en web
// (cada setData reprocesa la fuente y retrasa la carga de teselas).
const TICK_MS = 3_000;

export type VehicleFeatureProps = {
  icon: VehicleIcon;
  color: string;
  line: string;
  /** Minutos que le faltan para llegar a la parada donde sube el usuario (solo 1.er tramo; null si ya pasó). */
  toBoarding: number | null;
};

const EMPTY: FeatureCollection<Point, VehicleFeatureProps> = { type: 'FeatureCollection', features: [] };

const iconFor = (leg: RideLeg): VehicleIcon =>
  leg.op === 'emt' ? 'veh-bus' : fgvLineByLine.get(leg.line)?.mode === 'tram' ? 'veh-tram' : 'veh-metro';

/**
 * Vehículos en directo (posición estimada) de las líneas de un itinerario, como GeoJSON
 * listo para el mapa. Consulta cada 30 s y entre medias los hace avanzar cada 3 s.
 */
export function useLineVehicles(it: Itinerary | null): FeatureCollection<Point, VehicleFeatureProps> {
  const legs = useMemo(() => (it?.legs.filter((l): l is RideLeg => l.kind === 'ride') ?? []), [it]);
  const key = legs.length ? legs.map((l) => `${l.pattern.id}:${l.lines.join('/')}`).join('|') : null;

  const { data } = usePolling(
    key,
    async (signal) => Promise.all(legs.map((l) => estimateVehicles(l.pattern, l.lines, signal).catch(() => [] as VehicleEstimate[]))),
    REFRESH_MS,
  );

  // Reloj para la animación entre consultas.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!key) return;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [key]);

  return useMemo(() => {
    if (!data || data.length !== legs.length) return EMPTY;
    const features: Feature<Point, VehicleFeatureProps>[] = [];
    legs.forEach((leg, i) => {
      const boardT = leg.pattern.t[leg.fromIdx];
      for (const v of data[i]) {
        // Avanza con el tiempo transcurrido desde la consulta (sin pasar de la última parada).
        const t = v.t + (now - v.fetchedAt) / 60_000;
        const pos = positionAt(leg.pattern, Math.min(t, leg.pattern.t[leg.pattern.t.length - 1]));
        if (!pos) continue;
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: pos.coord },
          properties: {
            icon: iconFor(leg),
            color: lineColor(v.line, leg.op),
            line: v.line,
            toBoarding: i === 0 && t <= boardT ? boardT - t : null,
          },
        });
      }
    });
    return { type: 'FeatureCollection', features };
  }, [data, legs, now]);
}
