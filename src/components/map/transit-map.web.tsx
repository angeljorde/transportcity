import 'maplibre-gl/dist/maplibre-gl.css';
import './map.web.css';

import {
  AttributionControl,
  type FilterSpecification as GLFilter,
  type GeoJSONSource,
  type LayerSpecification as GLLayer,
  Map as MLMap,
  setWorkerUrl,
  type StyleSpecification as GLStyle,
} from 'maplibre-gl';
import { useEffect, useEffectEvent, useImperativeHandle, useRef, type Ref } from 'react';

import { placesGeoJSON } from '@/data/places';
import { VALENCIA_CENTER } from '@/lib/geo';
import { darkMapStyle } from '@/theme/map-style';

import {
  filters,
  meDotLayer,
  meHaloLayer,
  ME_SOURCE,
  PLACES_SOURCE,
  selectedHaloLayer,
  selectedLayer,
  stationsLabelLayer,
  stationsLayer,
  stopsLabelLayer,
  stopsLayer,
} from './layers';
import type { TransitMapHandle, TransitMapProps } from './types';

// Worker copiado a public/ en postinstall (ver scripts/copy-maplibre-worker.mjs).
setWorkerUrl('/maplibre-gl-worker.mjs');

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

// maplibre-gl trae su propia copia (más nueva) de la style-spec; las capas están tipadas con la
// de maplibre-react-native. El JSON es idéntico: solo convertimos el tipo.
const gl = {
  style: (s: unknown) => s as GLStyle,
  layer: (l: object, source: string) => ({ ...l, source }) as GLLayer,
  filter: (f: unknown) => f as GLFilter,
};

export function TransitMap({
  ref,
  selectedKey,
  modes,
  topInset,
  userLocation,
  onPlacePress,
  onMapPress,
  onCenterChange,
}: TransitMapProps & { ref?: Ref<TransitMapHandle> }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const ready = useRef(false);
  // Última sincronización pendiente si llega antes de que el estilo termine de cargar.
  const pendingSync = useRef<(() => void) | null>(null);

  // Los handlers cambian en cada render; con useEffectEvent no hace falta re-registrar los eventos del mapa.
  const emitPlacePress = useEffectEvent((key: string) => onPlacePress(key));
  const emitMapPress = useEffectEvent(() => onMapPress?.());
  const emitCenterChange = useEffectEvent((c: [number, number]) => onCenterChange?.(c));

  useImperativeHandle(ref, () => ({
    flyTo(center, { zoom = 16, bottomInset = 0 } = {}) {
      map.current?.flyTo({ center, zoom, padding: { top: 0, left: 0, right: 0, bottom: bottomInset }, duration: 900, essential: true });
    },
  }));

  useEffect(() => {
    if (!container.current) return;
    const m = new MLMap({
      container: container.current,
      style: gl.style(darkMapStyle),
      center: VALENCIA_CENTER,
      zoom: 13.6,
      minZoom: 10,
      maxZoom: 19,
      pitchWithRotate: false,
      attributionControl: false,
    });
    map.current = m;
    m.addControl(new AttributionControl({ compact: true }), 'top-right');
    // En pantallas anchas maplibre abre la atribución desplegada; la dejamos plegada en el botón ⓘ.
    m.once('load', () => m.getContainer().querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show'));

    m.on('load', () => {
      // Los filtros reales (modos y selección) los aplica el efecto de sincronización.
      m.addSource(PLACES_SOURCE, { type: 'geojson', data: placesGeoJSON });
      m.addLayer(gl.layer(selectedHaloLayer(null), PLACES_SOURCE));
      m.addLayer(gl.layer(stopsLayer([]), PLACES_SOURCE));
      m.addLayer(gl.layer(stopsLabelLayer([]), PLACES_SOURCE));
      m.addLayer(gl.layer(stationsLayer([]), PLACES_SOURCE));
      m.addLayer(gl.layer(stationsLabelLayer([]), PLACES_SOURCE));
      m.addLayer(gl.layer(selectedLayer(null), PLACES_SOURCE));

      m.addSource(ME_SOURCE, { type: 'geojson', data: EMPTY });
      m.addLayer(gl.layer(meHaloLayer, ME_SOURCE));
      m.addLayer(gl.layer(meDotLayer, ME_SOURCE));
      ready.current = true;
      pendingSync.current?.();
      pendingSync.current = null;
    });

    // Un único click: si hay estación y parada bajo el puntero, gana la estación (está encima).
    const PRESSABLE = ['stations', 'stops'];
    m.on('click', (e) => {
      const [hit] = m.queryRenderedFeatures(e.point, { layers: PRESSABLE });
      const key = hit?.properties?.key;
      if (key) emitPlacePress(String(key));
      else emitMapPress();
    });
    for (const layer of PRESSABLE) {
      m.on('mouseenter', layer, () => (m.getCanvas().style.cursor = 'pointer'));
      m.on('mouseleave', layer, () => (m.getCanvas().style.cursor = ''));
    }
    m.on('moveend', () => {
      const c = m.getCenter();
      emitCenterChange([c.lng, c.lat]);
    });

    return () => {
      ready.current = false;
      m.remove();
      map.current = null;
    };
  }, []);

  // Sincroniza modos, selección y ubicación una vez que el estilo está cargado.
  const modesKey = modes.join(',');
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const visibleModes = modesKey ? (modesKey.split(',') as typeof modes) : [];
    const apply = () => {
      m.setFilter('stops', gl.filter(filters.stops(visibleModes)));
      m.setFilter('stops-label', gl.filter(filters.stops(visibleModes)));
      m.setFilter('stations', gl.filter(filters.stations(visibleModes)));
      m.setFilter('stations-label', gl.filter(filters.stations(visibleModes)));
      m.setFilter('selected', gl.filter(filters.selected(selectedKey)));
      m.setFilter('selected-halo', gl.filter(filters.selected(selectedKey)));
      (m.getSource(ME_SOURCE) as GeoJSONSource | undefined)?.setData(
        userLocation ? { type: 'Point', coordinates: userLocation } : EMPTY,
      );
    };
    if (ready.current) apply();
    else pendingSync.current = apply;
  }, [selectedKey, userLocation, modesKey]);

  // La atribución va arriba a la derecha, por debajo de la barra de búsqueda y los chips.
  useEffect(() => {
    const corner = map.current?.getContainer().querySelector<HTMLElement>('.maplibregl-ctrl-top-right');
    if (corner) corner.style.top = `${topInset}px`;
  }, [topInset]);

  return <div ref={container} style={{ position: 'absolute', inset: 0, background: '#0D0F12' }} />;
}
