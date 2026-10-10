/**
 * Capas de transporte compartidas entre web (maplibre-gl) y nativo
 * (@maplibre/maplibre-react-native v11): ambos aceptan la style-spec tal cual.
 */
import type {
  CircleLayerSpecification,
  ExpressionSpecification,
  FilterSpecification,
  SymbolLayerSpecification,
} from '@maplibre/maplibre-gl-style-spec';

import { palette } from '@/theme/palette';

export const STOPS_SOURCE = 'emt-stops';
export const ME_SOURCE = 'me';

type Circle = Omit<CircleLayerSpecification, 'source'>;
type Symbol = Omit<SymbolLayerSpecification, 'source'>;

export const selectedFilter = (id: string | null): FilterSpecification => ['==', ['get', 'id'], id ?? '__none__'];

/** Paradas "hub" (6+ líneas) se dibujan algo mayores para dar jerarquía al mapa. */
const isHub: ExpressionSpecification = ['>=', ['get', 'nLines'], 6];

export const stopsLayer: Circle = {
  id: 'stops',
  type: 'circle',
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
};

export const stopsLabelLayer: Symbol = {
  id: 'stops-label',
  type: 'symbol',
  minzoom: 16,
  layout: {
    'text-field': ['get', 'name'],
    'text-font': ['Noto Sans Regular'],
    'text-size': 11,
    'text-offset': [0, 1.2],
    'text-anchor': 'top',
    'text-max-width': 9,
    'text-optional': true,
  },
  paint: {
    'text-color': '#C9CDD4',
    'text-halo-color': palette.ink.DEFAULT,
    'text-halo-width': 1.4,
  },
};

export const selectedHaloLayer = (id: string | null): Circle => ({
  id: 'stops-selected-halo',
  type: 'circle',
  filter: selectedFilter(id),
  paint: {
    'circle-color': palette.emt.DEFAULT,
    'circle-opacity': 0.22,
    'circle-radius': 26,
    'circle-blur': 0.35,
  },
});

export const selectedLayer = (id: string | null): Circle => ({
  id: 'stops-selected',
  type: 'circle',
  filter: selectedFilter(id),
  paint: {
    'circle-color': '#FFFFFF',
    'circle-radius': 7,
    'circle-stroke-color': palette.emt.DEFAULT,
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
