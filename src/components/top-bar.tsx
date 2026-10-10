import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass } from '@/components/ui/glass';
import { Text } from '@/components/ui/text';
import { palette } from '@/theme/palette';

type Mode = { key: string; label: string; color: string; icon: keyof typeof Ionicons.glyphMap; ready: boolean };

const MODES: Mode[] = [
  { key: 'emt', label: 'Bus EMT', color: palette.emt.DEFAULT, icon: 'bus', ready: true },
  { key: 'metro', label: 'Metro', color: palette.metro.DEFAULT, icon: 'subway', ready: false },
  { key: 'tram', label: 'Tranvía', color: palette.tram.DEFAULT, icon: 'train', ready: false },
  { key: 'bike', label: 'Valenbisi', color: palette.bike.DEFAULT, icon: 'bicycle', ready: false },
];

const tap = () => Platform.OS !== 'web' && Haptics.selectionAsync();

export function TopBar() {
  const insets = useSafeAreaInsets();

  return (
    <Animated.View
      entering={FadeInDown.duration(500).springify().damping(18)}
      className="absolute left-0 right-0 top-0"
      style={{ paddingTop: insets.top + 8 }}
      pointerEvents="box-none">
      <View className="px-4" pointerEvents="box-none">
        <Glass className="flex-row items-center rounded-full py-1.5 pl-5 pr-1.5" style={shadow}>
          <Pressable className="flex-1 flex-row items-center gap-3 py-2" onPress={tap} accessibilityRole="search">
            <Ionicons name="search" size={18} color={palette.fg.DEFAULT} />
            <Text className="font-jk-semibold text-[16px]">¿A dónde vas?</Text>
          </Pressable>
          <View className="mr-1 h-6 w-px bg-line-strong" />
          <Pressable
            onPress={tap}
            className="h-10 flex-row items-center gap-1.5 rounded-full bg-white/5 px-3 active:bg-white/10"
            accessibilityLabel="Salir ahora">
            <Ionicons name="time-outline" size={16} color={palette.fg.DEFAULT} />
            <Text className="font-jk-semibold text-[13px]">Ahora</Text>
            <Ionicons name="chevron-down" size={14} color={palette.fg.muted} />
          </Pressable>
        </Glass>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 px-4 pt-3 pb-2"
        className="flex-grow-0">
        {MODES.map((m) => (
          <Pressable key={m.key} onPress={tap} disabled={!m.ready}>
            <Glass className="h-9 flex-row items-center gap-2 rounded-full pl-2.5 pr-3.5" style={!m.ready && { opacity: 0.55 }}>
              <View className="h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: m.color }}>
                <Ionicons name={m.icon} size={11} color="#fff" />
              </View>
              <Text className="font-jk-semibold text-[13px]">{m.label}</Text>
              {!m.ready && <Text className="font-jk-medium text-[10px] uppercase tracking-wider text-fg-muted">Pronto</Text>}
            </Glass>
          </Pressable>
        ))}
      </ScrollView>
    </Animated.View>
  );
}

const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.45,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 10 },
  elevation: 12,
};
