import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import type { PlaceResult } from '@/lib/geocode';

const KEY = 'tc:recents:v1';
const MAX = 6;

/** Búsquedas recientes del planificador, guardadas en el dispositivo. */
export function useRecents() {
  const [recents, setRecents] = useState<PlaceResult[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => raw && setRecents(JSON.parse(raw)))
      .catch(() => {});
  }, []);

  const remember = useCallback((r: PlaceResult) => {
    if (r.kind === 'me') return;
    setRecents((prev) => {
      const next = [{ ...r, kind: 'recent' as const }, ...prev.filter((x) => x.id !== r.id)].slice(0, MAX);
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  return { recents, remember };
}
