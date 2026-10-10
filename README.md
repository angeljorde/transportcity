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

## Datos

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
