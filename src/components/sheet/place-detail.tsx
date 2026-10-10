import Ionicons from '@expo/vector-icons/Ionicons';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LineBadge } from '@/components/ui/line-badge';
import { Text } from '@/components/ui/text';
import { routeByLine } from '@/data/emt';
import { fgvLineByLine } from '@/data/fgv';
import type { Place } from '@/data/places';
import { formatDistance, walkingMinutes } from '@/lib/geo';
import { MODES } from '@/theme/modes';
import { palette } from '@/theme/palette';

import { EmtArrivalsCard, FgvDeparturesCard } from './live-card';

type Props = { place: Place; meters: number | null; onClose(): void; onDirections(): void };

const lineName = (place: Place, line: string) =>
  (place.operator === 'emt' ? routeByLine.get(line)?.name : fgvLineByLine.get(line)?.name) ?? `Línea ${line}`;

export function PlaceDetail({ place, meters, onClose, onDirections }: Props) {
  const insets = useSafeAreaInsets();
  const mode = MODES[place.mode];
  const subtitle = place.operator === 'emt' ? `${mode.placeNoun} ${place.id}` : mode.operatorName;

  return (
    <BottomSheetScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
      <Animated.View entering={FadeIn.duration(250)} style={{ paddingHorizontal: 20, paddingTop: 4 }}>
        {/* Cabecera */}
        <View className="flex-row items-start gap-4">
          <View className="h-14 w-14 items-center justify-center rounded-[18px]" style={{ backgroundColor: mode.color }}>
            <Ionicons name={mode.icon} size={26} color={mode.onColor} />
          </View>
          <View className="flex-1 gap-1 pt-0.5">
            <Text className="font-jk-bold text-[21px] leading-[26px]" numberOfLines={2}>
              {place.name}
            </Text>
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className="font-jk-medium text-[13px] text-fg-muted">{subtitle}</Text>
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
          <Pressable
            onPress={onClose}
            accessibilityLabel="Cerrar"
            className="h-9 w-9 items-center justify-center rounded-full bg-white/10 active:bg-white/20">
            <Ionicons name="close" size={18} color={palette.fg.DEFAULT} />
          </Pressable>
        </View>

        {/* Cómo llegar */}
        <Pressable
          onPress={onDirections}
          className="mt-5 h-12 flex-row items-center justify-center gap-2 rounded-2xl bg-accent active:opacity-80">
          <Ionicons name="navigate" size={18} color={palette.accent.ink} />
          <Text className="font-jk-bold text-[15px]" style={{ color: palette.accent.ink }}>
            Cómo llegar
          </Text>
        </Pressable>

        {/* Tiempo real */}
        <Animated.View entering={FadeInDown.delay(60).duration(350)} style={{ marginTop: 24 }}>
          {place.operator === 'emt' ? (
            <EmtArrivalsCard stopId={place.id} lines={place.lines} />
          ) : (
            <FgvDeparturesCard stationId={place.id} lines={place.lines} />
          )}
        </Animated.View>

        {/* Líneas */}
        <Animated.View entering={FadeInDown.delay(120).duration(350)} style={{ marginTop: 24 }}>
          <Text className="mb-2 font-jk-bold text-[13px] uppercase tracking-[1.2px] text-fg-muted">
            {place.lines.length} {place.lines.length === 1 ? 'línea' : 'líneas'}
          </Text>
          <View className="overflow-hidden rounded-3xl border border-line bg-surface-raised">
            {place.lines.map((l, i) => (
              <View key={l} className={`flex-row items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-line' : ''}`}>
                <LineBadge line={l} operator={place.operator} />
                <Text className="flex-1 font-jk-medium text-[14px]" numberOfLines={1}>
                  {lineName(place, l)}
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
