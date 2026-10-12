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
import { VEHICLE_ICON_PATHS, type VehicleIcon } from '@/theme/vehicle-icons';

import {
  filters,
  meDotLayer,
  meHaloLayer,
  ME_SOURCE,
  PLACES_SOURCE,
  routeLayers,
  ROUTE_SOURCE,
  VEHICLE_ICON_SIZE,
  vehicleLayers,
  VEHICLES_SOURCE,
  selectedHaloLayer,
  selectedLayer,
  stationsLabelLayer,
  stationsLayer,
  stopsLabelLayer,
  stopsLayer,
} from './layers';
import type { TransitMapHandle, TransitMapProps } from './types';
import { vehicleImage } from './vehicle-images';

// Worker copiado a public/ en postinstall (ver scripts/copy-maplibre-worker.mjs).
setWorkerUrl('/maplibre-gl-worker.mjs');

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
const VEHICLES_MAX_DELAY = 6_000;

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
  route,
  vehicles,
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
    fitBounds(bounds, padding) {
      // El padding de flyTo() anteriores persiste y se sumaría al de fitBounds: lo reiniciamos.
      map.current?.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
      map.current?.fitBounds(bounds, { padding, duration: 900, essential: true, maxZoom: 17 });
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

      m.addSource(ROUTE_SOURCE, { type: 'geojson', data: EMPTY });
      for (const l of routeLayers) m.addLayer(gl.layer(l, ROUTE_SOURCE));

      for (const name of Object.keys(VEHICLE_ICON_PATHS) as VehicleIcon[]) m.addImage(name, vehicleImage(name), { pixelRatio: 2 });
      m.addSource(VEHICLES_SOURCE, { type: 'geojson', data: EMPTY });
      for (const l of vehicleLayers(VEHICLE_ICON_SIZE.web)) m.addLayer(gl.layer(l, VEHICLES_SOURCE));

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
      (m.getSource(ROUTE_SOURCE) as GeoJSONSource | undefined)?.setData(route ?? EMPTY);
    };
    if (ready.current) apply();
    else pendingSync.current = apply;
  }, [selectedKey, userLocation, modesKey, route]);

  // Vehículos: se actualizan cada pocos segundos. Si el mapa aún está cargando teselas,
  // esperamos a que quede inactivo (actualizar la fuente sin parar impedía terminar de pintar),
  // pero nunca más de VEHICLES_MAX_DELAY: los vehículos no pueden quedarse sin dibujar.
  const vehiclesAppliedAt = useRef(0);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current) return;
    const apply = () => {
      vehiclesAppliedAt.current = Date.now();
      (m.getSource(VEHICLES_SOURCE) as GeoJSONSource | undefined)?.setData(vehicles ?? EMPTY);
    };
    if (m.loaded() || Date.now() - vehiclesAppliedAt.current > VEHICLES_MAX_DELAY) apply();
    else {
      m.once('idle', apply);
      return () => {
        m.off('idle', apply);
      };
    }
  }, [vehicles]);

  // La atribución va arriba a la derecha, por debajo de la barra de búsqueda y los chips.
  useEffect(() => {
    const corner = map.current?.getContainer().querySelector<HTMLElement>('.maplibregl-ctrl-top-right');
    if (corner) corner.style.top = `${topInset}px`;
  }, [topInset]);

  // zIndex 0 crea un contexto de apilado: los controles de maplibre (z-index 2) no asoman por encima de la UI.
  return <div ref={container} style={{ position: 'absolute', inset: 0, zIndex: 0, background: '#0D0F12' }} />;
}
