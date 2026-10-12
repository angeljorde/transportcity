/**
 * Avisos de salida con notificaciones locales (funcionan con la app cerrada).
 *
 * 1. Recordatorio semanal: los días elegidos, `advanceMin` antes de la hora de salida.
 * 2. "¡Sal ya!" exacto: cuando la app está abierta en la ventana de salida (o se abre desde
 *    el recordatorio), se calcula con datos en directo el minuto de salida —con el margen de
 *    seguridad— y se programa una notificación para ese minuto.
 *
 * Avisos 100 % automáticos con datos en directo y la app cerrada requieren push desde un
 * servidor (siguiente fase; ver docs).
 *
 * ⚠️ Desde el SDK 53, `expo-notifications` LANZA un error al importarse en Expo Go para
 * Android. Por eso se carga de forma perezosa y solo donde se puede usar: en web y en
 * Expo Go/Android los avisos se desactivan y el resto de la app funciona igual.
 */
import { isRunningInExpoGo } from 'expo';
import type * as NotificationsModule from 'expo-notifications';
import { Platform } from 'react-native';

import type { Favorite } from './favorites';

type Notif = typeof NotificationsModule;

/** Por qué no hay avisos en esta plataforma (null = sí hay). */
export const alertsUnavailableReason: string | null =
  Platform.OS === 'web'
    ? 'Disponible en la app de iOS y Android'
    : Platform.OS === 'android' && isRunningInExpoGo()
      ? 'No disponible en Expo Go para Android: funciona en la app instalada'
      : null;

let mod: Notif | null = null;
if (alertsUnavailableReason == null) {
  try {
    // require perezoso: importarlo arriba rompería la app entera en Expo Go/Android.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('expo-notifications') as Notif;
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {
    mod = null;
  }
}

/** Módulo de notificaciones, o null si no se puede usar aquí. */
export const getNotifications = (): Notif | null => mod;
export const alertsSupported = mod != null;
const CHANNEL = 'salidas';

/** Pide permiso si hace falta. Devuelve si se pueden enviar avisos. */
export async function ensureAlertPermission(): Promise<boolean> {
  const Notifications = mod;
  if (!Notifications) return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Avisos de salida',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 120, 200],
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

const parseTime = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

/** Cancela los recordatorios anteriores del favorito y programa los nuevos. Devuelve sus ids. */
export async function scheduleFavorite(fav: Favorite): Promise<string[]> {
  const Notifications = mod;
  if (!Notifications) return [];
  await cancelFavorite(fav);
  if (!fav.schedule.enabled || !fav.schedule.days.length) return [];
  if (!(await ensureAlertPermission())) return [];

  const ids: string[] = [];
  for (const day of fav.schedule.days) {
    // Hora del aviso = salida − antelación (puede caer el día anterior si cruza medianoche).
    let minutes = parseTime(fav.schedule.time) - fav.schedule.advanceMin;
    let weekday = day;
    if (minutes < 0) {
      minutes += 24 * 60;
      weekday = (day + 6) % 7;
    }
    ids.push(
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${fav.name}`,
          body: `Sales sobre las ${fav.schedule.time}. Toca para ver cuándo pasa tu transporte en directo.`,
          data: { favoriteId: fav.id, kind: 'reminder' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: weekday + 1, // expo-notifications: 1 = domingo
          hour: Math.floor(minutes / 60),
          minute: minutes % 60,
          channelId: CHANNEL,
        },
      }),
    );
  }
  return ids;
}

export async function cancelFavorite(fav: Favorite) {
  const Notifications = mod;
  if (!Notifications) return;
  await Promise.all(fav.notificationIds.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
  await cancelLeaveNow(fav.id);
}

// Un único "¡Sal ya!" pendiente por favorito: se reprograma si los datos en directo cambian.
const leaveNowIds = new Map<string, { id: string; at: number }>();

export async function scheduleLeaveNow(fav: Favorite, leaveAt: Date, detail: string) {
  const Notifications = mod;
  if (!Notifications) return;
  const prev = leaveNowIds.get(fav.id);
  // Evita reprogramar por cambios de segundos: solo si se mueve 1 min o más.
  if (prev && Math.abs(prev.at - leaveAt.getTime()) < 60_000) return;
  await cancelLeaveNow(fav.id);
  if (leaveAt.getTime() - Date.now() < 30_000) return; // ya es la hora: lo muestra la propia app
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  const id = await Notifications.scheduleNotificationAsync({
    content: { title: `¡Sal ya! · ${fav.name}`, body: detail, data: { favoriteId: fav.id, kind: 'leave-now' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: leaveAt, channelId: CHANNEL },
  });
  leaveNowIds.set(fav.id, { id, at: leaveAt.getTime() });
}

async function cancelLeaveNow(favId: string) {
  const prev = leaveNowIds.get(favId);
  if (!prev || !mod) return;
  leaveNowIds.delete(favId);
  await mod.cancelScheduledNotificationAsync(prev.id).catch(() => {});
}

/** ¿Estamos ahora en la ventana de salida del favorito? (desde el aviso hasta 30 min después de la hora) */
export function inDepartureWindow(fav: Favorite, now = new Date()): boolean {
  const s = fav.schedule;
  if (!s.enabled || !s.days.includes(now.getDay())) return false;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const leave = parseTime(s.time);
  return nowMin >= leave - s.advanceMin - 15 && nowMin <= leave + 30;
}
