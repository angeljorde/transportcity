/**
 * Rutas favoritas guardadas en el dispositivo (AsyncStorage). Pequeño store con
 * suscripción para que el mapa, el buscador y los avisos compartan el mismo estado.
 * Cuando haya cuentas de usuario (Supabase Auth) se sincronizará con el servidor.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type Ionicons from '@expo/vector-icons/Ionicons';
import { useSyncExternalStore } from 'react';

import type { Endpoint } from './endpoint';

export const FAVORITE_ICONS = ['home', 'briefcase', 'school', 'barbell', 'heart', 'star'] as const satisfies readonly (keyof typeof Ionicons.glyphMap)[];
export type FavoriteIcon = (typeof FAVORITE_ICONS)[number];

export type Schedule = {
  enabled: boolean;
  /** Días de la semana (0 = domingo … 6 = sábado). */
  days: number[];
  /** Hora aproximada a la que se sale ("08:00"). */
  time: string;
  /** Cuántos minutos antes avisar para prepararse. */
  advanceMin: number;
};

export type Favorite = {
  id: string;
  name: string;
  icon: FavoriteIcon;
  origin: Endpoint;
  destination: Endpoint;
  schedule: Schedule;
  /** Ids de las notificaciones semanales programadas (para poder cancelarlas). */
  notificationIds: string[];
  createdAt: number;
};

const KEY = 'tc:favorites:v1';

let state: Favorite[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function persist() {
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
}

async function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      state = JSON.parse(raw);
      emit();
    }
  } catch {
    // sin almacenamiento disponible: favoritos solo en memoria
  }
}

export const favoritesStore = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    load();
    return () => listeners.delete(l);
  },
  upsert(f: Favorite) {
    state = state.some((x) => x.id === f.id) ? state.map((x) => (x.id === f.id ? f : x)) : [...state, f];
    persist();
    emit();
  },
  remove(id: string) {
    state = state.filter((x) => x.id !== id);
    persist();
    emit();
  },
};

export function useFavorites(): Favorite[] {
  return useSyncExternalStore(favoritesStore.subscribe, favoritesStore.get, favoritesStore.get);
}

export const newFavoriteId = () => `fav-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** ¿Este favorito une estos dos puntos? (para marcar la estrella en el panel de rutas) */
export function sameTrip(f: Favorite, origin: Endpoint, destination: Endpoint): boolean {
  const near = (a: Endpoint, b: Endpoint) =>
    (a.isMe && b.isMe) || (!a.isMe && !b.isMe && Math.abs(a.coord[0] - b.coord[0]) < 1e-4 && Math.abs(a.coord[1] - b.coord[1]) < 1e-4);
  return near(f.origin, origin) && near(f.destination, destination);
}

const DAY_LETTERS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

/** "L-V · 08:00", "S, D · 10:30", "Todos los días · 07:45". */
export function scheduleLabel(s: Schedule): string {
  const d = [...s.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  const set = new Set(d);
  let days: string;
  if (set.size === 7) days = 'Todos los días';
  else if (set.size === 5 && [1, 2, 3, 4, 5].every((x) => set.has(x))) days = 'L-V';
  else if (set.size === 2 && set.has(0) && set.has(6)) days = 'Fines de semana';
  else days = d.map((x) => DAY_LETTERS[x]).join(', ');
  return `${days} · ${s.time}`;
}
