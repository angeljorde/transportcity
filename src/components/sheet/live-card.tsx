import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { LineBadge } from '@/components/ui/line-badge';
import { Text } from '@/components/ui/text';
import { usePolling } from '@/hooks/use-polling';
import { getEmtArrivals, groupArrivals, type ArrivalGroup } from '@/lib/arrivals';
import { getFgvDepartures, groupDepartures } from '@/lib/departures';
import { palette } from '@/theme/palette';

import { Skeleton } from './skeleton';

const REFRESH_MS = 20_000;
const COLLAPSED_GROUPS = 6;

type Operator = 'emt' | 'fgv';
type NoticeProps = { icon: keyof typeof Ionicons.glyphMap; title: string; body: string };

/** Llegadas de EMT: en directo (estimación de la propia EMT). */
export function EmtArrivalsCard({ stopId, lines }: { stopId: string; lines: string[] }) {
  const { data, error, loading, updatedAt } = usePolling(`emt:${stopId}`, (signal) => getEmtArrivals(stopId, signal), REFRESH_MS);
  const webBlocked = Platform.OS === 'web' && !!error && !data;

  let notice: NoticeProps | null = null;
  if (webBlocked) {
    notice = {
      icon: 'phone-portrait-outline',
      title: 'Disponible en la app móvil',
      body: 'La EMT no permite consultar los tiempos desde la web. En iOS y Android se ven en directo.',
    };
  } else if (error && !data) {
    notice = { icon: 'cloud-offline-outline', title: 'No hemos podido conectar con la EMT', body: 'Reintentando automáticamente…' };
  } else if (data?.status === 'empty') {
    notice = { icon: 'moon-outline', title: 'Sin estimaciones ahora mismo', body: 'Puede que estas líneas no estén en servicio a esta hora.' };
  } else if (data?.status === 'unavailable') {
    notice = { icon: 'hourglass-outline', title: 'La EMT no da tiempos ahora', body: 'Suele ser momentáneo; lo volvemos a intentar en unos segundos.' };
  }

  return (
    <LiveCard
      operator="emt"
      title="Próximas llegadas"
      liveLabel="EN DIRECTO"
      source="EMT València"
      lines={lines}
      loading={loading}
      error={error}
      hasData={!!data}
      updatedAt={updatedAt}
      groups={data?.status === 'ok' ? groupArrivals(data.arrivals) : []}
      notice={notice}
    />
  );
}

/**
 * Salidas de Metrovalencia/TRAM. FGV publica horas sin aclarar si son previsión en
 * tiempo real u horario teórico: lo etiquetamos como "previsión" para no prometer de más.
 */
export function FgvDeparturesCard({ stationId, lines }: { stationId: string; lines: string[] }) {
  const { data, error, loading, updatedAt } = usePolling(`fgv:${stationId}`, (signal) => getFgvDepartures(stationId, signal), REFRESH_MS);

  let notice: NoticeProps | null = null;
  if (error && !data) {
    notice = { icon: 'cloud-offline-outline', title: 'No hemos podido conectar con FGV', body: 'Reintentando automáticamente…' };
  } else if (data?.status === 'empty') {
    notice = { icon: 'moon-outline', title: 'Sin salidas próximas', body: 'Puede que el servicio haya terminado por hoy.' };
  }

  return (
    <LiveCard
      operator="fgv"
      title="Próximas salidas"
      liveLabel="PREVISIÓN FGV"
      source="Metrovalencia (FGV)"
      lines={lines}
      loading={loading}
      error={error}
      hasData={!!data}
      updatedAt={updatedAt}
      groups={data?.status === 'ok' ? groupDepartures(data.departures) : []}
      notice={notice}
    />
  );
}

type LiveCardProps = {
  operator: Operator;
  title: string;
  liveLabel: string;
  source: string;
  lines: string[];
  loading: boolean;
  error: Error | null;
  hasData: boolean;
  updatedAt: number | null;
  groups: ArrivalGroup[];
  notice: NoticeProps | null;
};

