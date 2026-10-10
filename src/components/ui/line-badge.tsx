import { Text, View } from 'react-native';

import { fgvLineByLine } from '@/data/fgv';
import { palette } from '@/theme/palette';

type Props = { line: string; operator?: 'emt' | 'fgv'; size?: 'sm' | 'md' | 'lg' };

const SIZES = {
  sm: { h: 20, minW: 26, px: 6, text: 11, radius: 6 },
  md: { h: 26, minW: 34, px: 8, text: 13, radius: 8 },
  lg: { h: 40, minW: 52, px: 12, text: 18, radius: 12 },
};

/** Texto oscuro sobre colores claros (L1 amarilla, L10 verde claro…). */
function textOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 170 ? '#111' : '#fff';
}

function colorFor(line: string, operator: 'emt' | 'fgv'): string {
  if (operator === 'fgv') return fgvLineByLine.get(line)?.color ?? palette.metro.DEFAULT;
  // EMT: nocturnas (N*) en violeta y las C* (centro) en turquesa.
  return line.startsWith('N') ? '#7B61FF' : line.startsWith('C') ? '#14B8C4' : palette.emt.DEFAULT;
}

/** Pastilla de línea. EMT: rectángulo redondeado; Metrovalencia/TRAM: círculo, como en su señalética. */
export function LineBadge({ line, operator = 'emt', size = 'md' }: Props) {
  const s = SIZES[size];
  const bg = colorFor(line, operator);
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
