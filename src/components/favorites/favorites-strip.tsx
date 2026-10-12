import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { LineBadge } from '@/components/ui/line-badge';
import { Text } from '@/components/ui/text';
import { useFavoriteLive } from '@/hooks/use-favorite-live';
import { useRangeAlerts } from '@/hooks/use-range-alerts';
import { inDepartureWindow } from '@/lib/alerts';
import { scheduleLabel, type Favorite } from '@/lib/favorites';
import type { LngLat } from '@/lib/geo';
import { palette } from '@/theme/palette';

type Props = {
  favorites: Favorite[];
  location: LngLat | null;
  onOpen(f: Favorite): void;
  onEdit(f: Favorite): void;
  onSeeAll(): void;
};

/** "Tus rutas": accesos rápidos; en su franja de salida se vuelven un contador en directo. */
export function FavoritesStrip({ favorites, location, onOpen, onEdit, onSeeAll }: Props) {
  // Reevaluamos cada minuto qué favoritos están en su ventana de salida.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!favorites.length) return null;
  // Los que están "en hora" primero.
  const sorted = [...favorites].sort((a, b) => Number(inDepartureWindow(b, now)) - Number(inDepartureWindow(a, now)));

  return (
    <View className="pb-1">
      <View className="flex-row items-center justify-between px-4 pb-2">
        <Text className="font-jk-bold text-[12px] uppercase tracking-[1.2px] text-fg-muted">Tus rutas</Text>
        <Pressable onPress={onSeeAll} hitSlop={8}>
          <Text className="font-jk-semibold text-[12px] text-accent">Ver todas</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2.5 px-3">
        {sorted.map((f) => (
          <FavoriteCard key={f.id} fav={f} location={location} active={inDepartureWindow(f, now)} onOpen={() => onOpen(f)} onEdit={() => onEdit(f)} />
        ))}
      </ScrollView>
    </View>
  );
}

function FavoriteCard({ fav, location, active, onOpen, onEdit }: { fav: Favorite; location: LngLat | null; active: boolean; onOpen(): void; onEdit(): void }) {
  const best = useFavoriteLive(fav, location, active);
  const live = best?.live.status === 'live' ? best.live : null;

  // Un "¡Sal ya!" por cada vehículo que se puede coger dentro de la franja.
  useRangeAlerts(fav, best);

  const urgent = live && (live.leaveIn <= 1 || live.tight);

  return (
    <Pressable
      onPress={onOpen}
      onLongPress={onEdit}
      delayLongPress={350}
      className="w-[200px] rounded-3xl border px-3.5 py-3 active:opacity-80"
      style={{
        backgroundColor: active ? palette.accent.soft : palette.surface.raised,
        borderColor: active ? `${palette.accent.DEFAULT}55` : palette.line.DEFAULT,
      }}>
      <View className="flex-row items-center gap-2.5">
        <View className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: active ? palette.accent.DEFAULT : 'rgba(255,255,255,0.06)' }}>
          <Ionicons name={fav.icon} size={17} color={active ? palette.accent.ink : palette.accent.DEFAULT} />
        </View>
        <View className="flex-1">
          <Text className="font-jk-bold text-[14px]" numberOfLines={1}>
            {fav.name}
          </Text>
          <Text className="text-[11px] text-fg-muted" numberOfLines={1}>
            {fav.destination.name}
          </Text>
        </View>
        <Pressable onPress={onEdit} hitSlop={10} accessibilityLabel={`Editar ${fav.name}`}>
          <Ionicons name="ellipsis-horizontal" size={16} color={palette.fg.subtle} />
        </Pressable>
      </View>

      <View className="mt-2.5 flex-row items-center justify-between">
        {live && best?.firstRide ? (
          <>
            <Text className="font-jk-xbold text-[17px]" style={{ color: urgent ? palette.metro.DEFAULT : palette.accent.DEFAULT }}>
              {live.tight ? 'Sal ya · justo' : live.leaveIn <= 1 ? 'Sal ya' : `Sal en ${live.leaveIn} min`}
            </Text>
            <LineBadge line={live.line} operator={best.firstRide.op} size="sm" />
          </>
        ) : (
          <View className="flex-row items-center gap-1.5">
            <Ionicons name={fav.schedule.enabled ? 'notifications-outline' : 'navigate-outline'} size={13} color={palette.fg.muted} />
            <Text className="text-[12px] text-fg-muted">
              {fav.schedule.enabled ? scheduleLabel(fav.schedule) : 'Ver rutas ahora'}
              {active && !best ? ' · calculando…' : ''}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}
