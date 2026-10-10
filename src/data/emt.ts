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

export const stops: Stop[] = stopsJson.stops;
export const routes: Route[] = routesJson.routes;
export const feedVersion: string | undefined = stopsJson.feedVersion;

export const stopById = new Map(stops.map((s) => [s.id, s]));
export const routeByLine = new Map(routes.map((r) => [r.line, r]));
