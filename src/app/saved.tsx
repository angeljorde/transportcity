import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SaveRouteSheet } from '@/components/favorites/save-route-sheet';
import { LineBadge } from '@/components/ui/line-badge';
import { Text } from '@/components/ui/text';
import { useFavoriteLive } from '@/hooks/use-favorite-live';
import { useRangeAlerts } from '@/hooks/use-range-alerts';
import { useUserLocation } from '@/hooks/use-user-location';
import { alertsUnavailableReason, inDepartureWindow } from '@/lib/alerts';
import { deleteFavorite, saveFavorite } from '@/lib/favorite-actions';
import { scheduleLabel, timeToMinutes, useFavorites, type Favorite, type Schedule } from '@/lib/favorites';
import type { LngLat } from '@/lib/geo';
import { palette } from '@/theme/palette';

const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** "hoy a las 07:45", "mañana a las 07:45", "el lunes a las 07:45". */
function nextWindow(s: Schedule, now: Date): string | null {
  if (!s.enabled || !s.days.length) return null;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  for (let offset = 0; offset < 8; offset++) {
    const day = (now.getDay() + offset) % 7;
    if (!s.days.includes(day)) continue;
    if (offset === 0 && nowMin >= timeToMinutes(s.from)) continue;
    const when = offset === 0 ? 'hoy' : offset === 1 ? 'mañana' : `el ${DAY_NAMES[day]}`;
    return `${when} a las ${s.from}`;
  }
  return null;
}

