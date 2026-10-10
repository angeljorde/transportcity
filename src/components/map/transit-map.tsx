import { Camera, GeoJSONSource, Layer, Map, type CameraRef } from '@maplibre/maplibre-react-native';
import { useImperativeHandle, useMemo, useRef, type Ref } from 'react';
import { StyleSheet } from 'react-native';

import { stopsGeoJSON } from '@/data/emt';
import { VALENCIA_CENTER } from '@/lib/geo';
import { darkMapStyle } from '@/theme/map-style';

import {
  meDotLayer,
  meHaloLayer,
  ME_SOURCE,
  selectedHaloLayer,
  selectedLayer,
  stopsLabelLayer,
  stopsLayer,
  STOPS_SOURCE,
} from './layers';
import type { TransitMapHandle, TransitMapProps } from './types';

export function TransitMap({
  ref,
  selectedStopId,
  topInset,
  userLocation,
  onStopPress,
  onMapPress,
  onCenterChange,
}: TransitMapProps & { ref?: Ref<TransitMapHandle> }) {
  const camera = useRef<CameraRef>(null);

  useImperativeHandle(ref, () => ({
    flyTo(center, { zoom = 16, bottomInset = 0 } = {}) {
      camera.current?.flyTo({ center, zoom, padding: { bottom: bottomInset }, duration: 900 });
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
        id={STOPS_SOURCE}
        data={stopsGeoJSON}
        hitbox={{ top: 12, right: 12, bottom: 12, left: 12 }}
        onPress={(e) => {
          e.stopPropagation();
          const id = e.nativeEvent.features[0]?.properties?.id;
          if (id) onStopPress(String(id));
        }}>
        <Layer {...selectedHaloLayer(selectedStopId)} />
        <Layer {...stopsLayer} />
        <Layer {...stopsLabelLayer} />
        <Layer {...selectedLayer(selectedStopId)} />
      </GeoJSONSource>

      {me && (
        <GeoJSONSource id={ME_SOURCE} data={me}>
          <Layer {...meHaloLayer} />
          <Layer {...meDotLayer} />
        </GeoJSONSource>
      )}
    </Map>
  );
}
