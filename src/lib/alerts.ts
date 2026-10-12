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

import { timeToMinutes, type Favorite } from './favorites';

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


/** Cancela los recordatorios anteriores del favorito y programa los nuevos. Devuelve sus ids. */
export async function scheduleFavorite(fav: Favorite): Promise<string[]> {
  const Notifications = mod;
  if (!Notifications) return [];
  await cancelFavorite(fav);
  if (!fav.schedule.enabled || !fav.schedule.days.length) return [];
  if (!(await ensureAlertPermission())) return [];

  const start = timeToMinutes(fav.schedule.from);
  const ids: string[] = [];
  for (const day of fav.schedule.days) {
    ids.push(
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${fav.name}`,
          body: `Empieza tu franja de salida (${fav.schedule.from}–${fav.schedule.to}). Toca y te avisamos de cada bus o metro que puedas coger.`,
          data: { favoriteId: fav.id, kind: 'reminder' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: day + 1, // expo-notifications: 1 = domingo
          hour: Math.floor(start / 60),
          minute: start % 60,
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
  await cancelLeaveAlerts(fav.id);
}

export type LeaveAlert = { leaveAt: Date; detail: string };

// "¡Sal ya!" pendientes por favorito (uno por vehículo de la franja). Se reprograman
// cuando cambian los datos en directo.
const leaveAlerts = new Map<string, { ids: string[]; signature: string }>();

/**
 * Programa un "¡Sal ya!" por cada vehículo que se puede coger dentro de la franja.
 * Solo reprograma si cambia algún minuto de salida (evita parpadeos por segundos).
 */
export async function scheduleLeaveAlerts(fav: Favorite, alerts: LeaveAlert[]) {
  const Notifications = mod;
  if (!Notifications) return;
  const future = alerts.filter((a) => a.leaveAt.getTime() - Date.now() >= 30_000);
  const signature = future.map((a) => Math.round(a.leaveAt.getTime() / 60_000)).join(',');
  if (leaveAlerts.get(fav.id)?.signature === signature) return;
  await cancelLeaveAlerts(fav.id);
  if (!future.length || !(await Notifications.getPermissionsAsync()).granted) return;
  const ids: string[] = [];
  for (const a of future) {
    ids.push(
      await Notifications.scheduleNotificationAsync({
        content: { title: `¡Sal ya! · ${fav.name}`, body: a.detail, data: { favoriteId: fav.id, kind: 'leave-now' } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: a.leaveAt, channelId: CHANNEL },
      }),
    );
  }
  leaveAlerts.set(fav.id, { ids, signature });
}

async function cancelLeaveAlerts(favId: string) {
  const prev = leaveAlerts.get(favId);
  if (!prev || !mod) return;
  leaveAlerts.delete(favId);
  await Promise.all(prev.ids.map((id) => mod!.cancelScheduledNotificationAsync(id).catch(() => {})));
}

/** ¿Estamos ahora en la franja de salida del favorito? (con 5 min de cortesía antes) */
export function inDepartureWindow(fav: Favorite, now = new Date()): boolean {
  const s = fav.schedule;
  if (!s.enabled || !s.days.includes(now.getDay())) return false;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return nowMin >= timeToMinutes(s.from) - 5 && nowMin <= timeToMinutes(s.to);
}

/** Fecha de hoy a la hora "HH:MM". */
export function todayAt(t: string, now = new Date()): Date {
  const d = new Date(now);
  const m = timeToMinutes(t);
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d;
}
