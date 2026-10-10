import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, useWindowDimensions } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { Glass } from '@/components/ui/glass';
import { palette } from '@/theme/palette';

type Props = {
  /** `animatedPosition` del bottom sheet: distancia del borde superior del sheet al top de la pantalla. */
  sheetPosition: SharedValue<number>;
  onLocate(): void;
  active: boolean;
};

/** Botón "mi ubicación" que viaja pegado al borde del sheet y se desvanece al expandirlo. */
export function MapFab({ sheetPosition, onLocate, active }: Props) {
  const { height } = useWindowDimensions();

  const style = useAnimatedStyle(() => {
    const top = sheetPosition.value;
    return {
      transform: [{ translateY: top - 64 }],
      opacity: interpolate(top, [height * 0.35, height * 0.5], [0, 1], Extrapolation.CLAMP),
    };
  });

  return (
    <Animated.View className="absolute right-4 top-0" style={style} pointerEvents="box-none">
      <Pressable onPress={onLocate} accessibilityLabel="Centrar en mi ubicación" className="active:scale-95">
        <Glass className="h-12 w-12 items-center justify-center rounded-full">
          <Ionicons name={active ? 'navigate' : 'navigate-outline'} size={20} color={active ? palette.accent.DEFAULT : palette.fg.DEFAULT} />
        </Glass>
      </Pressable>
    </Animated.View>
  );
}
