import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import type { Stop } from '@/data/emt';

import { StopRow } from './stop-row';

type Nearby = { item: Stop; meters: number };

type Props = {
  items: Nearby[];
  fromUser: boolean;
  onSelect(stop: Stop): void;
};

export function NearbyList({ items, fromUser, onSelect }: Props) {
  const insets = useSafeAreaInsets();
  const within500 = items.filter((i) => i.meters <= 500).length;

  return (
    <BottomSheetFlatList
      data={items}
      keyExtractor={(i: Nearby) => i.item.id}
      contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: insets.bottom + 24 }}
      ListHeaderComponent={
        <View className="px-3 pb-2 pt-1">
          <Text className="font-jk-bold text-[22px] tracking-tight">{fromUser ? 'Cerca de ti' : 'En esta zona'}</Text>
          <Text className="mt-0.5 font-jk-medium text-[13px] text-fg-muted">
            {within500 > 0
              ? `${within500} ${within500 === 1 ? 'parada' : 'paradas'} de EMT a menos de 500 m`
              : 'Paradas de EMT más próximas'}
          </Text>
        </View>
      }
      renderItem={({ item }: { item: Nearby }) => (
        <StopRow stop={item.item} meters={item.meters} onPress={() => onSelect(item.item)} />
      )}
    />
  );
}
