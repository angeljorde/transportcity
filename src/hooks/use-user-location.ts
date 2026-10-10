import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { LngLat } from '@/lib/geo';

type Status = 'idle' | 'locating' | 'granted' | 'denied';

/**
 * Ubicación del usuario con seguimiento continuo (balanced, ~10 m).
 * Si se deniega el permiso, `location` se queda en null y la app usa el centro del mapa.
 */
export function useUserLocation() {
  const [location, setLocation] = useState<LngLat | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const sub = useRef<Location.LocationSubscription | null>(null);

  const start = useCallback(async (): Promise<LngLat | null> => {
    setStatus('locating');
    try {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) {
        setStatus('denied');
        return null;
      }
      setStatus('granted');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const here: LngLat = [pos.coords.longitude, pos.coords.latitude];
      setLocation(here);

      sub.current ??= await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 10 },
        (p) => setLocation([p.coords.longitude, p.coords.latitude]),
      );
      return here;
    } catch {
      setStatus('denied');
      return null;
    }
  }, []);

  useEffect(() => {
    start();
    return () => {
      sub.current?.remove();
      sub.current = null;
    };
  }, [start]);

  return { location, status, locate: start };
}
