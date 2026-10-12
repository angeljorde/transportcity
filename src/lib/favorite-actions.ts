import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { alertsSupported, cancelFavorite, scheduleFavorite } from './alerts';
import type { Endpoint } from './endpoint';
import { favoritesStore, newFavoriteId, type Favorite } from './favorites';

/** Guarda (o actualiza) un favorito y reprograma sus avisos. */
export async function saveFavorite(f: Favorite) {
  if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  favoritesStore.upsert(f);
  const notificationIds = await scheduleFavorite(f).catch(() => []);
  favoritesStore.upsert({ ...f, notificationIds });
}

export async function deleteFavorite(f: Favorite) {
  favoritesStore.remove(f.id);
  await cancelFavorite(f).catch(() => {});
}

/** Borrador de favorito con valores por defecto (L-V, de 07:45 a 08:30). */
export function draftFavorite(origin: Endpoint, destination: Endpoint): Favorite {
  return {
    id: newFavoriteId(),
    name: destination.name,
    icon: 'star',
    origin: origin.isMe ? { name: 'Tu ubicación', coord: origin.coord, isMe: true } : origin,
    destination,
    schedule: { enabled: alertsSupported, days: [1, 2, 3, 4, 5], from: '07:45', to: '08:30' },
    notificationIds: [],
    createdAt: Date.now(),
  };
}
