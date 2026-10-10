export type LngLat = [lon: number, lat: number];

/** Plaça de l'Ajuntament: centro por defecto mientras no hay ubicación. */
export const VALENCIA_CENTER: LngLat = [-0.3763, 39.4699];

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Distancia en metros (haversine). */
export function distance([lon1, lat1]: LngLat, [lon2, lat2]: LngLat): number {
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Los `limit` elementos más cercanos a `origin`, con su distancia. */
export function nearest<T extends { lat: number; lon: number }>(items: T[], origin: LngLat, limit: number) {
  return items
    .map((item) => ({ item, meters: distance(origin, [item.lon, item.lat]) }))
    .sort((a, b) => a.meters - b.meters)
    .slice(0, limit);
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

/** Minutos andando a 4,8 km/h, con un factor 1,25 para pasar de línea recta a calle. */
export function walkingMinutes(m: number): number {
  return Math.max(1, Math.round((m * 1.25) / 80));
}
