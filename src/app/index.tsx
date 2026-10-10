import BottomSheet from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Platform, useWindowDimensions, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MapFab } from '@/components/map-fab';
import { TransitMap } from '@/components/map/transit-map';
import type { TransitMapHandle } from '@/components/map/types';
import { PlanSearch, type Endpoint } from '@/components/plan/plan-search';
import { RoutesPanel } from '@/components/plan/routes-panel';
import { NearbyList } from '@/components/sheet/nearby-list';
import { PlaceDetail } from '@/components/sheet/place-detail';
import { TopBar } from '@/components/top-bar';
import { ALL_MODES, placeByKey, places, type Mode, type Place } from '@/data/places';
import { useLiveBoardings } from '@/hooks/use-live-boardings';
import { useUserLocation } from '@/hooks/use-user-location';
import { distance, nearest, VALENCIA_CENTER, type LngLat } from '@/lib/geo';
import { drawItinerary } from '@/lib/route-geo';
import { planRoutes, type Itinerary } from '@/lib/router';
import { palette } from '@/theme/palette';

const SNAP_POINTS = ['32%', '58%', '92%'];
const NEARBY_COUNT = 15;
/** Alto aproximado de la barra de búsqueda + chips (ver TopBar). */
const TOP_BAR_HEIGHT = 116;

type Screen = 'map' | 'search' | 'routes';
const NO_MODES: Mode[] = [];

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

  // ---- planificador ----
  const [screen, setScreen] = useState<Screen>('map');
  // null = "Tu ubicación" si la hay. Guardamos la elección explícita del usuario aparte.
  const [originChoice, setOriginChoice] = useState<Endpoint | null>(null);
  const [destination, setDestination] = useState<Endpoint | null>(null);
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [selectedItId, setSelectedItId] = useState<string | null>(null);

  const me: Endpoint | null = location ? { name: 'Tu ubicación', coord: location, isMe: true } : null;
  // Si el origen es "Tu ubicación", siempre con la posición GPS más reciente.
  const origin: Endpoint | null = originChoice?.isMe ? me : (originChoice ?? me);

  const selected = selectedKey ? (placeByKey.get(selectedKey) ?? null) : null;
  const here = location ?? center;
  const visiblePlaces = useMemo(() => places.filter((p) => modes.includes(p.mode)), [modes]);
  const nearby = useMemo(() => nearest(visiblePlaces, here, NEARBY_COUNT), [visiblePlaces, here]);
  const within500 = useMemo(() => visiblePlaces.filter((p) => distance(here, [p.lon, p.lat]) <= 500).length, [visiblePlaces, here]);

  const live = useLiveBoardings(screen === 'routes' ? itineraries : []);
  const selectedIt = itineraries.find((it) => it.id === selectedItId) ?? null;
  const drawing = useMemo(
    () => (screen === 'routes' && selectedIt && origin && destination ? drawItinerary(selectedIt, origin.coord, destination.coord) : null),
    // origin cambia de identidad con cada lectura del GPS: dibujamos con la del momento de planificar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [screen, selectedIt, destination],
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

  // Encuadra la ruta elegida entre la barra superior y el sheet.
  useEffect(() => {
    if (!drawing) return;
    map.current?.fitBounds(drawing.bounds, { top: insets.top + 40, bottom: height * 0.58 + 24, left: 48, right: 48 });
  }, [drawing, height, insets.top]);

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
    const pos = location ?? (await locate());
    if (pos) map.current?.flyTo(pos, { zoom: 16, bottomInset: height * 0.3 });
  }, [location, locate, height]);

  const plan = useCallback((o: Endpoint, d: Endpoint) => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const results = planRoutes(o.coord, d.coord);
    setItineraries(results);
    setSelectedItId(results[0]?.id ?? null);
    setSelectedKey(null);
    setScreen('routes');
    sheet.current?.snapToIndex(1);
  }, []);

  const closeRoutes = useCallback(() => {
    setScreen('map');
    setItineraries([]);
    setSelectedItId(null);
    sheet.current?.snapToIndex(0);
  }, []);

  /** "Cómo llegar" desde la ficha de una parada. */
  const directionsTo = useCallback(
    (place: Place) => {
      const d: Endpoint = { name: place.name, coord: [place.lon, place.lat] };
      setDestination(d);
      if (origin) plan(origin, d);
      else setScreen('search');
    },
    [origin, plan],
  );

  // Botón atrás de Android: cierra búsqueda/rutas antes de salir de la app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen === 'search') setScreen(itineraries.length ? 'routes' : 'map');
      else if (screen === 'routes') closeRoutes();
      else if (selectedKey) clearSelection();
      else return false;
      return true;
    });
    return () => sub.remove();
  }, [screen, itineraries.length, selectedKey, closeRoutes, clearSelection]);

  return (
    <View className="flex-1 bg-ink">
      <TransitMap
        ref={map}
        selectedKey={screen === 'routes' ? null : selectedKey}
        // Con una ruta en pantalla, el mapa se centra en ella: ocultamos el resto de paradas.
        modes={screen === 'routes' ? NO_MODES : modes}
        topInset={insets.top + (screen === 'map' ? TOP_BAR_HEIGHT : 16)}
        userLocation={location}
        route={drawing?.geojson ?? null}
        onPlacePress={(key) => {
          const p = placeByKey.get(key);
          if (p && screen === 'map') selectPlace(p);
        }}
        onMapPress={selectedKey && screen === 'map' ? clearSelection : undefined}
        onCenterChange={setCenter}
      />

      {screen === 'map' && <TopBar modes={modes} onToggleMode={toggleMode} onSearch={() => setScreen('search')} />}
      {screen === 'map' && <MapFab sheetPosition={sheetPosition} onLocate={goToMe} active={status === 'granted'} />}

      <BottomSheet
        ref={sheet}
        index={0}
        snapPoints={SNAP_POINTS}
        animatedPosition={sheetPosition}
        enableDynamicSizing={false}
        backgroundStyle={{ backgroundColor: palette.surface.DEFAULT, borderRadius: 28 }}
        handleIndicatorStyle={{ backgroundColor: 'rgba(255,255,255,0.22)', width: 40, height: 5 }}
        style={{ shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 30, shadowOffset: { width: 0, height: -6 }, elevation: 24 }}>
        {screen === 'routes' && origin && destination ? (
          <RoutesPanel
            origin={origin}
            destination={destination}
            itineraries={itineraries}
            live={live}
            selectedId={selectedItId}
            onSelect={setSelectedItId}
            onEdit={() => setScreen('search')}
            onClose={closeRoutes}
          />
        ) : selected ? (
          <PlaceDetail
            key={selected.key}
            place={selected}
            meters={location ? distance(location, [selected.lon, selected.lat]) : null}
            onClose={clearSelection}
            onDirections={() => directionsTo(selected)}
          />
        ) : (
          <NearbyList items={nearby} within500={within500} fromUser={!!location} onSelect={selectPlace} />
        )}
      </BottomSheet>

      {screen === 'search' && (
        <PlanSearch
          origin={origin}
          destination={destination}
          userLocation={location}
          initialField={origin ? 'destination' : 'origin'}
          onChange={(field, value) => (field === 'origin' ? setOriginChoice(value) : setDestination(value))}
          onSwap={() => {
            const o = origin;
            setOriginChoice(destination);
            setDestination(o);
          }}
          onClose={() => setScreen(itineraries.length ? 'routes' : 'map')}
          onSubmit={plan}
        />
      )}
    </View>
  );
}
