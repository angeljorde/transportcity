import { Text, View } from 'react-native';

import { lineColor, textOn } from '@/theme/lines';

type Props = { line: string; operator?: 'emt' | 'fgv'; size?: 'sm' | 'md' | 'lg' };

const SIZES = {
  sm: { h: 20, minW: 26, px: 6, text: 11, radius: 6 },
  md: { h: 26, minW: 34, px: 8, text: 13, radius: 8 },
  lg: { h: 40, minW: 52, px: 12, text: 18, radius: 12 },
};

/** Pastilla de línea. EMT: rectángulo redondeado; Metrovalencia/TRAM: círculo, como en su señalética. */
export function LineBadge({ line, operator = 'emt', size = 'md' }: Props) {
  const s = SIZES[size];
  const bg = lineColor(line, operator);
  const round = operator === 'fgv';
  return (
    <View
      style={{
        height: s.h,
        minWidth: round ? s.h : s.minW,
        paddingHorizontal: round ? 4 : s.px,
        borderRadius: round ? s.h / 2 : s.radius,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text className="font-jk-xbold" style={{ fontSize: s.text, letterSpacing: -0.3, color: textOn(bg) }}>
        {line}
      </Text>
    </View>
  );
}
