/**
 * Mapa dentro de un WebView con maplibre-gl, para Expo Go (donde no hay MapLibre nativo).
 * Usa el mismo estilo y las mismas capas que la web y el nativo; RN y la página se hablan
 * por mensajes JSON.
 */
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { palette } from '@/theme/palette';

import { filters } from './layers';
import type { TransitMapHandle, TransitMapProps } from './types';
import { buildHtml, type Outgoing } from './webview-map-html';

export function WebViewMap({
  ref,
  selectedKey,
  modes,
  topInset,
  userLocation,
  route,
  vehicles,
  onPlacePress,
  onMapPress,
  onCenterChange,
}: TransitMapProps & { ref?: Ref<TransitMapHandle> }) {
  const web = useRef<WebView>(null);
  // El HTML se genera una vez: los cambios posteriores van por mensajes, no recargando la página.
  const [source] = useState(() => ({ html: buildHtml(topInset), baseUrl: 'https://localhost/' }));

  const run = (js: string) => web.current?.injectJavaScript(`${js};true;`);

  useImperativeHandle(ref, () => ({
    flyTo(center, { zoom = 16, bottomInset = 0 } = {}) {
      run(`window.tc && window.tc.flyTo(${JSON.stringify(center)}, ${zoom}, ${bottomInset})`);
    },
    fitBounds(bounds, padding) {
      run(`window.tc && window.tc.fitBounds(${JSON.stringify(bounds)}, ${JSON.stringify(padding)})`);
    },
  }));

  const state = JSON.stringify({
    filters: { stops: filters.stops(modes), stations: filters.stations(modes), selected: filters.selected(selectedKey) },
    me: userLocation,
    route: route ?? null,
  });
  useEffect(() => {
    run(`window.tc && window.tc.update(${state})`);
  }, [state]);

  // Los vehículos cambian cada segundo: mensaje aparte y ligero.
  useEffect(() => {
    run(`window.tc && window.tc.vehicles(${JSON.stringify(vehicles ?? null)})`);
  }, [vehicles]);

  const onMessage = (e: WebViewMessageEvent) => {
    let msg: Outgoing;
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'press') onPlacePress(msg.key);
    else if (msg.type === 'mapPress') onMapPress?.();
    else if (msg.type === 'moveend') onCenterChange?.(msg.center);
  };

  return (
    <WebView
      ref={web}
      style={[StyleSheet.absoluteFill, { backgroundColor: palette.ink.DEFAULT }]}
      source={source}
      originWhitelist={['*']}
      onMessage={onMessage}
      // Cuando la página termina de cargar, le mandamos el estado actual.
      onLoadEnd={() => run(`window.tc && window.tc.update(${state})`)}
      javaScriptEnabled
      scrollEnabled={false}
      bounces={false}
      overScrollMode="never"
      setSupportMultipleWindows={false}
    />
  );
}
