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
  /** Franja en la que se quiere salir: desde… ("07:45") */
  from: string;
  /** …hasta ("08:30"). Dentro de ella se avisa de cada vehículo que se puede coger. */
  to: string;
  /** Minutos que se quiere llegar a la parada antes de que pase el vehículo. */
  marginMin: number;
};

export const DEFAULT_MARGIN_MIN = 5;

/** Suma minutos a "HH:MM" (con vuelta de medianoche). */
export function shiftTime(t: string, deltaMin: number): string {
  const [h, m] = t.split(':').map(Number);
  const total = (((h * 60 + m + deltaMin) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export const timeToMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

/** Favoritos guardados con la versión anterior (hora + antelación) → franja equivalente. */
function migrate(f: Favorite): Favorite {
  const old = f.schedule as Partial<Schedule> & { time?: string; advanceMin?: number };
  if (old.from && old.to) return old.marginMin != null ? f : { ...f, schedule: { ...(old as Schedule), marginMin: DEFAULT_MARGIN_MIN } };
  const time = old.time ?? '08:00';
  return {
    ...f,
    schedule: { enabled: !!old.enabled, days: old.days ?? [1, 2, 3, 4, 5], from: shiftTime(time, -(old.advanceMin ?? 10)), to: shiftTime(time, 20), marginMin: DEFAULT_MARGIN_MIN },
  };
}

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
      state = (JSON.parse(raw) as Favorite[]).map(migrate);
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

/** "L-V · 07:45–08:30", "Fines de semana · 10:00–11:00". */
export function scheduleLabel(s: Schedule): string {
  const d = [...s.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  const set = new Set(d);
  let days: string;
  if (set.size === 7) days = 'Todos los días';
  else if (set.size === 5 && [1, 2, 3, 4, 5].every((x) => set.has(x))) days = 'L-V';
  else if (set.size === 2 && set.has(0) && set.has(6)) days = 'Fines de semana';
  else days = d.map((x) => DAY_LETTERS[x]).join(', ');
  return `${days} · ${s.from}–${s.to}`;
}
