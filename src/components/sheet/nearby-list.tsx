import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import type { Place } from '@/data/places';

import { PlaceRow } from './stop-row';

type Nearby = { item: Place; meters: number };

type Props = {
  items: Nearby[];
  /** Paradas/estaciones a menos de 500 m del origen (sobre todas, no solo las listadas). */
  within500: number;
  fromUser: boolean;
  onSelect(place: Place): void;
};

export function NearbyList({ items, within500, fromUser, onSelect }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <BottomSheetFlatList
      data={items}
      keyExtractor={(i: Nearby) => i.item.key}
      contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: insets.bottom + 24 }}
      ListHeaderComponent={
        <View className="px-3 pb-2 pt-1">
          <Text className="font-jk-bold text-[22px] tracking-tight">{fromUser ? 'Cerca de ti' : 'En esta zona'}</Text>
          <Text className="mt-0.5 font-jk-medium text-[13px] text-fg-muted">
            {within500 > 0
              ? `${within500} ${within500 === 1 ? 'parada' : 'paradas'} a menos de 500 m`
              : 'Paradas y estaciones más próximas'}
          </Text>
        </View>
      }
      ListEmptyComponent={
        <Text className="px-3 py-6 text-center text-[13px] text-fg-muted">Activa algún modo de transporte arriba.</Text>
      }
      renderItem={({ item }: { item: Nearby }) => (
        <PlaceRow place={item.item} meters={item.meters} onPress={() => onSelect(item.item)} />
      )}
    />
  );
}
