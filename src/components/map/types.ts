import type { Mode } from '@/data/places';
import type { LngLat } from '@/lib/geo';
import type { Bounds } from '@/lib/route-geo';

export type TransitMapHandle = {
  /** Centra el mapa en `center`. `bottomInset` desplaza el foco por encima del sheet. */
  flyTo(center: LngLat, opts?: { zoom?: number; bottomInset?: number }): void;
  /** Encuadra una caja dejando `padding` libre (p. ej. bajo la barra superior y sobre el sheet). */
  fitBounds(bounds: Bounds, padding: { top: number; bottom: number; left: number; right: number }): void;
};

export type TransitMapProps = {
  /** Clave del lugar seleccionado ("emt:2277", "fgv:24"). */
  selectedKey: string | null;
  /** Modos visibles (chips de la barra superior). */
  modes: Mode[];
  /** Alto ocupado por la UI flotante superior: la atribución del mapa se coloca justo debajo. */
  topInset: number;
  userLocation: LngLat | null;
  /** Itinerario a dibujar (ver lib/route-geo.ts). */
  route?: GeoJSON.FeatureCollection | null;
  onPlacePress(key: string): void;
  onMapPress?(): void;
  /** Se llama al terminar de mover el mapa, con el nuevo centro. */
  onCenterChange?(center: LngLat): void;
};
