import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, Switch, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { alertsSupported, alertsUnavailableReason } from '@/lib/alerts';
import { FAVORITE_ICONS, shiftTime, timeToMinutes, type Favorite, type FavoriteIcon, type Schedule } from '@/lib/favorites';
import { palette } from '@/theme/palette';

type Props = {
  /** Favorito existente (editar) o borrador recién creado (guardar). */
  favorite: Favorite;
  isNew: boolean;
  onSave(f: Favorite): void;
  onDelete(f: Favorite): void;
  onClose(): void;
};

// Lunes primero, como en un calendario español.
const WEEK = [
  { d: 1, l: 'L' },
  { d: 2, l: 'M' },
  { d: 3, l: 'X' },
  { d: 4, l: 'J' },
  { d: 5, l: 'V' },
  { d: 6, l: 'S' },
  { d: 0, l: 'D' },
];
const tap = () => Platform.OS !== 'web' && Haptics.selectionAsync();

/** Duración mínima de la franja (min). */
const MIN_RANGE = 10;
/** Margen en la parada elegible (min). */
const MARGIN_MIN = 1;
const MARGIN_MAX = 15;

export function SaveRouteSheet({ favorite, isNew, onSave, onDelete, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const keyboard = useKeyboardHeight();
  const [name, setName] = useState(favorite.name);
  const [icon, setIcon] = useState<FavoriteIcon>(favorite.icon);
  const [schedule, setSchedule] = useState(favorite.schedule);

  const toggleDay = (d: number) => {
    tap();
    setSchedule((s) => ({ ...s, days: s.days.includes(d) ? s.days.filter((x) => x !== d) : [...s.days, d] }));
  };

  // Mantiene "hasta" al menos MIN_RANGE min después de "desde" (y viceversa).
  const setFrom = (delta: number) =>
    setSchedule((s) => {
      const from = shiftTime(s.from, delta);
      const to = timeToMinutes(s.to) - timeToMinutes(from) < MIN_RANGE ? shiftTime(from, MIN_RANGE) : s.to;
      return { ...s, from, to };
    });
  const setTo = (delta: number) =>
    setSchedule((s): Schedule => {
      const to = shiftTime(s.to, delta);
      return timeToMinutes(to) - timeToMinutes(s.from) < MIN_RANGE ? s : { ...s, to };
    });
  const setMargin = (delta: number) =>
    setSchedule((s) => ({ ...s, marginMin: Math.min(MARGIN_MAX, Math.max(MARGIN_MIN, s.marginMin + delta)) }));
  const rangeMin = timeToMinutes(schedule.to) - timeToMinutes(schedule.from);

  const canSave = name.trim().length > 0 && (!schedule.enabled || schedule.days.length > 0);

  return (
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} style={{ position: 'absolute', inset: 0 }}>
      <Pressable onPress={onClose} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)' }} accessibilityLabel="Cerrar" />
      {/* Con el teclado abierto la hoja se apoya encima de él y se acorta (su contenido hace scroll). */}
      <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: keyboard }} pointerEvents="box-none">
        <Animated.View entering={FadeInDown.duration(220)} style={{ maxHeight: screenH - keyboard - insets.top - 12 }}>
          <View className="rounded-t-[28px] border-t border-line bg-surface" style={{ flexShrink: 1, paddingBottom: keyboard ? 12 : insets.bottom + 16 }}>
            <View className="items-center pt-3">
              <View className="h-[5px] w-10 rounded-full bg-white/20" />
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingTop: 12 }}>
              <Text className="font-jk-xbold text-[22px]">{isNew ? 'Guardar ruta' : 'Editar ruta'}</Text>
              <Text className="mt-1 text-[13px] text-fg-muted" numberOfLines={1}>
                {favorite.origin.name} → {favorite.destination.name}
              </Text>

              {/* Nombre e icono */}
              <Label>Nombre</Label>
              <View className="flex-row items-center gap-3 rounded-2xl border border-line bg-surface-raised px-4">
                <Ionicons name={icon} size={18} color={palette.accent.DEFAULT} />
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Casa → Trabajo"
                  placeholderTextColor={palette.fg.subtle}
                  selectionColor={palette.accent.DEFAULT}
                  maxLength={40}
                  style={[
                    { flex: 1, height: 50, color: palette.fg.DEFAULT, fontFamily: 'Jakarta-SemiBold', fontSize: 16 },
                    Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
                  ]}
                />
              </View>
              <View className="mt-3 flex-row gap-2">
                {FAVORITE_ICONS.map((ic) => (
                  <Pressable
                    key={ic}
                    onPress={() => {
                      tap();
                      setIcon(ic);
                    }}
                    className="h-11 flex-1 items-center justify-center rounded-2xl border"
                    style={{
                      borderColor: ic === icon ? palette.accent.DEFAULT : palette.line.DEFAULT,
                      backgroundColor: ic === icon ? palette.accent.soft : 'transparent',
                    }}>
                    <Ionicons name={ic} size={18} color={ic === icon ? palette.accent.DEFAULT : palette.fg.muted} />
                  </Pressable>
                ))}
              </View>

              {/* Aviso de salida */}
              <View className="mt-6 flex-row items-center justify-between rounded-2xl border border-line bg-surface-raised px-4 py-3">
                <View className="flex-1 pr-3">
                  <Text className="font-jk-bold text-[15px]">Avisarme para salir</Text>
                  <Text className="mt-0.5 text-[12px] text-fg-muted">
                    {alertsSupported ? 'Te recordamos la ruta y te decimos el momento exacto' : (alertsUnavailableReason ?? 'No disponible en este dispositivo')}
                  </Text>
                </View>
                <Switch
                  value={schedule.enabled}
                  disabled={!alertsSupported}
                  onValueChange={(v) => {
                    tap();
                    setSchedule((s) => ({ ...s, enabled: v }));
                  }}
                  trackColor={{ false: 'rgba(255,255,255,0.15)', true: palette.accent.DEFAULT }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {schedule.enabled && (
                <Animated.View entering={FadeIn.duration(200)}>
                  <Label>Qué días</Label>
                  <View className="flex-row gap-2">
                    {WEEK.map(({ d, l }) => {
                      const on = schedule.days.includes(d);
                      return (
                        <Pressable
                          key={d}
                          onPress={() => toggleDay(d)}
                          className="h-11 flex-1 items-center justify-center rounded-full"
                          style={{ backgroundColor: on ? palette.accent.DEFAULT : 'rgba(255,255,255,0.06)' }}>
                          <Text className="font-jk-bold text-[14px]" style={{ color: on ? palette.accent.ink : palette.fg.muted }}>
                            {l}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Label>Salgo entre</Label>
                  <View className="flex-row items-center gap-2">
                    <TimeStepper label="Desde" value={schedule.from} onChange={setFrom} />
                    <Ionicons name="arrow-forward" size={16} color={palette.fg.subtle} />
                    <TimeStepper label="Hasta" value={schedule.to} onChange={setTo} />
                  </View>
                  <Text className="mt-2 text-center text-[12px] text-fg-subtle">Franja de {rangeMin} min · cambia de 5 en 5 (mantén pulsado: de hora en hora)</Text>

                  <Label>Margen en la parada</Label>
                  <View className="flex-row items-center justify-between rounded-2xl border border-line bg-surface-raised py-2 pl-4 pr-1.5">
                    <View className="flex-1 pr-3">
                      <Text className="font-jk-bold text-[15px]">
                        Llegar {schedule.marginMin} min antes
                      </Text>
                      <Text className="mt-0.5 text-[12px] text-fg-muted">de que pase el bus o metro</Text>
                    </View>
                    <View className="flex-row items-center gap-1">
                      <Stepper icon="remove" disabled={schedule.marginMin <= MARGIN_MIN} onPress={() => setMargin(-1)} />
                      <Text className="w-10 text-center font-jk-xbold text-[22px]" style={{ fontVariant: ['tabular-nums'] }}>
                        {schedule.marginMin}
                      </Text>
                      <Stepper icon="add" disabled={schedule.marginMin >= MARGIN_MAX} onPress={() => setMargin(1)} />
                    </View>
                  </View>

                  <View className="mt-4 flex-row gap-3 rounded-2xl bg-accent-soft p-3.5">
                    <Ionicons name="notifications" size={18} color={palette.accent.DEFAULT} />
                    <Text className="flex-1 text-[13px] leading-[19px] text-fg">
                      A las <Text className="font-jk-bold text-[13px]">{schedule.from}</Text> te recordamos la ruta. Desde ese momento y hasta las{' '}
                      <Text className="font-jk-bold text-[13px]">{schedule.to}</Text> te avisamos con un «¡Sal ya!» de{' '}
                      <Text className="font-jk-bold text-[13px]">cada bus o metro</Text> que puedas coger, para que llegues a la parada{' '}
                      <Text className="font-jk-bold text-[13px]">{schedule.marginMin} min antes</Text> de que pase.
                    </Text>
                  </View>
                </Animated.View>
              )}

              {/* Acciones */}
              <Pressable
                disabled={!canSave}
                onPress={() => onSave({ ...favorite, name: name.trim(), icon, schedule })}
                className="mt-6 h-[52px] items-center justify-center rounded-2xl bg-accent active:opacity-80"
                style={{ opacity: canSave ? 1 : 0.4 }}>
                <Text className="font-jk-bold text-[16px]" style={{ color: palette.accent.ink }}>
                  {isNew ? 'Guardar ruta' : 'Guardar cambios'}
                </Text>
              </Pressable>
              {!isNew && (
                <Pressable onPress={() => onDelete(favorite)} className="mt-2 h-12 flex-row items-center justify-center gap-2 rounded-2xl active:bg-white/5">
                  <Ionicons name="trash-outline" size={16} color={palette.emt.DEFAULT} />
                  <Text className="font-jk-semibold text-[14px]" style={{ color: palette.emt.DEFAULT }}>
                    Eliminar de mis rutas
                  </Text>
                </Pressable>
              )}
            </ScrollView>
          </View>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

function Label({ children }: { children: string }) {
  return <Text className="mb-2 mt-5 font-jk-bold text-[12px] uppercase tracking-[1.2px] text-fg-muted">{children}</Text>;
}

function TimeStepper({ label, value, onChange }: { label: string; value: string; onChange(delta: number): void }) {
  return (
    <View className="flex-1 items-center rounded-2xl border border-line bg-surface-raised py-2">
      <Text className="font-jk-semibold text-[11px] uppercase tracking-wider text-fg-muted">{label}</Text>
      <View className="mt-1 w-full flex-row items-center justify-between px-1.5">
        <Stepper icon="remove" onPress={() => onChange(-5)} onLongPress={() => onChange(-60)} />
        <Text className="font-jk-xbold text-[24px]" style={{ fontVariant: ['tabular-nums'] }}>
          {value}
        </Text>
        <Stepper icon="add" onPress={() => onChange(5)} onLongPress={() => onChange(60)} />
      </View>
    </View>
  );
}

function Stepper({ icon, onPress, onLongPress, disabled }: { icon: 'add' | 'remove'; onPress(): void; onLongPress?(): void; disabled?: boolean }) {
  return (
    <Pressable
      disabled={disabled}
      style={{ opacity: disabled ? 0.35 : 1 }}
      onPress={() => {
        tap();
        onPress();
      }}
      onLongPress={
        onLongPress &&
        (() => {
          tap();
          onLongPress();
        })
      }
      className="h-10 w-10 items-center justify-center rounded-xl bg-white/5 active:bg-white/10">
      <Ionicons name={icon} size={20} color={palette.fg.DEFAULT} />
    </Pressable>
  );
}
