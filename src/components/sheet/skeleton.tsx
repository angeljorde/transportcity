import { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

/** Bloque "esqueleto" con pulso suave mientras no hay datos. */
export function Skeleton({ style, className }: { style?: ViewStyle; className?: string }) {
  const o = useSharedValue(0.35);
  useEffect(() => {
    o.value = withRepeat(withTiming(0.8, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [o]);
  const anim = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View style={[anim, style]}>
      <View className={`rounded-md bg-white/10 ${className ?? ''}`} style={{ flex: 1 }} />
    </Animated.View>
  );
}
