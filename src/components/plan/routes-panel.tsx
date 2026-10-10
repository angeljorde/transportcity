import Ionicons from '@expo/vector-icons/Ionicons';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import type { LiveBoarding } from '@/lib/live-leg';
import type { Itinerary } from '@/lib/router';
import { palette } from '@/theme/palette';

import { ItineraryCard } from './itinerary-card';
import { ItinerarySteps } from './itinerary-steps';
import type { Endpoint } from './plan-search';

type Props = {
  origin: Endpoint;
  destination: Endpoint;
  itineraries: Itinerary[];
  live: Map<string, LiveBoarding>;
  selectedId: string | null;
  onSelect(id: string): void;
  onEdit(): void;
  onClose(): void;
};

const liveTotal = (it: Itinerary, live: Map<string, LiveBoarding>) => {
  const l = live.get(it.id);
  return l?.status === 'live' ? l.totalMin : it.totalMin;
};

export function RoutesPanel({ origin, destination, itineraries, live, selectedId, onSelect, onEdit, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState<string | null>(null);

  // Reloj que avanza solo, para que "Llegas a las…" no se quede viejo.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);

  // Con datos en directo el orden puede cambiar: el bus que "iba a tardar" puede estar a punto de pasar.
  const sorted = useMemo(() => [...itineraries].sort((a, b) => liveTotal(a, live) - liveTotal(b, live)), [itineraries, live]);
  const fastestId = sorted[0]?.id;

  return (
    <BottomSheetScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
      {/* Resumen origen → destino */}
      {/* className no se aplica a Animated.View (Reanimated): el layout va en un View interior. */}
      <Animated.View entering={FadeIn.duration(250)}>
        <View className="flex-row items-center gap-2 px-4 pb-3 pt-1">
          <Pressable onPress={onEdit} className="flex-1 flex-row items-center gap-3 rounded-2xl bg-white/5 px-3.5 py-2.5 active:bg-white/10">
            <View className="items-center">
              <View className="h-2 w-2 rounded-full bg-accent" />
              <View className="my-0.5 h-2.5 w-px bg-fg-subtle" />
              <View className="h-2 w-2 rounded-sm bg-fg" />
            </View>
            <View className="flex-1">
              <Text className="text-[12px] text-fg-muted" numberOfLines={1}>
                {origin.name}
              </Text>
              <Text className="font-jk-bold text-[15px]" numberOfLines={1}>
                {destination.name}
              </Text>
            </View>
            <Ionicons name="pencil" size={15} color={palette.fg.muted} />
          </Pressable>
          <Pressable onPress={onClose} accessibilityLabel="Cerrar rutas" className="h-11 w-11 items-center justify-center rounded-full bg-white/10 active:bg-white/20">
            <Ionicons name="close" size={20} color={palette.fg.DEFAULT} />
          </Pressable>
        </View>
      </Animated.View>

      {sorted.length === 0 ? (
        <View className="items-center px-8 py-10">
          <View className="mb-3 h-14 w-14 items-center justify-center rounded-full bg-white/5">
            <Ionicons name="git-branch-outline" size={24} color={palette.fg.muted} />
          </View>
          <Text className="text-center font-jk-bold text-[16px]">No hemos encontrado rutas</Text>
          <Text className="mt-1 text-center text-[13px] leading-[19px] text-fg-muted">
            No hay paradas a menos de 1 km de alguno de los puntos o no hay servicio a esta hora. Prueba con otro origen o destino.
          </Text>
        </View>
      ) : (
        sorted.map((it, i) => (
          <Animated.View key={it.id} entering={FadeInDown.delay(i * 50).duration(300)} layout={LinearTransition.duration(250)}>
            <ItineraryCard
              it={it}
              live={live.get(it.id)}
              selected={it.id === selectedId}
              fastest={it.id === fastestId && sorted.length > 1}
              now={now}
              onPress={() => {
                if (it.id === selectedId) setExpanded((e) => (e === it.id ? null : it.id));
                else {
                  onSelect(it.id);
                  setExpanded(null);
                }
              }}
            />
            {expanded === it.id && (
              <Animated.View entering={FadeIn.duration(200)}>
                <View className="mx-3 mb-3 rounded-3xl border border-line bg-surface-raised py-3">
                  <ItinerarySteps it={it} live={live.get(it.id)} originName={origin.name} destinationName={destination.name} now={now} />
                </View>
              </Animated.View>
            )}
            {it.id === selectedId && expanded !== it.id && (
              <Text className="-mt-1 mb-3 text-center text-[11px] text-fg-subtle">Toca otra vez para ver los pasos</Text>
            )}
          </Animated.View>
        ))
      )}

      {sorted.length > 0 && (
        <Text className="px-6 pt-2 text-center text-[11px] leading-[16px] text-fg-subtle">
          Tiempos estimados con horarios GTFS y llegadas en directo de EMT y Metrovalencia. Recorridos a pie en línea recta corregida.
        </Text>
      )}
    </BottomSheetScrollView>
  );
}
