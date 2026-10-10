import { Camera, GeoJSONSource, Layer, Map, type CameraRef } from '@maplibre/maplibre-react-native';
import { useImperativeHandle, useMemo, useRef, type Ref } from 'react';
import { StyleSheet } from 'react-native';

import { placesGeoJSON } from '@/data/places';
import { VALENCIA_CENTER } from '@/lib/geo';
import { darkMapStyle } from '@/theme/map-style';

import {
  meDotLayer,
  meHaloLayer,
  ME_SOURCE,
  PLACES_SOURCE,
  routeLayers,
  ROUTE_SOURCE,
  selectedHaloLayer,
  selectedLayer,
  stationsLabelLayer,
  stationsLayer,
  stopsLabelLayer,
  stopsLayer,
} from './layers';
import type { TransitMapHandle, TransitMapProps } from './types';

export function NativeMap({
  ref,
  selectedKey,
  modes,
  topInset,
  userLocation,
  route,
  onPlacePress,
  onMapPress,
  onCenterChange,
}: TransitMapProps & { ref?: Ref<TransitMapHandle> }) {
  const camera = useRef<CameraRef>(null);

  useImperativeHandle(ref, () => ({
    flyTo(center, { zoom = 16, bottomInset = 0 } = {}) {
      camera.current?.flyTo({ center, zoom, padding: { bottom: bottomInset }, duration: 900 });
    },
    fitBounds(bounds, padding) {
      camera.current?.fitBounds(bounds, { padding, duration: 900 });
    },
  }));

  const me = useMemo(
    () => (userLocation ? { type: 'Point' as const, coordinates: userLocation } : null),
    [userLocation],
  );

  return (
    <Map
      style={StyleSheet.absoluteFill}
      mapStyle={darkMapStyle}
      logo={false}
      compass={false}
      attributionPosition={{ top: topInset, right: 8 }}
      touchPitch={false}
      onPress={() => onMapPress?.()}
      onRegionDidChange={(e) => onCenterChange?.(e.nativeEvent.center)}>
      <Camera ref={camera} initialViewState={{ center: VALENCIA_CENTER, zoom: 13.6 }} minZoom={10} maxZoom={19} />

      <GeoJSONSource
        id={PLACES_SOURCE}
        data={placesGeoJSON}
        hitbox={{ top: 12, right: 12, bottom: 12, left: 12 }}
        onPress={(e) => {
          e.stopPropagation();
          // Si hay estación y parada bajo el dedo, gana la estación (es la que se ve encima).
          const features = e.nativeEvent.features;
          const hit = features.find((f) => f.properties?.mode !== 'emt') ?? features[0];
          const key = hit?.properties?.key;
          if (key) onPlacePress(String(key));
        }}>
        <Layer {...selectedHaloLayer(selectedKey)} />
        <Layer {...stopsLayer(modes)} />
        <Layer {...stopsLabelLayer(modes)} />
        <Layer {...stationsLayer(modes)} />
        <Layer {...stationsLabelLayer(modes)} />
        <Layer {...selectedLayer(selectedKey)} />
      </GeoJSONSource>

      {route && (
        <GeoJSONSource id={ROUTE_SOURCE} data={route}>
          {routeLayers.map((l) => (
            <Layer key={l.id} {...l} />
          ))}
        </GeoJSONSource>
      )}

      {me && (
        <GeoJSONSource id={ME_SOURCE} data={me}>
          <Layer {...meHaloLayer} />
          <Layer {...meDotLayer} />
        </GeoJSONSource>
      )}
    </Map>
  );
}
