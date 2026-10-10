import BottomSheet from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, useWindowDimensions, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MapFab } from '@/components/map-fab';
import { TransitMap } from '@/components/map/transit-map';
import type { TransitMapHandle } from '@/components/map/types';
import { NearbyList } from '@/components/sheet/nearby-list';
import { StopDetail } from '@/components/sheet/stop-detail';
import { TopBar } from '@/components/top-bar';
import { stopById, stops, type Stop } from '@/data/emt';
import { useUserLocation } from '@/hooks/use-user-location';
import { distance, nearest, VALENCIA_CENTER, type LngLat } from '@/lib/geo';
import { palette } from '@/theme/palette';

const SNAP_POINTS = ['32%', '58%', '92%'];
const NEARBY_COUNT = 15;
/** Alto aproximado de la barra de búsqueda + chips (ver TopBar). */
const TOP_BAR_HEIGHT = 116;

export default function MapScreen() {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const map = useRef<TransitMapHandle>(null);
  const sheet = useRef<BottomSheet>(null);
  const sheetPosition = useSharedValue(height);

  const { location, status, locate } = useUserLocation();
  const [center, setCenter] = useState<LngLat>(VALENCIA_CENTER);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = selectedId ? stopById.get(selectedId) ?? null : null;
  const origin = location ?? center;
  const nearby = useMemo(() => nearest(stops, origin, NEARBY_COUNT), [origin]);
  const within500 = useMemo(() => stops.filter((s) => distance(origin, [s.lon, s.lat]) <= 500).length, [origin]);

  // Primera ubicación conocida → centramos el mapa una sola vez.
  const centeredOnUser = useRef(false);
  useEffect(() => {
    if (location && !centeredOnUser.current) {
      centeredOnUser.current = true;
      map.current?.flyTo(location, { zoom: 15.5, bottomInset: height * 0.3 });
    }
  }, [location, height]);

  const selectStop = useCallback(
    (stop: Stop) => {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedId(stop.id);
      sheet.current?.snapToIndex(1);
      map.current?.flyTo([stop.lon, stop.lat], { zoom: 16.5, bottomInset: height * 0.55 });
    },
    [height],
  );

  const clearSelection = useCallback(() => {
    setSelectedId(null);
    sheet.current?.snapToIndex(0);
  }, []);

  const goToMe = useCallback(async () => {
    const here = location ?? (await locate());
    if (here) map.current?.flyTo(here, { zoom: 16, bottomInset: height * 0.3 });
  }, [location, locate, height]);

  return (
    <View className="flex-1 bg-ink">
      <TransitMap
        ref={map}
        selectedStopId={selectedId}
        topInset={insets.top + TOP_BAR_HEIGHT}
        userLocation={location}
        onStopPress={(id) => {
          const s = stopById.get(id);
          if (s) selectStop(s);
        }}
        onMapPress={selectedId ? clearSelection : undefined}
        onCenterChange={setCenter}
      />

      <TopBar />
      <MapFab sheetPosition={sheetPosition} onLocate={goToMe} active={status === 'granted'} />

      <BottomSheet
        ref={sheet}
        index={0}
        snapPoints={SNAP_POINTS}
        animatedPosition={sheetPosition}
        enableDynamicSizing={false}
        backgroundStyle={{ backgroundColor: palette.surface.DEFAULT, borderRadius: 28 }}
        handleIndicatorStyle={{ backgroundColor: 'rgba(255,255,255,0.22)', width: 40, height: 5 }}
        style={{ shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 30, shadowOffset: { width: 0, height: -6 }, elevation: 24 }}>
        {selected ? (
          <StopDetail
            key={selected.id}
            stop={selected}
            meters={location ? distance(location, [selected.lon, selected.lat]) : null}
            onClose={clearSelection}
          />
        ) : (
          <NearbyList items={nearby} within500={within500} fromUser={!!location} onSelect={selectStop} />
        )}
      </BottomSheet>
    </View>
  );
}
