import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass } from '@/components/ui/glass';
import { Text } from '@/components/ui/text';
import { ALL_MODES, type Mode } from '@/data/places';
import { MODES } from '@/theme/modes';
import { palette } from '@/theme/palette';

const tap = () => Platform.OS !== 'web' && Haptics.selectionAsync();

type Props = { modes: Mode[]; onToggleMode(mode: Mode): void; onSearch(): void; onSaved(): void };

export function TopBar({ modes, onToggleMode, onSearch, onSaved }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Animated.View
      entering={FadeInDown.duration(500).springify().damping(18)}
      style={{ position: 'absolute', left: 0, right: 0, top: 0, paddingTop: insets.top + 8 }}
      pointerEvents="box-none">
      <View className="px-4" pointerEvents="box-none">
        <Glass className="flex-row items-center rounded-full py-1.5 pl-5 pr-1.5" style={shadow}>
          <Pressable
            className="flex-1 flex-row items-center gap-3 py-2"
            onPress={() => {
              tap();
              onSearch();
            }}
            accessibilityRole="search">
            <Ionicons name="search" size={18} color={palette.fg.DEFAULT} />
            <Text className="font-jk-semibold text-[16px]">¿A dónde vas?</Text>
          </Pressable>
          <View className="mr-1 h-6 w-px bg-line-strong" />
          <Pressable
            onPress={() => {
              tap();
              onSaved();
            }}
            className="h-10 flex-row items-center gap-1.5 rounded-full bg-white/5 px-3 active:bg-white/10"
            accessibilityLabel="Mis rutas">
            <Ionicons name="bookmark" size={15} color={palette.accent.DEFAULT} />
            <Text className="font-jk-semibold text-[13px]">Mis rutas</Text>
          </Pressable>
        </Glass>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 px-4 pt-3 pb-2"
        className="flex-grow-0">
        {ALL_MODES.map((key) => {
          const m = MODES[key];
          const on = modes.includes(key);
          return (
            <Pressable
              key={key}
              onPress={() => {
                tap();
                onToggleMode(key);
              }}
              accessibilityRole="switch"
              accessibilityState={{ checked: on }}
              accessibilityLabel={m.label}>
              <Glass className="h-9 flex-row items-center gap-2 rounded-full pl-2.5 pr-3.5" style={on ? { borderColor: m.color + '66' } : undefined}>
                <View className="h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: on ? m.color : 'rgba(255,255,255,0.12)' }}>
                  <Ionicons name={m.icon} size={11} color={on ? m.onColor : palette.fg.muted} />
                </View>
                <Text className={`font-jk-semibold text-[13px] ${on ? '' : 'text-fg-muted'}`}>{m.label}</Text>
              </Glass>
            </Pressable>
          );
        })}
        {/* Valenbisi: siguiente fase. */}
        <Glass className="h-9 flex-row items-center gap-2 rounded-full pl-2.5 pr-3.5" style={{ opacity: 0.55 }}>
          <View className="h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: palette.bike.DEFAULT }}>
            <Ionicons name="bicycle" size={11} color="#fff" />
          </View>
          <Text className="font-jk-semibold text-[13px]">Valenbisi</Text>
          <Text className="font-jk-medium text-[10px] uppercase tracking-wider text-fg-muted">Pronto</Text>
        </Glass>
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
