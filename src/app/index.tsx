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
import { PlaceDetail } from '@/components/sheet/place-detail';
import { TopBar } from '@/components/top-bar';
import { ALL_MODES, placeByKey, places, type Mode, type Place } from '@/data/places';
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
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [modes, setModes] = useState<Mode[]>(ALL_MODES);

  const selected = selectedKey ? placeByKey.get(selectedKey) ?? null : null;
  const origin = location ?? center;
  const visiblePlaces = useMemo(() => places.filter((p) => modes.includes(p.mode)), [modes]);
  const nearby = useMemo(() => nearest(visiblePlaces, origin, NEARBY_COUNT), [visiblePlaces, origin]);
  const within500 = useMemo(
    () => visiblePlaces.filter((p) => distance(origin, [p.lon, p.lat]) <= 500).length,
    [visiblePlaces, origin],
  );

  const toggleMode = useCallback((mode: Mode) => {
    setModes((m) => (m.includes(mode) ? m.filter((x) => x !== mode) : ALL_MODES.filter((x) => x === mode || m.includes(x))));
  }, []);

  // Primera ubicación conocida → centramos el mapa una sola vez.
  const centeredOnUser = useRef(false);
  useEffect(() => {
    if (location && !centeredOnUser.current) {
      centeredOnUser.current = true;
      map.current?.flyTo(location, { zoom: 15.5, bottomInset: height * 0.3 });
    }
  }, [location, height]);

  const selectPlace = useCallback(
    (place: Place) => {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedKey(place.key);
      sheet.current?.snapToIndex(1);
      map.current?.flyTo([place.lon, place.lat], { zoom: 16.5, bottomInset: height * 0.55 });
    },
    [height],
  );

  const clearSelection = useCallback(() => {
    setSelectedKey(null);
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
        selectedKey={selectedKey}
        modes={modes}
        topInset={insets.top + TOP_BAR_HEIGHT}
        userLocation={location}
        onPlacePress={(key) => {
          const p = placeByKey.get(key);
          if (p) selectPlace(p);
        }}
        onMapPress={selectedKey ? clearSelection : undefined}
        onCenterChange={setCenter}
      />

      <TopBar modes={modes} onToggleMode={toggleMode} />
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
          <PlaceDetail
            key={selected.key}
            place={selected}
            meters={location ? distance(location, [selected.lon, selected.lat]) : null}
            onClose={clearSelection}
          />
        ) : (
          <NearbyList items={nearby} within500={within500} fromUser={!!location} onSelect={selectPlace} />
        )}
      </BottomSheet>
    </View>
  );
}
