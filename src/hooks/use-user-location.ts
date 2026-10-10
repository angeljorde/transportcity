import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { LngLat } from '@/lib/geo';

type Status = 'locating' | 'granted' | 'denied';

const toLngLat = (p: Location.LocationObject): LngLat => [p.coords.longitude, p.coords.latitude];

/**
 * Ubicación del usuario con seguimiento continuo (balanced, ~10 m).
 * Si se deniega el permiso, `location` se queda en null y la app usa el centro del mapa.
 */
export function useUserLocation() {
  const [location, setLocation] = useState<LngLat | null>(null);
  const [status, setStatus] = useState<Status>('locating');
  const sub = useRef<Location.LocationSubscription | null>(null);

  /** Pide permiso (si hace falta), devuelve la posición actual y arranca el seguimiento. */
  const locate = useCallback(async (): Promise<LngLat | null> => {
    try {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      setStatus(granted ? 'granted' : 'denied');
      if (!granted) return null;

      const here = toLngLat(await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      setLocation(here);
      sub.current ??= await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 10 },
        (p) => setLocation(toLngLat(p)),
      );
      return here;
    } catch {
      setStatus('denied');
      return null;
    }
  }, []);

  useEffect(() => {
    // Intento inicial; los setState ocurren en la resolución de la promesa, no durante el efecto.
    const initial = Promise.resolve().then(locate);
    return () => {
      initial.then(() => {
        sub.current?.remove();
        sub.current = null;
      });
    };
  }, [locate]);

  return { location, status, locate };
}
