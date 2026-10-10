/** "20:41" en hora local del dispositivo (sin depender de Intl). */
export function clock(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export const addMinutes = (d: Date, min: number) => new Date(d.getTime() + min * 60_000);

/** "45 min" o "1 h 05". */
export function duration(min: number): string {
  const m = Math.max(1, Math.round(min));
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}
