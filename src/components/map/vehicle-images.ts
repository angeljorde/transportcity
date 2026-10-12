/**
 * Dibuja los pictogramas de vehículo en un canvas (web / WebView de Expo Go) y devuelve
 * ImageData para `map.addImage`. En nativo se usan los PNG de assets/map/.
 */
import { VEHICLE_ICON_PATHS, VEHICLE_ICON_PX, type VehicleIcon } from '@/theme/vehicle-icons';

export function vehicleImage(name: VehicleIcon): ImageData {
  const px = VEHICLE_ICON_PX;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = px;
  const ctx = canvas.getContext('2d')!;
  // viewBox -2 -2 28 28 (mismo encuadre que los PNG nativos)
  ctx.scale(px / 28, px / 28);
  ctx.translate(2, 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill(new Path2D(VEHICLE_ICON_PATHS[name]), 'evenodd');
  return ctx.getImageData(0, 0, px, px);
}
