import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type ViewProps } from 'react-native';

import { palette } from '@/theme/palette';

type Props = ViewProps & { children?: ReactNode; className?: string; intensity?: number };

/**
 * Superficie "cristal" para los controles flotantes sobre el mapa.
 * iOS y web: desenfoque real. Android: superficie translúcida sólida, porque
 * el blur de Android sigue siendo caro y con artefactos sobre GLSurfaceView.
 */
export function Glass({ children, className, intensity = 40, style, ...rest }: Props) {
  return (
    <View
      className={`overflow-hidden border border-line ${className ?? ''}`}
      style={[Platform.OS === 'android' && { backgroundColor: 'rgba(20,22,27,0.94)' }, style]}
      {...rest}>
      {Platform.OS !== 'android' && (
        <>
          <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.surface.glass }]} />
        </>
      )}
      {children}
    </View>
  );
}
