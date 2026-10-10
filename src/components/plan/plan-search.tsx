import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { POPULAR_DESTINATIONS } from '@/data/destinations';
import { usePlaceSearch } from '@/hooks/use-place-search';
import { useRecents } from '@/hooks/use-recents';
import type { Favorite } from '@/lib/favorites';
import { popularToResult, type PlaceResult } from '@/lib/geocode';
import { VALENCIA_CENTER, type LngLat } from '@/lib/geo';
import { palette } from '@/theme/palette';

import type { Endpoint } from '@/lib/endpoint';

export type { Endpoint };

type Field = 'origin' | 'destination';

type Props = {
  origin: Endpoint | null;
  destination: Endpoint | null;
  userLocation: LngLat | null;
  /** Campo con el foco al abrir (sin ubicación y sin origen, empezamos por el origen). */
  initialField: Field;
  onChange(field: Field, value: Endpoint | null): void;
  onSwap(): void;
  onClose(): void;
  /** Ambos extremos listos: calcular rutas. */
  onSubmit(origin: Endpoint, destination: Endpoint): void;
  favorites: Favorite[];
  onPickFavorite(f: Favorite): void;
};

const ME_RESULT = (coord: LngLat): PlaceResult => ({
  id: 'me',
  name: 'Tu ubicación',
  subtitle: 'Usar el GPS del móvil',
  icon: 'navigate',
  color: palette.accent.DEFAULT,
  coord,
  kind: 'me',
});

const toEndpoint = (r: PlaceResult): Endpoint => ({ name: r.name, coord: r.coord, isMe: r.kind === 'me' });

