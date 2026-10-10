import type { LngLat } from './geo';

/** Origen o destino de un trayecto. `isMe` = la ubicación GPS actual del usuario. */
export type Endpoint = { name: string; coord: LngLat; isMe?: boolean };
