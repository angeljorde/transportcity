/**
 * Búsqueda de lugares para el planificador: paradas/estaciones propias (al instante,
 * sin red), destinos populares y direcciones/POIs de OpenStreetMap vía Photon (komoot).
 */
import type Ionicons from '@expo/vector-icons/Ionicons';

import { POPULAR_DESTINATIONS } from '@/data/destinations';
import { places, type Place } from '@/data/places';
import { MODES } from '@/theme/modes';

import type { LngLat } from './geo';

export type PlaceResult = {
  id: string;
  name: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Color del icono (modo de transporte) o null para el neutro. */
  color: string | null;
  coord: LngLat;
  kind: 'stop' | 'popular' | 'address' | 'poi' | 'me' | 'recent';
};

// Área metropolitana de València (oeste, sur, este, norte).
const BBOX = '-0.62,39.33,-0.22,39.64';

/** Minúsculas, sin acentos ni signos: "Plaça de l'Ajuntament" → "placa de l ajuntament". */
export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const placeIndex = places.map((p) => ({ p, n: normalize(p.name) }));

const placeToResult = (p: Place): PlaceResult => ({
  id: p.key,
  name: p.name,
  subtitle: p.operator === 'emt' ? `Parada ${p.id} · ${MODES[p.mode].label}` : MODES[p.mode].operatorName,
  icon: MODES[p.mode].icon,
  color: MODES[p.mode].color,
  coord: [p.lon, p.lat],
  kind: 'stop',
});

/** Paradas y estaciones cuyo nombre contiene todas las palabras (o el número de parada). */
export function searchStops(query: string, limit = 4): PlaceResult[] {
  const q = normalize(query);
  if (!q) return [];
  if (/^\d{1,5}$/.test(q)) {
    const hit = places.find((p) => p.operator === 'emt' && p.id === q);
    return hit ? [placeToResult(hit)] : [];
  }
  const words = q.split(' ');
  return placeIndex
    .filter(({ n }) => words.every((w) => n.includes(w)))
    // Primero estaciones (suelen ser lo que se busca) y luego por nombre más corto (más exacto).
    .sort((a, b) => Number(a.p.operator === 'emt') - Number(b.p.operator === 'emt') || a.n.length - b.n.length)
    .slice(0, limit)
    .map(({ p }) => placeToResult(p));
}

export function searchPopular(query: string): PlaceResult[] {
  const q = normalize(query);
  return POPULAR_DESTINATIONS.filter((d) => !q || normalize(d.name).includes(q)).map(popularToResult);
}

export const popularToResult = (d: (typeof POPULAR_DESTINATIONS)[number]): PlaceResult => ({
  id: `popular:${d.name}`,
  name: d.name,
  subtitle: d.area,
  icon: d.icon,
  color: null,
  coord: [d.lon, d.lat],
  kind: 'popular',
});

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_id: number;
    osm_value?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    locality?: string;
    city?: string;
    type?: string;
  };
};

const POI_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  restaurant: 'restaurant-outline',
  cafe: 'cafe-outline',
  bar: 'beer-outline',
  hospital: 'medkit-outline',
  school: 'school-outline',
  university: 'school-outline',
  park: 'leaf-outline',
  museum: 'color-palette-outline',
  supermarket: 'cart-outline',
  station: 'train-outline',
  stadium: 'football-outline',
  beach: 'sunny-outline',
};

/** Direcciones y lugares de OpenStreetMap, sesgados hacia `near`. */
export async function searchPhoton(query: string, near: LngLat, signal?: AbortSignal): Promise<PlaceResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const params = new URLSearchParams({ q, limit: '8', lat: String(near[1]), lon: String(near[0]), bbox: BBOX });
  const res = await fetch(`https://photon.komoot.io/api/?${params}`, { signal });
  if (!res.ok) return [];
  const json = (await res.json()) as { features: PhotonFeature[] };
  const seen = new Set<string>();
  const out: PlaceResult[] = [];
  for (const f of json.features) {
    const p = f.properties;
    const street = [p.street, p.housenumber].filter(Boolean).join(' ');
    const name = p.name ?? street;
    if (!name) continue;
    const area = [p.name ? street : null, p.district ?? p.locality, p.city].filter(Boolean).join(', ');
    const key = `${normalize(name)}|${normalize(area)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const isAddress = !p.name || p.type === 'house' || p.type === 'street';
    out.push({
      id: `osm:${p.osm_id}`,
      name,
      subtitle: area,
      icon: isAddress ? 'location-outline' : (POI_ICONS[p.osm_value ?? ''] ?? 'pin-outline'),
      color: null,
      coord: f.geometry.coordinates,
      kind: isAddress ? 'address' : 'poi',
    });
  }
  return out;
}
