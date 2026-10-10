import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';

import { LineBadge } from '@/components/ui/line-badge';
import { Text } from '@/components/ui/text';
import { placeByKey } from '@/data/places';
import type { LiveBoarding } from '@/lib/live-leg';
import type { Itinerary, Leg, RideLeg } from '@/lib/router';
import { addMinutes, clock } from '@/lib/time-format';
import { lineColor } from '@/theme/lines';
import { palette } from '@/theme/palette';

type Props = { it: Itinerary; live: LiveBoarding | undefined; originName: string; destinationName: string; now: Date };

const placeName = (key: string) => placeByKey.get(key)?.name ?? '';

/** Línea de tiempo del itinerario: puntos (paradas) unidos por el color de cada tramo. */
export function ItinerarySteps({ it, live, originName, destinationName, now }: Props) {
  // Reloj de cada paso, usando la llegada real del primer vehículo si la tenemos.
  const firstRideIdx = it.legs.findIndex((l) => l.kind === 'ride');
  const steps: { leg: Leg; board: number }[] = [];
  let t = 0;
  for (const [i, leg] of it.legs.entries()) {
    if (leg.kind === 'walk') {
      steps.push({ leg, board: t });
      t += leg.minutes;
    } else {
      const wait = i === firstRideIdx && live?.status === 'live' ? Math.max(0, live.arrivesIn - t) : leg.waitMin;
      steps.push({ leg, board: t + wait });
      t += wait + leg.rideMin;
    }
  }
  const leaveIn = live?.status === 'live' ? live.leaveIn : 0;
  const at = (min: number) => clock(addMinutes(now, min + leaveIn));

  return (
    <View className="px-5 pb-2 pt-1">
      <Stop icon="radio-button-on" color={palette.accent.DEFAULT} title={originName} time={at(0)} note={leaveIn > 1 ? `Sal en ${leaveIn} min` : 'Sal ahora'} />
      {steps.map(({ leg, board }, i) => (
        <LegBlock key={i} leg={leg} boardAt={at(board)} live={i === firstRideIdx ? live : undefined} next={it.legs[i + 1]} />
      ))}
      <Stop icon="location" color={palette.fg.DEFAULT} title={destinationName} time={at(t)} note="Llegada" last />
    </View>
  );
}

function LegBlock({ leg, boardAt, live, next }: { leg: Leg; boardAt: string; live: LiveBoarding | undefined; next: Leg | undefined }) {
  if (leg.kind === 'walk') {
    const target = leg.toKey ? placeName(leg.toKey) : null;
    return (
      <Segment dotted>
        <View className="flex-row items-center gap-2">
          <Ionicons name="walk" size={16} color={palette.fg.muted} />
          <Text className="text-[13px] text-fg-muted">
            Camina {Math.max(1, Math.round(leg.minutes))} min · {Math.round(leg.meters / 10) * 10} m{target && next?.kind === 'ride' ? ` hasta ${target}` : ''}
          </Text>
        </View>
      </Segment>
    );
  }
  return <RideBlock leg={leg} boardAt={boardAt} live={live} />;
}

function RideBlock({ leg, boardAt, live }: { leg: RideLeg; boardAt: string; live: LiveBoarding | undefined }) {
  const color = lineColor(leg.line, leg.op);
  const nStops = leg.toIdx - leg.fromIdx;
  return (
    <>
      <Stop icon="ellipse" color={color} title={placeName(leg.fromKey)} time={boardAt}>
        <View className="mt-1.5 flex-row flex-wrap items-center gap-1.5">
          {leg.lines.map((l) => (
            <LineBadge key={l} line={l} operator={leg.op} size="sm" />
          ))}
          <Text className="text-[13px] text-fg-muted" numberOfLines={1}>
            dirección <Text className="font-jk-semibold text-[13px]">{leg.pattern.headsign || placeName(leg.pattern.stops[leg.pattern.stops.length - 1])}</Text>
          </Text>
        </View>
        {live?.status === 'live' && (
          <Text className="mt-1 font-jk-semibold text-[12px] text-accent">
            En directo: llega en {live.arrivesIn} min{live.later.length ? ` · luego ${live.later.join(', ')} min` : ''}
          </Text>
        )}
        {live?.status !== 'live' && <Text className="mt-1 text-[12px] text-fg-subtle">Pasa cada {Math.max(1, Math.round(leg.headwayMin))} min aprox.</Text>}
      </Stop>
      <Segment color={color}>
        <Text className="text-[13px] text-fg-muted">
          {nStops} {nStops === 1 ? 'parada' : 'paradas'} · {Math.max(1, Math.round(leg.rideMin))} min
        </Text>
      </Segment>
      <Stop icon="ellipse" color={color} title={placeName(leg.toKey)} note="Bájate aquí" />
    </>
  );
}

function Stop({
  icon,
  color,
  title,
  time,
  note,
  last,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  time?: string;
  note?: string;
  last?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <View className="flex-row gap-3" style={{ minHeight: last ? 0 : 36 }}>
      <View className="w-6 items-center pt-0.5">
        <Ionicons name={icon} size={icon === 'ellipse' ? 14 : 18} color={color} />
      </View>
      <View className="flex-1 pb-1">
        <View className="flex-row items-baseline justify-between gap-2">
          <Text className="flex-1 font-jk-bold text-[15px]" numberOfLines={2}>
            {title}
          </Text>
          {time && <Text className="font-jk-semibold text-[13px] text-fg-muted" style={{ fontVariant: ['tabular-nums'] }}>{time}</Text>}
        </View>
        {note && <Text className="text-[12px] text-fg-muted">{note}</Text>}
        {children}
      </View>
    </View>
  );
}

/** Tramo entre dos puntos: línea continua del color de la línea, o punteada si es a pie. */
function Segment({ color, dotted, children }: { color?: string; dotted?: boolean; children: React.ReactNode }) {
  return (
    <View className="flex-row gap-3">
      <View className="w-6 items-center">
        {dotted ? (
          <View className="flex-1 items-center justify-evenly py-1">
            {[0, 1, 2, 3].map((i) => (
              <View key={i} className="h-1 w-1 rounded-full bg-fg-subtle" />
            ))}
          </View>
        ) : (
          <View className="w-1.5 flex-1 rounded-full" style={{ backgroundColor: color }} />
        )}
      </View>
      <View className="flex-1 justify-center py-3">{children}</View>
    </View>
  );
}