function LiveCard({ operator, title, liveLabel, source, lines, loading, error, hasData, updatedAt, groups, notice }: LiveCardProps) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? groups : groups.slice(0, COLLAPSED_GROUPS);
  const pill: PillState = loading ? 'loading' : error && !hasData ? 'offline' : error ? 'stale' : 'live';

  return (
    <View className="overflow-hidden rounded-3xl border border-line bg-surface-raised">
      <View className="flex-row items-center justify-between px-4 pb-2 pt-4">
        <Text className="font-jk-bold text-[15px]">{title}</Text>
        <StatusPill state={pill} liveLabel={liveLabel} />
      </View>

      {loading &&
        lines.slice(0, 3).map((l, i) => (
          <View key={l} className={`flex-row items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-line' : ''}`}>
            <LineBadge line={l} operator={operator} />
            <View className="flex-1 gap-1.5">
              <Skeleton style={{ width: '70%', height: 12 }} />
              <Skeleton style={{ width: '40%', height: 10 }} />
            </View>
            <Skeleton style={{ width: 44, height: 22 }} />
          </View>
        ))}

      {visible.map((g, i) => (
        <ArrivalRow key={`${g.line}|${g.destination}`} group={g} operator={operator} first={i === 0} />
      ))}

      {groups.length > COLLAPSED_GROUPS && (
        <Pressable
          onPress={() => setExpanded((e) => !e)}
          className="flex-row items-center justify-center gap-1 border-t border-line py-3 active:bg-white/5">
          <Text className="font-jk-semibold text-[13px] text-fg-muted">
            {expanded ? 'Ver menos' : `Ver todas (${groups.length})`}
          </Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={palette.fg.muted} />
        </Pressable>
      )}

      {!loading && notice && <Notice {...notice} />}

      {updatedAt && <UpdatedAgo at={updatedAt} source={source} />}
    </View>
  );
}

function ArrivalRow({ group, operator, first }: { group: ArrivalGroup; operator: Operator; first: boolean }) {
  const [next, ...rest] = group.minutes;
  const later = rest.filter((m): m is number => m != null).slice(0, 3);
  return (
    <Animated.View entering={FadeIn.duration(250)}>
      <View className={`flex-row items-center gap-3 px-4 py-3 ${first ? '' : 'border-t border-line'}`}>
        <LineBadge line={group.line} operator={operator} />
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
        <View className="items-end">
          <Minutes value={next} />
          {group.firstTime && next !== 0 && <Text className="text-[11px] text-fg-subtle">{group.firstTime}</Text>}
        </View>
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
const PILL: Record<Exclude<PillState, 'live'>, { label: string; color: string; bg: string }> = {
  loading: { label: 'CONECTANDO', color: palette.fg.muted, bg: 'rgba(255,255,255,0.06)' },
  stale: { label: 'SIN ACTUALIZAR', color: palette.metro.DEFAULT, bg: palette.metro.soft },
  offline: { label: 'SIN CONEXIÓN', color: palette.fg.muted, bg: 'rgba(255,255,255,0.06)' },
};

function StatusPill({ state, liveLabel }: { state: PillState; liveLabel: string }) {
  if (state === 'live') {
    return (
      <View className="flex-row items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1">
        <PulseDot />
        <Text className="font-jk-semibold text-[11px] text-accent">{liveLabel}</Text>
      </View>
    );
  }
  const p = PILL[state];
  return (
    <View className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1" style={{ backgroundColor: p.bg }}>
      <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.color }} />
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

function Notice({ icon, title, body }: NoticeProps) {
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

function UpdatedAgo({ at, source }: { at: number; source: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(id);
  }, []);
  const s = Math.max(0, Math.round((now - at) / 1000));
  return (
    <Text className="border-t border-line px-4 py-2.5 text-[11px] text-fg-subtle">
      Actualizado {s < 5 ? 'ahora mismo' : `hace ${s} s`} · Fuente: {source}
    </Text>
  );
}
