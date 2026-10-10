import { Text, View } from 'react-native';

import { palette } from '@/theme/palette';

type Props = { line: string; size?: 'sm' | 'md' | 'lg' };

const SIZES = {
  sm: { h: 20, minW: 26, px: 6, text: 11, radius: 6 },
  md: { h: 26, minW: 34, px: 8, text: 13, radius: 8 },
  lg: { h: 40, minW: 52, px: 12, text: 18, radius: 12 },
};

/** Pastilla de línea de EMT. Las nocturnas (N*) en violeta y las C* (centro) en turquesa. */
export function LineBadge({ line, size = 'md' }: Props) {
  const s = SIZES[size];
  const color = line.startsWith('N') ? '#7B61FF' : line.startsWith('C') ? '#14B8C4' : palette.emt.DEFAULT;
  return (
    <View
      style={{
        height: s.h,
        minWidth: s.minW,
        paddingHorizontal: s.px,
        borderRadius: s.radius,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text className="font-jk-xbold text-white" style={{ fontSize: s.text, letterSpacing: -0.3 }}>
        {line}
      </Text>
    </View>
  );
}
