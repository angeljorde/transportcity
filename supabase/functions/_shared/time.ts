/** Hora actual en Madrid en segundos desde medianoche (null si el runtime no tiene Intl con zonas). */
export function madridSecondsOfDay(now: Date): number | null {
  if (typeof Intl === 'undefined' || !Intl.DateTimeFormat.prototype.formatToParts) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, p) => ((acc[p.type] = p.value), acc), {});
  return Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second);
}

/**
 * Segundos que faltan para `hh:mm[:ss]` (hora de Madrid). Si la hora quedó atrás más
 * de una hora asumimos que es del día siguiente (servicio que cruza la medianoche).
 */
export function secondsUntil(hh: number, mm: number, ss: number, now: Date): number | null {
  const nowS = madridSecondsOfDay(now);
  if (nowS == null) return null;
  let diff = hh * 3600 + mm * 60 + ss - nowS;
  if (diff < -3600) diff += 24 * 3600;
  return diff;
}
