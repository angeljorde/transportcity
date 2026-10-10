import { useEffect, useMemo, useState } from 'react';

import { searchPhoton, searchPopular, searchStops, type PlaceResult } from '@/lib/geocode';
import type { LngLat } from '@/lib/geo';

const DEBOUNCE_MS = 250;

/** Resultados para el texto escrito: paradas y populares al instante, OSM con debounce. */
export function usePlaceSearch(query: string, near: LngLat) {
  const local = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return [...searchPopular(q).slice(0, 2), ...searchStops(q, 4)];
  }, [query]);

  const [remote, setRemote] = useState<{ query: string; results: PlaceResult[] }>({ query: '', results: [] });
  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < 3) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchPhoton(trimmed, near, controller.signal)
        .then((results) => setRemote({ query: trimmed, results }))
        .catch(() => {});
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // `near` solo sesga el orden: no relanzamos la búsqueda cada vez que se mueve el GPS.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed]);

  const fresh = remote.query === trimmed;
  return {
    local,
    remote: fresh ? remote.results : [],
    searching: trimmed.length >= 3 && !fresh,
  };
}
