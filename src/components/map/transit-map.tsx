/**
 * Mapa en iOS/Android. MapLibre nativo no existe dentro de Expo Go (necesita un
 * development build), así que ahí usamos el mismo motor que la web dentro de un WebView.
 * Así la app se puede probar en Expo Go sin compilar nada.
 */
import { isRunningInExpoGo } from 'expo';
import type { ComponentType, Ref } from 'react';

import type { TransitMapHandle, TransitMapProps } from './types';

type MapComponent = ComponentType<TransitMapProps & { ref?: Ref<TransitMapHandle> }>;

// require perezoso: importar MapLibre nativo en Expo Go rompe al cargar el módulo nativo.
/* eslint-disable @typescript-eslint/no-require-imports */
export const TransitMap: MapComponent = isRunningInExpoGo()
  ? require('./webview-map').WebViewMap
  : require('./native-map').NativeMap;
/* eslint-enable @typescript-eslint/no-require-imports */
