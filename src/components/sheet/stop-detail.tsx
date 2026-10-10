import Ionicons from '@expo/vector-icons/Ionicons';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LineBadge } from '@/components/ui/line-badge';
import { Text } from '@/components/ui/text';
import { routeByLine, type Stop } from '@/data/emt';
import { formatDistance, walkingMinutes } from '@/lib/geo';
import { palette } from '@/theme/palette';

import { Skeleton } from './skeleton';

type Props = { stop: Stop; meters: number | null; onClose(): void };

export function StopDetail({ stop, meters, onClose }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <BottomSheetScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
      <Animated.View entering={FadeIn.duration(250)} className="px-5 pt-1">
        {/* Cabecera */}
        <View className="flex-row items-start gap-4">
          <View className="h-14 w-14 items-center justify-center rounded-[18px] bg-emt">
            <Ionicons name="bus" size={26} color="#fff" />
          </View>
          <View className="flex-1 gap-1 pt-0.5">
            <Text className="font-jk-bold text-[21px] leading-[26px]" numberOfLines={2}>
              {stop.name}
            </Text>
            <View className="flex-row items-center gap-2">
              <Text className="font-jk-medium text-[13px] text-fg-muted">Parada {stop.id}</Text>
              {meters != null && (
                <>
                  <View className="h-1 w-1 rounded-full bg-fg-subtle" />
                  <Ionicons name="walk" size={13} color={palette.fg.muted} />
                  <Text className="font-jk-medium text-[13px] text-fg-muted">
                    {walkingMinutes(meters)} min · {formatDistance(meters)}
                  </Text>
                </>
              )}
            </View>
          </View>
          <Pressable onPress={onClose} accessibilityLabel="Cerrar" className="h-9 w-9 items-center justify-center rounded-full bg-white/10 active:bg-white/20">
            <Ionicons name="close" size={18} color={palette.fg.DEFAULT} />
          </Pressable>
        </View>

        {/* Llegadas: hueco reservado para el tiempo real (Edge Function poll-emt). */}
        <Animated.View entering={FadeInDown.delay(60).duration(350)} className="mt-6 overflow-hidden rounded-3xl border border-line bg-surface-raised">
          <View className="flex-row items-center justify-between px-4 pb-2 pt-4">
            <Text className="font-jk-bold text-[15px]">Próximas llegadas</Text>
            <View className="flex-row items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1">
              <View className="h-1.5 w-1.5 rounded-full bg-accent" />
              <Text className="font-jk-semibold text-[11px] text-accent">EN DIRECTO · PRONTO</Text>
            </View>
          </View>
          {stop.lines.slice(0, 3).map((l, i) => (
            <View key={l} className={`flex-row items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-line' : ''}`}>
              <LineBadge line={l} />
              <View className="flex-1 gap-1.5">
                <Skeleton className="h-3" style={{ width: '70%', height: 12 }} />
                <Skeleton style={{ width: '40%', height: 10 }} />
              </View>
              <Skeleton style={{ width: 44, height: 22 }} />
            </View>
          ))}
          <Text className="px-4 pb-4 pt-1 text-[12px] leading-[17px] text-fg-subtle">
            Los tiempos de llegada se conectarán con la EMT desde el backend en el siguiente paso.
          </Text>
        </Animated.View>

        {/* Líneas */}
        <Animated.View entering={FadeInDown.delay(120).duration(350)} className="mt-6">
          <Text className="mb-2 font-jk-bold text-[13px] uppercase tracking-[1.2px] text-fg-muted">
            {stop.lines.length} {stop.lines.length === 1 ? 'línea' : 'líneas'}
          </Text>
          <View className="overflow-hidden rounded-3xl border border-line bg-surface-raised">
            {stop.lines.map((l, i) => (
              <View key={l} className={`flex-row items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-line' : ''}`}>
                <LineBadge line={l} />
                <Text className="flex-1 font-jk-medium text-[14px]" numberOfLines={1}>
                  {routeByLine.get(l)?.name ?? `Línea ${l}`}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={palette.fg.subtle} />
              </View>
            ))}
          </View>
        </Animated.View>
      </Animated.View>
    </BottomSheetScrollView>
  );
}
