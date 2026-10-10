# TransportCity

Transporte público de València en tiempo real: EMT, Metrovalencia/TRAM y Valenbisi.
Expo (React Native) + expo-router + TypeScript para iOS, Android y web.

## Arrancar

```bash
npm install            # copia también el worker de maplibre-gl a public/ (postinstall)
npm run web            # web: funciona directamente
npx expo run:android   # nativo: MapLibre necesita development build (no funciona en Expo Go)
npx expo run:ios       # requiere macOS; alternativa: eas build --profile development
```

Comprobaciones: `npm run typecheck`, `npx expo lint`, `npx expo-doctor`.

## Backend (Supabase)

- Las Edge Functions están en `supabase/functions/` y los parsers que comparten con la app, en `_shared/`.
  - `arrivals?stop=2277`: llegadas de EMT. **La EMT bloquea a Supabase (AWS)**, así que la app nativa consulta la EMT directamente desde el móvil.
  - `fgv-departures?station=24`: salidas de metro y tranvía. Funciona en todas las plataformas.
- Desplegar: `npx supabase functions deploy <nombre> --use-api` (no necesita Docker).
- Configuración pública en `.env.local` (copia `.env.example`).

## Planificador de rutas

Funciona en el propio dispositivo, sin servidor (`src/lib/router.ts`):
- Combina tramos a pie con bus, metro y tranvía, con un transbordo como máximo.
- Estima la espera con la frecuencia real de esa hora y ese tipo de día (laborable, sábado o domingo).
- Une las líneas que comparten tramo (L3/L5) y descarta las opciones peores.
- `src/lib/live-leg.ts` consulta la llegada en directo del primer vehículo, comprobando que va en el sentido correcto, y calcula el «Sal en X min».
- La búsqueda de lugares (`src/lib/geocode.ts`) combina paradas propias, destinos populares y Photon (OpenStreetMap).

## Datos

- `npm run data:network` regenera `src/data/network.json`, la red que usa el planificador de rutas (patrones, tiempos entre paradas, trazados y salidas por hora de EMT y FGV).
- `npm run data:fgv` regenera `src/data/fgv-stations.json` (estaciones de metro y tranvía y colores oficiales de las líneas).
- `npm run data:emt` regenera `src/data/emt-stops.json` y `emt-routes.json` desde el GTFS de EMT publicado en el CKAN del Ajuntament. Es temporal: más adelante los datos vendrán de Supabase/PostGIS.
- Qué devuelve hoy cada API de tiempo real: [docs/apis-tiempo-real.md](docs/apis-tiempo-real.md).

## Estructura

```
src/app/                 rutas (expo-router)
src/components/map/      TransitMap: .tsx (MapLibre RN v11) y .web.tsx (maplibre-gl), con capas comunes en layers.ts
src/components/sheet/    contenido del bottom sheet (paradas cercanas y ficha de parada)
src/theme/               palette.js (tokens que comparten Tailwind y el mapa) y map-style.ts (estilo oscuro)
scripts/                 generación de datos y postinstall
```

## Notas

- Mapa base: estilo oscuro propio sobre teselas vectoriales de [OpenFreeMap](https://openfreemap.org), sin API key. © OpenMapTiles © OpenStreetMap.
- NativeWind no aplica `className` a los `Animated.View` de Reanimated: en ellos el layout va por `style`.
- Si el proyecto está dentro de OneDrive, Metro puede no detectar los cambios. En ese caso, reinicia con `npx expo start --clear` o, mejor, mueve el proyecto fuera de OneDrive.
