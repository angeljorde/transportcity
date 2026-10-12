/**
 * Pictogramas de vehículo (vista frontal) en SVG path, viewBox 24×24, relleno blanco con
 * regla evenodd (las ventanas y faros son huecos). Se dibujan sobre un círculo del color
 * de la línea. Fuente única: la web y el WebView los pintan con canvas (Path2D) y en nativo
 * se usan los PNG generados a partir de ellos (assets/map/veh-*.png, ver scripts/).
 */
export const VEHICLE_ICON_PATHS = {
  'veh-bus':
    // carrocería, parabrisas, faros y ruedas
    'M8 2h8a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3z' +
    'M7.5 5h9v5.5h-9z' +
    'M7.3 14.5a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0-2.4 0z' +
    'M14.3 14.5a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0-2.4 0z' +
    'M6.5 18h3v3h-3zM14.5 18h3v3h-3z',
  'veh-metro':
    // morro redondeado, ventana, faros y "patas" hacia los raíles
    'M9 2h6a4 4 0 0 1 4 4v9a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6a4 4 0 0 1 4-4z' +
    'M7.5 5.5h9v4.5h-9z' +
    'M7.9 14a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0-2.2 0z' +
    'M13.9 14a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0-2.2 0z' +
    'M8.2 18.5h2l-1.6 3.5h-2zM13.8 18.5h2l1.6 3.5h-2z',
  'veh-tram':
    // como el metro, con pantógrafo
    'M9 3.5h6a3.5 3.5 0 0 1 3.5 3.5v8a3 3 0 0 1-3 3h-7a3 3 0 0 1-3-3V7A3.5 3.5 0 0 1 9 3.5z' +
    'M7.5 6.5h9v4h-9z' +
    'M7.9 14.3a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0-2.2 0z' +
    'M13.9 14.3a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0-2.2 0z' +
    'M11.3 1.2h1.4v2.3h-1.4zM8.5 0.5h7v1.2h-7z' +
    'M8.2 18.5h2l-1.6 3.5h-2zM13.8 18.5h2l1.6 3.5h-2z',
} as const;

export type VehicleIcon = keyof typeof VEHICLE_ICON_PATHS;

/** Tamaño en píxeles de las imágenes del icono (se registran con pixelRatio 2). */
export const VEHICLE_ICON_PX = 64;
