/** Geometría de un itinerario para dibujarlo en el mapa. */
import type { Feature, FeatureCollection } from 'geojson';

import { placeByKey } from '@/data/places';
import { lineColor } from '@/theme/lines';

import type { LngLat } from './geo';
import type { Itinerary } from './router';

export type RouteFeatureProps = { kind: 'line' | 'walk' | 'ride' | 'stop' | 'origin' | 'dest'; color?: string };
export type Bounds = [west: number, south: number, east: number, north: number];

export type RouteDrawing = { geojson: FeatureCollection; bounds: Bounds };

const coordOf = (key: string): LngLat => {
  const p = placeByKey.get(key)!;
  return [p.lon, p.lat];
};

export function drawItinerary(it: Itinerary, origin: LngLat, destination: LngLat): RouteDrawing {
  const features: Feature[] = [];
  const line = (coords: LngLat[], props: RouteFeatureProps): Feature => ({
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: coords },
    properties: props,
  });
  const point = (c: LngLat, props: RouteFeatureProps): Feature => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: c },
    properties: props,
  });

  // Recorrido completo de cada línea usada, debajo del tramo que se hace (contexto + vehículos).
  for (const leg of it.legs) {
    if (leg.kind === 'ride') features.push(line(leg.pattern.shape, { kind: 'line', color: lineColor(leg.line, leg.op) }));
  }

  for (const leg of it.legs) {
    if (leg.kind === 'walk') {
      features.push(line([leg.from, leg.to], { kind: 'walk' }));
      continue;
    }
    const p = leg.pattern;
    const color = lineColor(leg.line, leg.op);
    // Tramo del trazado entre las dos paradas, anclado a sus coordenadas exactas.
    const a = coordOf(leg.fromKey), b = coordOf(leg.toKey);
    const middle = p.shape.slice(p.si[leg.fromIdx] + 1, p.si[leg.toIdx] + 1);
    features.push(line([a, ...middle, b], { kind: 'ride', color }));
    features.push(point(a, { kind: 'stop', color }), point(b, { kind: 'stop', color }));
  }
  features.push(point(origin, { kind: 'origin' }), point(destination, { kind: 'dest' }));

  // Caja que contiene todo el recorrido
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const f of features) {
    // La línea entera no cuenta: el encuadre es para el trayecto del usuario.
    if ((f.properties as RouteFeatureProps).kind === 'line') continue;
    const coords = f.geometry.type === 'Point' ? [f.geometry.coordinates] : (f.geometry as GeoJSON.LineString).coordinates;
    for (const [x, y] of coords) {
      w = Math.min(w, x);
      s = Math.min(s, y);
      e = Math.max(e, x);
      n = Math.max(n, y);
    }
  }
  return { geojson: { type: 'FeatureCollection', features }, bounds: [w, s, e, n] };
}
