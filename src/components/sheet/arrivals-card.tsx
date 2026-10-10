import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { LineBadge } from '@/components/ui/line-badge';
import { Text } from '@/components/ui/text';
import { usePolling } from '@/hooks/use-polling';
import { getEmtArrivals, groupArrivals, type ArrivalGroup } from '@/lib/arrivals';
import { palette } from '@/theme/palette';

import { Skeleton } from './skeleton';

const REFRESH_MS = 20_000;
const COLLAPSED_GROUPS = 6;

export function ArrivalsCard({ stopId, lines }: { stopId: string; lines: string[] }) {
  const { data, error, loading, updatedAt } = usePolling(stopId, (signal) => getEmtArrivals(stopId, signal), REFRESH_MS);
  const [expanded, setExpanded] = useState(false);

  const groups = data?.status === 'ok' ? groupArrivals(data.arrivals) : [];
  const visible = expanded ? groups : groups.slice(0, COLLAPSED_GROUPS);
  const webBlocked = Platform.OS === 'web' && !!error && !data;

  return (
    <View className="overflow-hidden rounded-3xl border border-line bg-surface-raised">
      <View className="flex-row items-center justify-between px-4 pb-2 pt-4">
        <Text className="font-jk-bold text-[15px]">Próximas llegadas</Text>
        <StatusPill state={loading ? 'loading' : error && !data ? 'offline' : error ? 'stale' : 'live'} />
      </View>

      {loading &&
        lines.slice(0, 3).map((l, i) => (
          <View key={l} className={`flex-row items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-line' : ''}`}>
            <LineBadge line={l} />
            <View className="flex-1 gap-1.5">
              <Skeleton style={{ width: '70%', height: 12 }} />
              <Skeleton style={{ width: '40%', height: 10 }} />
            </View>
            <Skeleton style={{ width: 44, height: 22 }} />
          </View>
        ))}

      {visible.map((g, i) => (
        <ArrivalRow key={`${g.line}|${g.destination}`} group={g} first={i === 0} />
      ))}

      {groups.length > COLLAPSED_GROUPS && (
        <Pressable onPress={() => setExpanded((e) => !e)} className="flex-row items-center justify-center gap-1 border-t border-line py-3 active:bg-white/5">
          <Text className="font-jk-semibold text-[13px] text-fg-muted">
            {expanded ? 'Ver menos' : `Ver todas (${groups.length})`}
          </Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={palette.fg.muted} />
        </Pressable>
      )}

      {!loading && data?.status === 'empty' && (
        <Notice icon="moon-outline" title="Sin estimaciones ahora mismo" body="Puede que estas líneas no estén en servicio a esta hora." />
      )}
      {!loading && data?.status === 'unavailable' && (
        <Notice icon="hourglass-outline" title="La EMT no da tiempos ahora" body="Suele ser momentáneo; lo volvemos a intentar en unos segundos." />
      )}
      {webBlocked && (
        <Notice
          icon="phone-portrait-outline"
          title="Disponible en la app móvil"
          body="La EMT no permite consultar los tiempos desde la web. En iOS y Android se ven en directo."
        />
      )}
      {!webBlocked && error && !data && (
        <Notice icon="cloud-offline-outline" title="No hemos podido conectar con la EMT" body="Reintentando automáticamente…" />
      )}

      {updatedAt && <UpdatedAgo at={updatedAt} />}
    </View>
  );
}

function ArrivalRow({ group, first }: { group: ArrivalGroup; first: boolean }) {
  const [next, ...rest] = group.minutes;
  const later = rest.filter((m): m is number => m != null).slice(0, 3);
  return (
    <Animated.View entering={FadeIn.duration(250)}>
      <View className={`flex-row items-center gap-3 px-4 py-3 ${first ? '' : 'border-t border-line'}`}>
        <LineBadge line={group.line} />
        <View className="flex-1">
          <Text className="font-jk-semibold text-[15px]" numberOfLines={1}>
            {group.destination}
          </Text>
          {later.length > 0 && (
            <Text className="mt-0.5 text-[12px] text-fg-muted">
              Luego {later.map((m) => `${m}`).join(' · ')} min
            </Text>
          )}
        </View>
        <Minutes value={next} />
      </View>
    </Animated.View>
  );
}

function Minutes({ value }: { value: number | null }) {
  if (value == null) return <Text className="font-jk-bold text-[15px] text-fg-muted">—</Text>;
  if (value === 0) {
    return (
      <View className="flex-row items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1">
        <PulseDot />
        <Text className="font-jk-bold text-[14px] text-accent">Ahora</Text>
      </View>
    );
  }
  return (
    <View className="flex-row items-baseline gap-0.5">
      <Text className="font-jk-xbold text-[22px] leading-[26px]" style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
      <Text className="font-jk-semibold text-[12px] text-fg-muted">min</Text>
    </View>
  );
}

type PillState = 'loading' | 'live' | 'stale' | 'offline';
const PILL: Record<PillState, { label: string; color: string; bg: string }> = {
  loading: { label: 'CONECTANDO', color: palette.fg.muted, bg: 'rgba(255,255,255,0.06)' },
  live: { label: 'EN DIRECTO', color: palette.accent.DEFAULT, bg: palette.accent.soft },
  stale: { label: 'SIN ACTUALIZAR', color: palette.metro.DEFAULT, bg: palette.metro.soft },
  offline: { label: 'SIN CONEXIÓN', color: palette.fg.muted, bg: 'rgba(255,255,255,0.06)' },
};

function StatusPill({ state }: { state: PillState }) {
  const p = PILL[state];
  return (
    <View className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1" style={{ backgroundColor: p.bg }}>
      {state === 'live' ? <PulseDot /> : <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.color }} />}
      <Text className="font-jk-semibold text-[11px]" style={{ color: p.color }}>
        {p.label}
      </Text>
    </View>
  );
}

function PulseDot() {
  const o = useSharedValue(1);
  useEffect(() => {
    o.value = withRepeat(withTiming(0.25, { duration: 800, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: palette.accent.DEFAULT }, style]} />;
}

function Notice({ icon, title, body }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }) {
  return (
    <View className="flex-row items-start gap-3 px-4 py-3">
      <View className="mt-0.5 h-8 w-8 items-center justify-center rounded-full bg-white/5">
        <Ionicons name={icon} size={16} color={palette.fg.muted} />
      </View>
      <View className="flex-1">
        <Text className="font-jk-semibold text-[14px]">{title}</Text>
        <Text className="mt-0.5 text-[12px] leading-[17px] text-fg-muted">{body}</Text>
      </View>
    </View>
  );
}

function UpdatedAgo({ at }: { at: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(id);
  }, []);
  const s = Math.max(0, Math.round((now - at) / 1000));
  return (
    <Text className="border-t border-line px-4 py-2.5 text-[11px] text-fg-subtle">
      Actualizado {s < 5 ? 'ahora mismo' : `hace ${s} s`} · Fuente: EMT València
    </Text>
  );
}
