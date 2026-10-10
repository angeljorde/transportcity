/**
 * Estilo de mapa oscuro propio (esquema OpenMapTiles) servido por OpenFreeMap:
 * sin API key, sin límites duros y con atribución OSM.
 *
 * Criterios: tierra casi negra, agua aún más oscura, calles en grises que ganan
 * luz con la jerarquía, etiquetas apagadas. El color lo ponen las capas de
 * transporte que pintamos encima, no el mapa base.
 */
// Tipado con la style-spec que usa @maplibre/maplibre-react-native (fija su versión).
import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';

const C = {
  land: '#0D0F12',
  landResidential: '#101216',
  park: '#0E1713',
  water: '#06080C',
  waterway: '#0A0E14',
  building: '#15181D',
  buildingOutline: '#1A1E24',
  roadMinor: '#1A1D22',
  roadSecondary: '#22262C',
  roadPrimary: '#2A2E35',
  roadMotorway: '#343941',
  rail: '#262A31',
  label: '#7C828D',
  labelMajor: '#A3A9B3',
  labelHalo: '#0D0F12',
  boundary: '#2A2E35',
};

const FONT = ['Noto Sans Regular'];
const FONT_BOLD = ['Noto Sans Bold'];
const NAME = ['coalesce', ['get', 'name:latin'], ['get', 'name']] as const;

/** Ancho de vía interpolado exponencialmente por zoom. */
const roadWidth = (base: number, max: number) =>
  ['interpolate', ['exponential', 1.6], ['zoom'], 10, base, 18, max] as const;

export const darkMapStyle = {
  version: 8,
  name: 'TransportCity Dark',
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    omt: {
      type: 'vector',
      url: 'https://tiles.openfreemap.org/planet',
      attribution:
        '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
    },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': C.land } },
    {
      id: 'landuse-residential',
      type: 'fill',
      source: 'omt',
      'source-layer': 'landuse',
      filter: ['in', ['get', 'class'], ['literal', ['residential', 'suburb', 'neighbourhood']]],
      paint: { 'fill-color': C.landResidential },
    },
    {
      id: 'park',
      type: 'fill',
      source: 'omt',
      'source-layer': 'park',
      paint: { 'fill-color': C.park },
    },
    {
      id: 'landcover-green',
      type: 'fill',
      source: 'omt',
      'source-layer': 'landcover',
      filter: ['in', ['get', 'class'], ['literal', ['grass', 'wood', 'farmland']]],
      paint: { 'fill-color': C.park, 'fill-opacity': 0.7 },
    },
    {
      id: 'water',
      type: 'fill',
      source: 'omt',
      'source-layer': 'water',
      filter: ['!=', ['get', 'brunnel'], 'tunnel'],
      paint: { 'fill-color': C.water },
    },
    {
      id: 'waterway',
      type: 'line',
      source: 'omt',
      'source-layer': 'waterway',
      paint: { 'line-color': C.waterway, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 16, 3] },
    },
    {
      id: 'building',
      type: 'fill',
      source: 'omt',
      'source-layer': 'building',
      minzoom: 14,
      paint: {
        'fill-color': C.building,
        'fill-outline-color': C.buildingOutline,
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 15.5, 1],
      },
    },
    {
      id: 'road-path',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      minzoom: 15,
      filter: ['in', ['get', 'class'], ['literal', ['path', 'track']]],
      paint: { 'line-color': C.roadMinor, 'line-width': 1, 'line-dasharray': [2, 2] },
    },
    {
      id: 'road-minor',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      minzoom: 12,
      filter: ['in', ['get', 'class'], ['literal', ['minor', 'service']]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': C.roadMinor, 'line-width': roadWidth(0.4, 10) },
    },
    {
      id: 'road-secondary',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['secondary', 'tertiary']]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': C.roadSecondary, 'line-width': roadWidth(0.6, 14) },
    },
    {
      id: 'road-primary',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['primary', 'trunk']]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': C.roadPrimary, 'line-width': roadWidth(0.8, 18) },
    },
    {
      id: 'road-motorway',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      filter: ['==', ['get', 'class'], 'motorway'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': C.roadMotorway, 'line-width': roadWidth(1, 20) },
    },
    {
      id: 'rail',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['rail', 'transit']]],
      paint: {
        'line-color': C.rail,
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.6, 17, 2],
        'line-dasharray': [3, 2],
      },
    },
    {
      id: 'boundary',
      type: 'line',
      source: 'omt',
      'source-layer': 'boundary',
      filter: ['<=', ['get', 'admin_level'], 4],
      paint: { 'line-color': C.boundary, 'line-dasharray': [2, 2], 'line-width': 1 },
    },
    {
      id: 'water-name',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'water_name',
      layout: { 'text-field': NAME, 'text-font': FONT, 'text-size': 12, 'text-letter-spacing': 0.1 },
      paint: { 'text-color': '#3A4452', 'text-halo-color': C.water, 'text-halo-width': 1 },
    },
    {
      id: 'road-label',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'transportation_name',
      minzoom: 14,
      layout: {
        'symbol-placement': 'line',
        'text-field': NAME,
        'text-font': FONT,
        'text-size': ['interpolate', ['linear'], ['zoom'], 14, 10, 18, 13],
        'text-max-angle': 30,
      },
      paint: { 'text-color': C.label, 'text-halo-color': C.labelHalo, 'text-halo-width': 1.4 },
    },
    {
      id: 'place-neighbourhood',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'place',
      minzoom: 12,
      maxzoom: 17,
      filter: ['in', ['get', 'class'], ['literal', ['suburb', 'neighbourhood', 'quarter']]],
      layout: {
        'text-field': ['upcase', NAME],
        'text-font': FONT_BOLD,
        'text-size': ['interpolate', ['linear'], ['zoom'], 12, 9, 16, 12],
        'text-letter-spacing': 0.18,
        'text-max-width': 8,
      },
      paint: { 'text-color': '#5D636D', 'text-halo-color': C.labelHalo, 'text-halo-width': 1.2 },
    },
    {
      id: 'place-town',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'place',
      maxzoom: 15,
      filter: ['in', ['get', 'class'], ['literal', ['town', 'village']]],
      layout: { 'text-field': NAME, 'text-font': FONT_BOLD, 'text-size': ['interpolate', ['linear'], ['zoom'], 9, 11, 14, 14] },
      paint: { 'text-color': C.labelMajor, 'text-halo-color': C.labelHalo, 'text-halo-width': 1.4 },
    },
    {
      id: 'place-city',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'place',
      maxzoom: 13,
      filter: ['==', ['get', 'class'], 'city'],
      layout: { 'text-field': NAME, 'text-font': FONT_BOLD, 'text-size': ['interpolate', ['linear'], ['zoom'], 6, 13, 12, 20] },
      paint: { 'text-color': '#D5D9E0', 'text-halo-color': C.labelHalo, 'text-halo-width': 1.6 },
    },
  ],
} as unknown as StyleSpecification;