export default function SavedRoutesScreen() {
  const insets = useSafeAreaInsets();
  const favorites = useFavorites();
  const { location } = useUserLocation();
  const [editing, setEditing] = useState<Favorite | null>(null);

  // Reloj por minutos para saber qué rutas están en su franja.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const sorted = [...favorites].sort(
    (a, b) => Number(inDepartureWindow(b, now)) - Number(inDepartureWindow(a, now)) || a.createdAt - b.createdAt,
  );

  return (
    <View className="flex-1 bg-ink">
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 }}>
        {/* Cabecera */}
        <View className="flex-row items-center gap-1 px-3">
          <Pressable onPress={() => router.back()} accessibilityLabel="Volver" className="h-11 w-11 items-center justify-center rounded-full active:bg-white/10">
            <Ionicons name="chevron-back" size={24} color={palette.fg.DEFAULT} />
          </Pressable>
        </View>
        <View className="px-5 pb-4">
          <Text className="font-jk-xbold text-[30px] tracking-tight">Mis rutas</Text>
          <Text className="mt-1 text-[14px] leading-[20px] text-fg-muted">
            {favorites.length
              ? 'En tu franja de salida te avisamos de cada bus o metro que puedas coger.'
              : 'Guarda los trayectos que haces a menudo y te avisaremos de cuándo salir.'}
          </Text>
          {!!alertsUnavailableReason && favorites.length > 0 && (
            <View className="mt-3 flex-row items-center gap-2 rounded-2xl bg-white/5 px-3 py-2.5">
              <Ionicons name="information-circle-outline" size={16} color={palette.fg.muted} />
              <Text className="flex-1 text-[12px] text-fg-muted">Avisos: {alertsUnavailableReason.toLowerCase()}.</Text>
            </View>
          )}
        </View>

        {sorted.map((f, i) => (
          <Animated.View key={f.id} entering={FadeInDown.delay(i * 60).duration(300)}>
            <SavedRouteCard fav={f} now={now} location={location} onEdit={() => setEditing(f)} />
          </Animated.View>
        ))}

        {!favorites.length && (
          <View className="mx-4 items-center rounded-3xl border border-line bg-surface-raised px-6 py-10">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-accent-soft">
              <Ionicons name="bookmark-outline" size={28} color={palette.accent.DEFAULT} />
            </View>
            <Text className="text-center font-jk-bold text-[17px]">Aún no tienes rutas guardadas</Text>
            <Text className="mt-2 text-center text-[13px] leading-[19px] text-fg-muted">
              Busca un destino en «¿A dónde vas?» y pulsa la estrella ☆ en la lista de rutas.
            </Text>
            <Pressable
              onPress={() => router.navigate({ pathname: '/', params: { search: '1' } })}
              className="mt-5 h-12 flex-row items-center gap-2 rounded-2xl bg-accent px-5 active:opacity-80">
              <Ionicons name="search" size={17} color={palette.accent.ink} />
              <Text className="font-jk-bold text-[15px]" style={{ color: palette.accent.ink }}>
                Buscar una ruta
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {editing && (
        <SaveRouteSheet
          favorite={editing}
          isNew={false}
          onSave={(f) => {
            setEditing(null);
            saveFavorite(f);
          }}
          onDelete={(f) => {
            setEditing(null);
            deleteFavorite(f);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </View>
  );
}

function SavedRouteCard({ fav, now, location, onEdit }: { fav: Favorite; now: Date; location: LngLat | null; onEdit(): void }) {
  const active = inDepartureWindow(fav, now);
  const best = useFavoriteLive(fav, location, active);
  useRangeAlerts(fav, best);
  const live = best?.live.status === 'live' ? best.live : null;
  const next = nextWindow(fav.schedule, now);

  return (
    <View
      className="mx-4 mb-3 rounded-3xl border p-4"
      style={{ backgroundColor: active ? palette.accent.soft : palette.surface.raised, borderColor: active ? `${palette.accent.DEFAULT}55` : palette.line.DEFAULT }}>
      <View className="flex-row items-center gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: active ? palette.accent.DEFAULT : 'rgba(255,255,255,0.06)' }}>
          <Ionicons name={fav.icon} size={20} color={active ? palette.accent.ink : palette.accent.DEFAULT} />
        </View>
        <View className="flex-1">
          <Text className="font-jk-bold text-[17px]" numberOfLines={1}>
            {fav.name}
          </Text>
          <Text className="mt-0.5 text-[12px] text-fg-muted" numberOfLines={1}>
            {fav.origin.name} → {fav.destination.name}
          </Text>
        </View>
      </View>

      {/* Franja y estado */}
      <View className="mt-3.5 flex-row items-center gap-2">
        <Ionicons name={fav.schedule.enabled ? 'notifications' : 'notifications-off-outline'} size={14} color={fav.schedule.enabled ? palette.accent.DEFAULT : palette.fg.subtle} />
        <Text className="font-jk-semibold text-[13px]">{fav.schedule.enabled ? scheduleLabel(fav.schedule) : 'Sin avisos'}</Text>
      </View>

      {active ? (
        <View className="mt-3 flex-row items-center justify-between rounded-2xl bg-ink/40 px-3.5 py-3">
          {live && best?.firstRide ? (
            <>
              <View>
                <Text className="font-jk-semibold text-[11px] uppercase tracking-wider text-accent">En tu franja · en directo</Text>
                <Text className="font-jk-xbold text-[20px]" style={{ color: live.tight || live.leaveIn <= 1 ? palette.metro.DEFAULT : palette.fg.DEFAULT }}>
                  {live.tight ? 'Sal ya · vas justo' : live.leaveIn <= 1 ? 'Sal ya' : `Sal en ${live.leaveIn} min`}
                </Text>
                {live.upcoming.length > 1 && (
                  <Text className="text-[12px] text-fg-muted">
                    Y luego en {live.upcoming.slice(1, 3).map((m) => Math.max(0, Math.round(m - live.walkBefore - 3))).join(' y ')} min
                  </Text>
                )}
              </View>
              <View className="flex-row gap-1">
                {best.firstRide.lines.map((l) => (
                  <LineBadge key={l} line={l} operator={best.firstRide!.op} />
                ))}
              </View>
            </>
          ) : (
            <Text className="text-[13px] text-fg-muted">En tu franja · consultando el transporte en directo…</Text>
          )}
        </View>
      ) : (
        next && <Text className="mt-1.5 text-[12px] text-fg-muted">Próximo aviso: {next}</Text>
      )}

      {/* Acciones */}
      <View className="mt-4 flex-row gap-2">
        <Pressable
          onPress={() => router.navigate({ pathname: '/', params: { fav: fav.id } })}
          className="h-11 flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-accent active:opacity-80">
          <Ionicons name="navigate" size={16} color={palette.accent.ink} />
          <Text className="font-jk-bold text-[14px]" style={{ color: palette.accent.ink }}>
            Ver rutas ahora
          </Text>
        </Pressable>
        <Pressable onPress={onEdit} className="h-11 flex-row items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 active:bg-white/20">
          <Ionicons name="create-outline" size={16} color={palette.fg.DEFAULT} />
          <Text className="font-jk-semibold text-[14px]">Editar</Text>
        </Pressable>
      </View>
    </View>
  );
}
