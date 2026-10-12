/**
 * Capas de transporte compartidas entre web (maplibre-gl) y nativo
 * (@maplibre/maplibre-react-native v11): ambos aceptan la style-spec tal cual.
 */
import type {
  CircleLayerSpecification,
  ExpressionSpecification,
  FilterSpecification,
  LineLayerSpecification,
  SymbolLayerSpecification,
} from '@maplibre/maplibre-gl-style-spec';

import type { Mode } from '@/data/places';
import { palette } from '@/theme/palette';

export const PLACES_SOURCE = 'places';
export const ME_SOURCE = 'me';

type Circle = Omit<CircleLayerSpecification, 'source'>;
type Symbol = Omit<SymbolLayerSpecification, 'source'>;

const modeColor: ExpressionSpecification = [
  'match',
  ['get', 'mode'],
  'metro',
  palette.metro.DEFAULT,
  'tram',
  palette.tram.DEFAULT,
  palette.emt.DEFAULT,
];

const isStation: ExpressionSpecification = ['!=', ['get', 'mode'], 'emt'];
const visible = (modes: Mode[]): ExpressionSpecification => ['in', ['get', 'mode'], ['literal', modes]];

/** Filtros de cada capa según los modos activos en los chips. */
export const filters = {
  stops: (modes: Mode[]): FilterSpecification => ['all', ['==', ['get', 'mode'], 'emt'], visible(modes)],
  stations: (modes: Mode[]): FilterSpecification => ['all', isStation, visible(modes)],
  selected: (key: string | null): FilterSpecification => ['==', ['get', 'key'], key ?? '__none__'],
};

/** Paradas "hub" (6+ líneas) se dibujan algo mayores para dar jerarquía al mapa. */
const isHub: ExpressionSpecification = ['>=', ['get', 'nLines'], 6];

export const stopsLayer = (modes: Mode[]): Circle => ({
  id: 'stops',
  type: 'circle',
  filter: filters.stops(modes),
  paint: {
    'circle-color': palette.emt.DEFAULT,
    'circle-radius': [
      'interpolate', ['linear'], ['zoom'],
      11, ['case', isHub, 2, 1.2],
      14, ['case', isHub, 4.5, 3.2],
      17, ['case', isHub, 8, 6.5],
    ],
    'circle-stroke-color': palette.ink.DEFAULT,
    'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 12, 0, 14, 1.5, 17, 2.5],
    'circle-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 13, 1],
    'circle-pitch-alignment': 'map',
  },
});

/** Estaciones de metro/tranvía: más grandes y con anillo blanco, visibles desde lejos. */
export const stationsLayer = (modes: Mode[]): Circle => ({
  id: 'stations',
  type: 'circle',
  filter: filters.stations(modes),
  paint: {
    'circle-color': modeColor,
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 2.5, 13, 5, 16, 9],
    'circle-stroke-color': '#FFFFFF',
    'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 14, 2.5],
    'circle-pitch-alignment': 'map',
  },
});

const labelPaint = { 'text-color': '#C9CDD4', 'text-halo-color': palette.ink.DEFAULT, 'text-halo-width': 1.4 } as const;

export const stopsLabelLayer = (modes: Mode[]): Symbol => ({
  id: 'stops-label',
  type: 'symbol',
  minzoom: 16,
  filter: filters.stops(modes),
  layout: {
    'text-field': ['get', 'name'],
    'text-font': ['Noto Sans Regular'],
    'text-size': 11,
    'text-offset': [0, 1.2],
    'text-anchor': 'top',
    'text-max-width': 9,
    'text-optional': true,
  },
  paint: labelPaint,
});

export const stationsLabelLayer = (modes: Mode[]): Symbol => ({
  id: 'stations-label',
  type: 'symbol',
  minzoom: 13,
  filter: filters.stations(modes),
  layout: {
    'text-field': ['get', 'name'],
    'text-font': ['Noto Sans Bold'],
    'text-size': ['interpolate', ['linear'], ['zoom'], 13, 10, 16, 12],
    'text-offset': [0, 1.1],
    'text-anchor': 'top',
    'text-max-width': 9,
    'text-optional': true,
  },
  paint: { ...labelPaint, 'text-color': '#E4E7EC' },
});

