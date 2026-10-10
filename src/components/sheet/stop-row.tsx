import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, View } from 'react-native';

import { LineBadge } from '@/components/ui/line-badge';
import { Text } from '@/components/ui/text';
import type { Place } from '@/data/places';
import { formatDistance, walkingMinutes } from '@/lib/geo';
import { MODES } from '@/theme/modes';

const MAX_BADGES = 5;

export function PlaceRow({ place, meters, onPress }: { place: Place; meters: number; onPress(): void }) {
  const extra = place.lines.length - MAX_BADGES;
  const mode = MODES[place.mode];
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-3.5 rounded-2xl px-3 py-3 active:bg-white/5">
      <View className="h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: mode.soft }}>
        <Ionicons name={mode.icon} size={20} color={mode.color} />
      </View>
      <View className="flex-1 gap-1.5">
        <Text className="font-jk-semibold text-[15px]" numberOfLines={1}>
          {place.name}
        </Text>
        <View className="flex-row flex-wrap items-center gap-1">
          {place.lines.slice(0, MAX_BADGES).map((l) => (
            <LineBadge key={l} line={l} operator={place.operator} size="sm" />
          ))}
          {extra > 0 && <Text className="ml-0.5 font-jk-semibold text-[11px] text-fg-muted">+{extra}</Text>}
        </View>
      </View>
      <View className="items-end">
        <Text className="font-jk-bold text-[15px]">{walkingMinutes(meters)}′</Text>
        <Text className="text-[11px] text-fg-muted">{formatDistance(meters)}</Text>
      </View>
    </Pressable>
  );
}
