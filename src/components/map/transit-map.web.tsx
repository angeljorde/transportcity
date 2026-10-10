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
import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';

import { stopsGeoJSON } from '@/data/emt';
import { VALENCIA_CENTER } from '@/lib/geo';
import { darkMapStyle } from '@/theme/map-style';

import {
  meDotLayer,
  meHaloLayer,
  ME_SOURCE,
  selectedFilter,
  selectedHaloLayer,
  selectedLayer,
  stopsLabelLayer,
  stopsLayer,
  STOPS_SOURCE,
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
  selectedStopId,
  topInset,
  userLocation,
  onStopPress,
  onMapPress,
  onCenterChange,
}: TransitMapProps & { ref?: Ref<TransitMapHandle> }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const ready = useRef(false);
  // Última sincronización pendiente si llega antes de que el estilo termine de cargar.
  const pendingSync = useRef<(() => void) | null>(null);

  // Los handlers cambian en cada render; los leemos desde una ref para no re-registrar eventos.
  const handlers = useRef({ onStopPress, onMapPress, onCenterChange });
  handlers.current = { onStopPress, onMapPress, onCenterChange };

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
      m.addSource(STOPS_SOURCE, { type: 'geojson', data: stopsGeoJSON });
      m.addLayer(gl.layer(selectedHaloLayer(null), STOPS_SOURCE));
      m.addLayer(gl.layer(stopsLayer, STOPS_SOURCE));
      m.addLayer(gl.layer(stopsLabelLayer, STOPS_SOURCE));
      m.addLayer(gl.layer(selectedLayer(null), STOPS_SOURCE));

      m.addSource(ME_SOURCE, { type: 'geojson', data: EMPTY });
      m.addLayer(gl.layer(meHaloLayer, ME_SOURCE));
      m.addLayer(gl.layer(meDotLayer, ME_SOURCE));
      ready.current = true;
      pendingSync.current?.();
      pendingSync.current = null;
    });

    let stopClicked = false;
    m.on('click', 'stops', (e) => {
      const id = e.features?.[0]?.properties?.id;
      if (id) {
        stopClicked = true;
        handlers.current.onStopPress(String(id));
      }
    });
    m.on('click', () => {
      if (!stopClicked) handlers.current.onMapPress?.();
      stopClicked = false;
    });
    m.on('mouseenter', 'stops', () => (m.getCanvas().style.cursor = 'pointer'));
    m.on('mouseleave', 'stops', () => (m.getCanvas().style.cursor = ''));
    m.on('moveend', () => {
      const c = m.getCenter();
      handlers.current.onCenterChange?.([c.lng, c.lat]);
    });

    return () => {
      ready.current = false;
      m.remove();
      map.current = null;
    };
  }, []);

  // Sincroniza la selección y la ubicación una vez que el estilo está cargado.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const apply = () => {
      m.setFilter('stops-selected', gl.filter(selectedFilter(selectedStopId)));
      m.setFilter('stops-selected-halo', gl.filter(selectedFilter(selectedStopId)));
      (m.getSource(ME_SOURCE) as GeoJSONSource | undefined)?.setData(
        userLocation ? { type: 'Point', coordinates: userLocation } : EMPTY,
      );
    };
    if (ready.current) apply();
    else pendingSync.current = apply;
  }, [selectedStopId, userLocation]);

  // La atribución va arriba a la derecha, por debajo de la barra de búsqueda y los chips.
  useEffect(() => {
    const corner = map.current?.getContainer().querySelector<HTMLElement>('.maplibregl-ctrl-top-right');
    if (corner) corner.style.top = `${topInset}px`;
  }, [topInset]);

  return <div ref={container} style={{ position: 'absolute', inset: 0, background: '#0D0F12' }} />;
}
