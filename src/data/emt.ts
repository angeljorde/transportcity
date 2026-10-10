import type { FeatureCollection, Point } from 'geojson';

import routesJson from './emt-routes.json';
import stopsJson from './emt-stops.json';

export type Stop = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  lines: string[];
};

export type Route = {
  id: string;
  line: string;
  name: string;
  color: string;
};

export type StopFeatureProps = { id: string; name: string; nLines: number };

export const stops: Stop[] = stopsJson.stops;
export const routes: Route[] = routesJson.routes;
export const feedVersion: string | undefined = stopsJson.feedVersion;

export const stopById = new Map(stops.map((s) => [s.id, s]));
export const routeByLine = new Map(routes.map((r) => [r.line, r]));

export const stopsGeoJSON: FeatureCollection<Point, StopFeatureProps> = {
  type: 'FeatureCollection',
  features: stops.map((s) => ({
    type: 'Feature',
    id: Number(s.id),
    geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
    properties: { id: s.id, name: s.name, nLines: s.lines.length },
  })),
};
