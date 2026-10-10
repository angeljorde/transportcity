/**
 * "Lugares" del mapa: paradas de EMT y estaciones de FGV con una forma común, para
 * que el mapa, la lista de cercanos y los filtros por modo las traten igual.
 */
import type { FeatureCollection, Point } from 'geojson';

import { stops } from './emt';
import { stationMode, stations } from './fgv';

export type Mode = 'emt' | 'metro' | 'tram';
export const ALL_MODES: Mode[] = ['emt', 'metro', 'tram'];

export type Place = {
  /** Clave única entre operadores: "emt:2277", "fgv:24". */
  key: string;
  operator: 'emt' | 'fgv';
  id: string;
  mode: Mode;
  name: string;
  lat: number;
  lon: number;
  lines: string[];
};

export type PlaceFeatureProps = { key: string; name: string; mode: Mode; nLines: number };

export const places: Place[] = [
  ...stops.map((s): Place => ({ ...s, key: `emt:${s.id}`, operator: 'emt', mode: 'emt' })),
  ...stations.map((s): Place => ({ ...s, key: `fgv:${s.id}`, operator: 'fgv', mode: stationMode(s) })),
];

export const placeByKey = new Map(places.map((p) => [p.key, p]));

export const placesGeoJSON: FeatureCollection<Point, PlaceFeatureProps> = {
  type: 'FeatureCollection',
  features: places.map((p) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
    properties: { key: p.key, name: p.name, mode: p.mode, nLines: p.lines.length },
  })),
};