export function PlanSearch({ origin, destination, userLocation, initialField, onChange, onSwap, onClose, onSubmit, favorites, onPickFavorite }: Props) {
  const insets = useSafeAreaInsets();
  const [field, setField] = useState<Field>(initialField);
  const [texts, setTexts] = useState({ origin: origin?.isMe ? '' : (origin?.name ?? ''), destination: destination?.name ?? '' });
  const originInput = useRef<TextInput>(null);
  const destinationInput = useRef<TextInput>(null);
  const focusField = (f: Field) => (f === 'origin' ? originInput : destinationInput).current?.focus();
  const { recents, remember } = useRecents();

  const query = texts[field];
  const { local, remote, searching } = usePlaceSearch(query, userLocation ?? VALENCIA_CENTER);

  useEffect(() => {
    const t = setTimeout(() => focusField(initialField), 350);
    return () => clearTimeout(t);
    // solo al abrir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (r: PlaceResult) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    remember(r);
    const ep = toEndpoint(r);
    setTexts((t) => ({ ...t, [field]: ep.isMe ? '' : ep.name }));
    onChange(field, ep);
    const other: Field = field === 'origin' ? 'destination' : 'origin';
    const otherValue = field === 'origin' ? destination : origin;
    if (otherValue) onSubmit(field === 'origin' ? ep : otherValue, field === 'origin' ? otherValue : ep);
    else {
      setField(other);
      focusField(other);
    }
  };

  const swap = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    setTexts((t) => ({ origin: destination?.isMe ? '' : t.destination, destination: origin?.isMe ? '' : t.origin }));
    onSwap();
  };

  const showMeOption = field === 'origin' && userLocation && !origin?.isMe;
  const empty = !query.trim();

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      style={{ position: 'absolute', inset: 0, backgroundColor: palette.ink.DEFAULT }}>
      {/* Cabecera con origen y destino */}
      <Animated.View entering={SlideInUp.duration(300)} style={{ paddingTop: insets.top + 8 }}>
        <View className="flex-row items-start gap-2 px-3">
          <Pressable onPress={onClose} accessibilityLabel="Volver" className="mt-3 h-10 w-10 items-center justify-center rounded-full active:bg-white/10">
            <Ionicons name="chevron-back" size={24} color={palette.fg.DEFAULT} />
          </Pressable>

          <View className="flex-1 flex-row items-center rounded-3xl border border-line bg-surface-raised py-1 pl-4 pr-1">
            {/* Iconos unidos por la línea punteada del trayecto */}
            <View className="items-center" style={{ width: 14 }}>
              <View className="h-3 w-3 rounded-full border-[3px] border-accent" />
              <View className="my-1 gap-[3px]">
                {[0, 1, 2].map((i) => (
                  <View key={i} className="h-[3px] w-[3px] rounded-full bg-fg-subtle" />
                ))}
              </View>
              <Ionicons name="location" size={15} color={palette.fg.DEFAULT} />
            </View>

            <View className="flex-1 pl-3">
              <FieldInput
                inputRef={originInput}
                value={texts.origin}
                placeholder={userLocation ? 'Tu ubicación' : '¿Desde dónde sales?'}
                meChip={!!origin?.isMe && field !== 'origin'}
                focused={field === 'origin'}
                onFocus={() => setField('origin')}
                onChangeText={(v) => {
                  setTexts((t) => ({ ...t, origin: v }));
                  if (origin) onChange('origin', null);
                }}
              />
              <View className="h-px bg-line" />
              <FieldInput
                inputRef={destinationInput}
                value={texts.destination}
                placeholder="¿A dónde vas?"
                focused={field === 'destination'}
                onFocus={() => setField('destination')}
                onChangeText={(v) => {
                  setTexts((t) => ({ ...t, destination: v }));
                  if (destination) onChange('destination', null);
                }}
              />
            </View>

            <Pressable onPress={swap} accessibilityLabel="Intercambiar origen y destino" className="h-10 w-10 items-center justify-center rounded-full active:bg-white/10">
              <Ionicons name="swap-vertical" size={20} color={palette.fg.muted} />
            </Pressable>
          </View>
        </View>
      </Animated.View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 32, paddingTop: 12 }}>
        {showMeOption && <ResultRow r={ME_RESULT(userLocation)} onPress={pick} />}

        {empty && favorites.length > 0 && (
          <>
            <SectionTitle>Tus rutas</SectionTitle>
            {favorites.map((f) => (
              <Pressable key={f.id} onPress={() => onPickFavorite(f)} className="mx-2 flex-row items-center gap-3.5 rounded-2xl px-4 py-3 active:bg-white/5">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-accent-soft">
                  <Ionicons name={f.icon} size={18} color={palette.accent.DEFAULT} />
                </View>
                <View className="flex-1">
                  <Text className="font-jk-semibold text-[15px]" numberOfLines={1}>
                    {f.name}
                  </Text>
                  <Text className="mt-0.5 text-[12px] text-fg-muted" numberOfLines={1}>
                    {f.origin.name} → {f.destination.name}
                  </Text>
                </View>
                <Ionicons name="arrow-forward" size={16} color={palette.fg.subtle} />
              </Pressable>
            ))}
          </>
        )}

        {empty && (
          <>
            <SectionTitle>Destinos populares</SectionTitle>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerClassName="gap-2 px-4 pb-2">
              {POPULAR_DESTINATIONS.map((d) => (
                <Pressable
                  key={d.name}
                  onPress={() => pick(popularToResult(d))}
                  className="flex-row items-center gap-2 rounded-full border border-line bg-surface-raised py-2 pl-3 pr-4 active:bg-white/10">
                  <Ionicons name={d.icon} size={15} color={palette.accent.DEFAULT} />
                  <Text className="font-jk-semibold text-[13px]">{d.name}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {recents.length > 0 && (
              <>
                <SectionTitle>Recientes</SectionTitle>
                {recents.map((r) => (
                  <ResultRow key={r.id} r={r} onPress={pick} />
                ))}
              </>
            )}
          </>
        )}

        {!empty && local.length > 0 && (
          <>
            <SectionTitle>Paradas y destinos</SectionTitle>
            {local.map((r) => (
              <ResultRow key={r.id} r={r} onPress={pick} />
            ))}
          </>
        )}

        {!empty && (remote.length > 0 || searching) && (
          <>
            <SectionTitle right={searching ? <ActivityIndicator size="small" color={palette.fg.muted} /> : null}>Lugares y direcciones</SectionTitle>
            {remote.map((r) => (
              <ResultRow key={r.id} r={r} onPress={pick} />
            ))}
          </>
        )}

        {!empty && !searching && !local.length && !remote.length && query.trim().length >= 3 && (
          <Text className="px-6 py-8 text-center text-[13px] text-fg-muted">No encontramos nada con «{query.trim()}» en València.</Text>
        )}
      </ScrollView>
    </Animated.View>
  );
}

function FieldInput({
  inputRef,
  value,
  placeholder,
  meChip,
  focused,
  onFocus,
  onChangeText,
}: {
  inputRef: React.RefObject<TextInput | null>;
  value: string;
  placeholder: string;
  meChip?: boolean;
  focused: boolean;
  onFocus(): void;
  onChangeText(v: string): void;
}) {
  return (
    <View className="h-12 justify-center">
      {meChip ? (
        <Pressable onPress={() => inputRef.current?.focus()} className="flex-row items-center gap-1.5 self-start rounded-full bg-accent-soft px-3 py-1.5">
          <Ionicons name="navigate" size={13} color={palette.accent.DEFAULT} />
          <Text className="font-jk-semibold text-[14px] text-accent">Tu ubicación</Text>
        </Pressable>
      ) : null}
      <TextInput
        ref={inputRef}
        value={value}
        onFocus={onFocus}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={meChip ? 'transparent' : palette.fg.subtle}
        selectionColor={palette.accent.DEFAULT}
        returnKeyType="search"
        autoCorrect={false}
        style={[
          { color: palette.fg.DEFAULT, fontFamily: focused ? 'Jakarta-SemiBold' : 'Jakarta-Medium', fontSize: 16, paddingVertical: 0 },
          // El chip se superpone al input vacío: al tocarlo se enfoca el input y se puede escribir.
          meChip ? { position: 'absolute', inset: 0, opacity: 0 } : null,
          Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
        ]}
      />
    </View>
  );
}

function SectionTitle({ children, right }: { children: string; right?: React.ReactNode }) {
  return (
    <View className="flex-row items-center justify-between px-6 pb-2 pt-4">
      <Text className="font-jk-bold text-[12px] uppercase tracking-[1.2px] text-fg-muted">{children}</Text>
      {right}
    </View>
  );
}

function ResultRow({ r, onPress }: { r: PlaceResult; onPress(r: PlaceResult): void }) {
  const icon = r.kind === 'recent' ? 'time-outline' : r.icon;
  const color = r.color ?? palette.fg.muted;
  return (
    <Pressable onPress={() => onPress(r)} className="mx-2 flex-row items-center gap-3.5 rounded-2xl px-4 py-3 active:bg-white/5">
      <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: r.color ? `${r.color}26` : 'rgba(255,255,255,0.06)' }}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View className="flex-1">
        <Text className="font-jk-semibold text-[15px]" numberOfLines={1}>
          {r.name}
        </Text>
        {!!r.subtitle && (
          <Text className="mt-0.5 text-[12px] text-fg-muted" numberOfLines={1}>
            {r.subtitle}
          </Text>
        )}
      </View>
      <Ionicons name="arrow-forward" size={16} color={palette.fg.subtle} style={{ transform: [{ rotate: '-45deg' }] }} />
    </Pressable>
  );
}
