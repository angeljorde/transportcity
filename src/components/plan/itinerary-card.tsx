import Ionicons from '@expo/vector-icons/Ionicons';
import { Fragment, useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { LineBadge } from '@/components/ui/line-badge';
import { Text } from '@/components/ui/text';
import { placeByKey } from '@/data/places';
import type { LiveBoarding } from '@/lib/live-leg';
import type { Itinerary, RideLeg } from '@/lib/router';
import { addMinutes, clock, duration } from '@/lib/time-format';
import { palette } from '@/theme/palette';

type Props = {
  it: Itinerary;
  live: LiveBoarding | undefined;
  selected: boolean;
  fastest: boolean;
  now: Date;
  onPress(): void;
};

export function ItineraryCard({ it, live, selected, fastest, now, onPress }: Props) {
  const total = live?.status === 'live' ? live.totalMin : it.totalMin;
  const firstRide = it.legs.find((l): l is RideLeg => l.kind === 'ride');
  const walkBefore = it.legs.slice(0, it.legs.findIndex((l) => l.kind === 'ride')).reduce((a, l) => a + (l.kind === 'walk' ? l.minutes : 0), 0);

  return (
    <Pressable
      onPress={onPress}
      className="mx-3 mb-2.5 rounded-3xl border bg-surface-raised px-4 py-3.5 active:bg-white/5"
      style={{ borderColor: selected ? palette.accent.DEFAULT : palette.line.DEFAULT }}>
      <View className="flex-row items-start justify-between">
        <View>
          <View className="flex-row items-baseline gap-2">
            <Text className="font-jk-xbold text-[24px] leading-[28px]" style={{ fontVariant: ['tabular-nums'] }}>
              {duration(total)}
            </Text>
            {fastest && (
              <View className="rounded-full bg-accent-soft px-2 py-0.5">
                <Text className="font-jk-bold text-[10px] uppercase tracking-wider text-accent">Más rápida</Text>
              </View>
            )}
          </View>
          <Text className="mt-0.5 text-[12px] text-fg-muted">Llegas a las {clock(addMinutes(now, total))}</Text>
        </View>
        {firstRide ? <LeaveBadge live={live} headway={firstRide.headwayMin} /> : <WalkOnlyBadge />}
      </View>

      {/* Secuencia de tramos */}
      <View className="mt-3 flex-row flex-wrap items-center gap-1.5">
        {it.legs.map((leg, i) => (
          <Fragment key={i}>
            {i > 0 && <Ionicons name="chevron-forward" size={12} color={palette.fg.subtle} />}
            {leg.kind === 'walk' ? (
              <View className="flex-row items-center gap-0.5">
                <Ionicons name="walk" size={15} color={palette.fg.muted} />
                <Text className="font-jk-semibold text-[12px] text-fg-muted">{Math.max(1, Math.round(leg.minutes))}</Text>
              </View>
            ) : (
              <View className="flex-row items-center gap-1">
                {leg.lines.map((l) => (
                  <LineBadge key={l} line={l} operator={leg.op} size="sm" />
                ))}
              </View>
            )}
          </Fragment>
        ))}
      </View>

      {firstRide && (
        <Text className="mt-2.5 text-[12px] text-fg-muted" numberOfLines={1}>
          Desde <Text className="font-jk-semibold text-[12px] text-fg">{placeByKey.get(firstRide.fromKey)?.name}</Text>
          {walkBefore >= 1 ? ` · ${Math.round(walkBefore)} min andando` : ''}
        </Text>
      )}
    </Pressable>
  );
}

/** "Sal en 4 min" / "Sal ya" con datos en directo; si no hay, la frecuencia. */
function LeaveBadge({ live, headway }: { live: LiveBoarding | undefined; headway: number }) {
  if (live?.status === 'live') {
    const now = live.leaveIn <= 1;
    // "Justo": solo se llega sin el margen de seguridad → aviso en ámbar.
    const bg = live.tight ? palette.metro.DEFAULT : now ? palette.accent.DEFAULT : palette.accent.soft;
    const fg = live.tight || now ? palette.accent.ink : palette.accent.DEFAULT;
    return (
      <View className="items-end">
        <View className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5" style={{ backgroundColor: bg }}>
          <Pulse color={fg} />
          <Text className="font-jk-bold text-[13px]" style={{ color: fg }}>
            {live.tight ? 'Sal ya · vas justo' : now ? 'Sal ya' : `Sal en ${live.leaveIn} min`}
          </Text>
        </View>
        <Text className="mt-1 text-[11px] text-fg-subtle">
          Pasa en {live.arrivesIn} min{live.later.length ? ` · luego ${live.later.join(', ')}` : ''}
        </Text>
      </View>
    );
  }
  return (
    <View className="items-end">
      <View className="rounded-full bg-white/5 px-3 py-1.5">
        <Text className="font-jk-semibold text-[12px] text-fg-muted">
          {live?.status === 'none' ? 'Sin vehículos ahora' : `Cada ${Math.max(1, Math.round(headway))} min`}
        </Text>
      </View>
      {live === undefined && <Text className="mt-1 text-[11px] text-fg-subtle">Consultando…</Text>}
    </View>
  );
}

function WalkOnlyBadge() {
  return (
    <View className="flex-row items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5">
      <Ionicons name="leaf-outline" size={13} color={palette.tram.DEFAULT} />
      <Text className="font-jk-semibold text-[12px] text-fg-muted">Sin esperas</Text>
    </View>
  );
}

function Pulse({ color }: { color: string }) {
  const o = useSharedValue(1);
  useEffect(() => {
    o.value = withRepeat(withTiming(0.25, { duration: 800, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }, style]} />;
}
