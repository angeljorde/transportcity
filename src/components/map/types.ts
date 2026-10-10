import type { LngLat } from '@/lib/geo';

export type TransitMapHandle = {
  /** Centra el mapa en `center`. `bottomInset` desplaza el foco por encima del sheet. */
  flyTo(center: LngLat, opts?: { zoom?: number; bottomInset?: number }): void;
};

export type TransitMapProps = {
  selectedStopId: string | null;
  /** Alto ocupado por la UI flotante superior: la atribución del mapa se coloca justo debajo. */
  topInset: number;
  userLocation: LngLat | null;
  onStopPress(id: string): void;
  onMapPress?(): void;
  /** Se llama al terminar de mover el mapa, con el nuevo centro. */
  onCenterChange?(center: LngLat): void;
};
