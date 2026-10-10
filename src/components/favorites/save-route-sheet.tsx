import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { alertsSupported } from '@/lib/alerts';
import { FAVORITE_ICONS, type Favorite, type FavoriteIcon } from '@/lib/favorites';
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
const ADVANCE = [5, 10, 15, 20];

const tap = () => Platform.OS !== 'web' && Haptics.selectionAsync();

function shiftTime(t: string, deltaMin: number): string {
  const [h, m] = t.split(':').map(Number);
  const total = (((h * 60 + m + deltaMin) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function SaveRouteSheet({ favorite, isNew, onSave, onDelete, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(favorite.name);
  const [icon, setIcon] = useState<FavoriteIcon>(favorite.icon);
  const [schedule, setSchedule] = useState(favorite.schedule);

  const toggleDay = (d: number) => {
    tap();
    setSchedule((s) => ({ ...s, days: s.days.includes(d) ? s.days.filter((x) => x !== d) : [...s.days, d] }));
  };

  const alertAt = shiftTime(schedule.time, -schedule.advanceMin);
  const canSave = name.trim().length > 0 && (!schedule.enabled || schedule.days.length > 0);

  return (
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} style={{ position: 'absolute', inset: 0 }}>
      <Pressable onPress={onClose} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)' }} accessibilityLabel="Cerrar" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
        <Animated.View entering={SlideInDown.springify().damping(20)} style={{ maxHeight: '92%' }}>
          <View className="rounded-t-[28px] border-t border-line bg-surface" style={{ paddingBottom: insets.bottom + 16 }}>
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
                    {alertsSupported ? 'Te recordamos la ruta y te decimos el momento exacto' : 'Disponible en la app de iOS y Android'}
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

                  <Label>Salgo sobre las</Label>
                  <View className="flex-row items-center justify-between rounded-2xl border border-line bg-surface-raised px-2 py-2">
                    <Stepper icon="remove" onPress={() => setSchedule((s) => ({ ...s, time: shiftTime(s.time, -5) }))} />
                    <View className="flex-row items-center gap-3">
                      <Pressable onPress={() => setSchedule((s) => ({ ...s, time: shiftTime(s.time, -60) }))} hitSlop={8}>
                        <Ionicons name="chevron-back" size={18} color={palette.fg.subtle} />
                      </Pressable>
                      <Text className="font-jk-xbold text-[34px]" style={{ fontVariant: ['tabular-nums'] }}>
                        {schedule.time}
                      </Text>
                      <Pressable onPress={() => setSchedule((s) => ({ ...s, time: shiftTime(s.time, 60) }))} hitSlop={8}>
                        <Ionicons name="chevron-forward" size={18} color={palette.fg.subtle} />
                      </Pressable>
                    </View>
                    <Stepper icon="add" onPress={() => setSchedule((s) => ({ ...s, time: shiftTime(s.time, 5) }))} />
                  </View>

                  <Label>Avísame antes</Label>
                  <View className="flex-row gap-2">
                    {ADVANCE.map((m) => {
                      const on = schedule.advanceMin === m;
                      return (
                        <Pressable
                          key={m}
                          onPress={() => {
                            tap();
                            setSchedule((s) => ({ ...s, advanceMin: m }));
                          }}
                          className="h-11 flex-1 items-center justify-center rounded-2xl border"
                          style={{ borderColor: on ? palette.accent.DEFAULT : palette.line.DEFAULT, backgroundColor: on ? palette.accent.soft : 'transparent' }}>
                          <Text className="font-jk-semibold text-[14px]" style={{ color: on ? palette.accent.DEFAULT : palette.fg.muted }}>
                            {m} min
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <View className="mt-4 flex-row gap-3 rounded-2xl bg-accent-soft p-3.5">
                    <Ionicons name="notifications" size={18} color={palette.accent.DEFAULT} />
                    <Text className="flex-1 text-[13px] leading-[19px] text-fg">
                      A las <Text className="font-jk-bold text-[13px]">{alertAt}</Text> te recordamos la ruta. Al abrirlo calculamos con datos en directo
                      el minuto exacto para salir, con <Text className="font-jk-bold text-[13px]">3 min de margen</Text>, y te avisamos con un «¡Sal ya!».
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
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

function Label({ children }: { children: string }) {
  return <Text className="mb-2 mt-5 font-jk-bold text-[12px] uppercase tracking-[1.2px] text-fg-muted">{children}</Text>;
}

function Stepper({ icon, onPress }: { icon: 'add' | 'remove'; onPress(): void }) {
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      className="h-12 w-12 items-center justify-center rounded-xl bg-white/5 active:bg-white/10">
      <Ionicons name={icon} size={22} color={palette.fg.DEFAULT} />
    </Pressable>
  );
}