export const selectedHaloLayer = (key: string | null): Circle => ({
  id: 'selected-halo',
  type: 'circle',
  filter: filters.selected(key),
  paint: {
    'circle-color': modeColor,
    'circle-opacity': 0.22,
    'circle-radius': 26,
    'circle-blur': 0.35,
  },
});

export const selectedLayer = (key: string | null): Circle => ({
  id: 'selected',
  type: 'circle',
  filter: filters.selected(key),
  paint: {
    'circle-color': '#FFFFFF',
    'circle-radius': 7,
    'circle-stroke-color': modeColor,
    'circle-stroke-width': 4,
  },
});

export const meHaloLayer: Circle = {
  id: 'me-halo',
  type: 'circle',
  paint: { 'circle-color': palette.accent.DEFAULT, 'circle-opacity': 0.16, 'circle-radius': 24 },
};

export const meDotLayer: Circle = {
  id: 'me-dot',
  type: 'circle',
  paint: {
    'circle-color': palette.accent.DEFAULT,
    'circle-radius': 7,
    'circle-stroke-color': '#FFFFFF',
    'circle-stroke-width': 3,
  },
};

// ---------- ruta planificada ----------

export const ROUTE_SOURCE = 'route';

type Line = Omit<LineLayerSpecification, 'source'>;
const kindIs = (k: string): FilterSpecification => ['==', ['get', 'kind'], k];

export const routeLayers: (Line | Circle)[] = [
  {
    // Línea entera (tenue) por la que circulan los vehículos
    id: 'route-line-full',
    type: 'line',
    filter: kindIs('line'),
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': 4, 'line-opacity': 0.35 },
  },
  {
    id: 'route-walk',
    type: 'line',
    filter: kindIs('walk'),
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    // Puntos (guiones de longitud 0 con extremos redondos), como en las apps de mapas.
    paint: { 'line-color': '#E6E8EC', 'line-width': 4, 'line-dasharray': [0, 2] },
  },
  {
    id: 'route-ride-casing',
    type: 'line',
    filter: kindIs('ride'),
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': palette.ink.DEFAULT, 'line-width': 11 },
  },
  {
    id: 'route-ride',
    type: 'line',
    filter: kindIs('ride'),
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': 6 },
  },
  {
    id: 'route-stops',
    type: 'circle',
    filter: kindIs('stop'),
    paint: { 'circle-color': '#FFFFFF', 'circle-radius': 5.5, 'circle-stroke-color': ['get', 'color'], 'circle-stroke-width': 3 },
  },
  {
    id: 'route-origin',
    type: 'circle',
    filter: kindIs('origin'),
    paint: { 'circle-color': palette.accent.DEFAULT, 'circle-radius': 7, 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 3 },
  },
  {
    id: 'route-dest',
    type: 'circle',
    filter: kindIs('dest'),
    paint: { 'circle-color': palette.ink.DEFAULT, 'circle-radius': 8, 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 4 },
  },
];

// ---------- vehículos en directo ----------

export const VEHICLES_SOURCE = 'vehicles';

/**
 * Círculo del color de la línea con el pictograma blanco encima. `iconSize` depende de la
 * plataforma: en web la imagen se registra a pixelRatio 2 (32 px) y en nativo el PNG mide 64.
 */
export const vehicleLayers = (iconSize: number): (Circle | Symbol)[] => [
  {
    id: 'veh-bg',
    type: 'circle',
    paint: {
      'circle-color': ['get', 'color'],
      'circle-radius': 13,
      'circle-stroke-color': '#FFFFFF',
      'circle-stroke-width': 2.5,
      'circle-pitch-alignment': 'map',
    },
  },
  {
    id: 'veh-icon',
    type: 'symbol',
    layout: {
      'icon-image': ['get', 'icon'],
      'icon-size': iconSize,
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  },
];

/** icon-size para web/WebView (imagen de 64 px registrada a pixelRatio 2 → 32 px) y nativo (64 px). */
export const VEHICLE_ICON_SIZE = { web: 0.56, native: 0.28 };
