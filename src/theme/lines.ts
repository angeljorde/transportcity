import { fgvLineByLine } from '@/data/fgv';

import { palette } from './palette';

/** Color de una línea: oficial en Metrovalencia; en EMT, rojo (N* nocturnas en violeta, C* en turquesa). */
export function lineColor(line: string, operator: 'emt' | 'fgv'): string {
  if (operator === 'fgv') return fgvLineByLine.get(line)?.color ?? palette.metro.DEFAULT;
  return line.startsWith('N') ? '#7B61FF' : line.startsWith('C') ? '#14B8C4' : palette.emt.DEFAULT;
}

/** Texto oscuro sobre colores claros (L1 amarilla, L10 verde claro…). */
export function textOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 170 ? '#111' : '#fff';
}

/** Orden natural de líneas: 1, 2, 10, C1… */
export const byLineOrder = (a: string, b: string) => a.localeCompare(b, 'es', { numeric: true });
