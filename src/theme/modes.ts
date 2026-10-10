import type Ionicons from '@expo/vector-icons/Ionicons';

import type { Mode } from '@/data/places';

import { palette } from './palette';

type ModeMeta = {
  label: string;
  /** Cómo se llama un punto de este modo ("Parada 2277", "Estación"). */
  placeNoun: string;
  operatorName: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  soft: string;
  /** Color del icono sobre `color` (el amarillo del metro necesita icono oscuro). */
  onColor: string;
};

export const MODES: Record<Mode, ModeMeta> = {
  emt: {
    label: 'Bus EMT',
    placeNoun: 'Parada',
    operatorName: 'EMT València',
    icon: 'bus',
    color: palette.emt.DEFAULT,
    soft: palette.emt.soft,
    onColor: '#FFFFFF',
  },
  metro: {
    label: 'Metro',
    placeNoun: 'Estación',
    operatorName: 'Metrovalencia',
    icon: 'subway',
    color: palette.metro.DEFAULT,
    soft: palette.metro.soft,
    onColor: palette.ink.DEFAULT,
  },
  tram: {
    label: 'Tranvía',
    placeNoun: 'Parada de tranvía',
    operatorName: 'TRAM · Metrovalencia',
    icon: 'train',
    color: palette.tram.DEFAULT,
    soft: palette.tram.soft,
    onColor: palette.ink.DEFAULT,
  },
};
