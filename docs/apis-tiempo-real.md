# Fuentes de datos: qué devuelven hoy (sondeo 10/10/2026)

Resumen de lo que responde cada fuente a día de hoy y cómo la vamos a consumir desde las Edge Functions de Supabase.

| Fuente | Endpoint | Formato | Auth | Estado |
|---|---|---|---|---|
| EMT · paradas | Geoportal ArcGIS, capa `Trafico/MapServer/226` | GeoJSON / JSON | No | ✅ 1155 paradas |
| EMT · llegadas | `emtvalencia.es/.../mod_tiempo/busca_parada.php` (POST) | Fragmento HTML (UTF-8) | Cabecera `Referer` | ✅ desde móvil/casa · ❌ desde la nube |
| EMT · GTFS | CKAN `google-transit-lines-stops-bus-schedules` | ZIP GTFS (Latin-1) | No | ✅ con `shapes.txt` |
| FGV · estaciones | Geoportal ArcGIS, capa `Trafico/MapServer/221` | GeoJSON / JSON | No | ✅ 143 estaciones |
| FGV · salidas | `geoportal.valencia.es/geoportal-services/api/v1/salidas-metro.html` | HTML | No | ✅ metro y tranvía |
| FGV · GTFS | `metrovalencia.es/google_transit_feed/google_transit.zip` | ZIP GTFS (Latin-1) | No | ✅ con `shapes.txt` (grueso) |
| Valenbisi | Geoportal ArcGIS, capa `Trafico/MapServer/228` | JSON | No | ✅ |
| Valenbisi (alt.) | `api.citybik.es/v2/networks/valenbisi` | JSON | No | ✅ |

> El antiguo portal `valencia.opendatasoft.com` **ya no existe** (404). El catálogo vive ahora en CKAN (`opendata.vlci.valencia.es`) y los datos geográficos se sirven desde el ArcGIS del geoportal.

---

## EMT

### Paradas (Ajuntament)
```
GET https://geoportal.valencia.es/server/rest/services/OPENDATA/Trafico/MapServer/226/query?where=1=1&outFields=*&f=geojson
```
- Devuelve un máximo de 1000 registros por petición (`exceededTransferLimit: true`), así que hay que paginar con `resultOffset` (1155 paradas en total).
- Propiedades: `id_parada`, `denominacion` (p. ej. `"Pintor Sorolla (2281)"`), `lineas` (`"10,11,16,26,…"`), `suprimida`, `proximas_llegadas` (URL de la página QR).

### Tiempos de llegada
La URL `proximas_llegadas` (`http://www.emtvalencia.es/QR.php?sec=est&p={parada}`) es una página jQuery Mobile que trae los tiempos **ya renderizados en el HTML**, sin el número de línea:
```
2277 - Xàtiva - Institut Lluís Vives | Cntr.Històric - Próximo | Benimàmet - 2 min. | …
```
El endpoint AJAX que usa la web de EMT sí incluye la línea (en el `title` del icono):
```
POST https://www.emtvalencia.es/ciudadano/modules/mod_tiempo/busca_parada.php
Content-Type: application/x-www-form-urlencoded
parada=2277&adaptados=0&idioma=es&usuario=Anonimo
```
```html
<span class="imagenParada"><img src="…/line-icons/62bigW.gif" title="62" …></span>
<span class="llegadaHome">&nbsp;&nbsp;Benimàmet - 2 min.</span><br>
```
- **Lo que exige es el `Referer`** `https://www.emtvalencia.es/ciudadano/index.php`, no una cookie (corregido el 10/10/2026: `index.php` ahora redirige a `/wp/` y no fija sesión). Sin él responde `Temporalmente no disponible…`.
- **La EMT descarta las conexiones que vienen de IPs de la nube.** Desde Supabase (AWS) la conexión TCP agota el tiempo de espera, tanto por HTTP como por HTTPS, mientras que el geoportal y example.com responden en menos de 150 ms. Desde una IP doméstica o móvil responde con normalidad. Por eso la app nativa consulta la EMT directamente y en web no hay tiempos de la EMT.
- Respuesta en UTF-8. Los valores posibles son `Próximo`, `N min.` y, de forma ocasional, una hora `HH:MM`. Si la respuesta viene vacía, no hay estimaciones (línea fuera de servicio o parada inexistente).
- Hay que llamarlo parada a parada → para el sondeo hay que repartir las ~1150 paradas en lotes (ver notas de backend).
- No hay GPS ni identificador de vehículo: la posición se tiene que estimar a partir del ETA y el shape del GTFS.

### GTFS
```
https://opendata.vlci.valencia.es/dataset/ab058cf8-…/resource/c81b69e6-…/download/google_transit{YYYY-MM-DD}.zip
```
- **La URL cambia en cada publicación** (lleva la fecha). Hay que sacarla de `package_show?id=google-transit-lines-stops-bus-schedules` → `resources[0].url`. Se actualiza aproximadamente cada semana.
- 50 rutas, 1134 paradas, 32 411 viajes, 796 728 `stop_times` y 27 588 puntos de shape.
- `stop_id` == `stop_code` == `id_parada` del geoportal.
- **La codificación cambia según el fichero**: `stops.txt` viene en UTF-8 y `routes.txt` en Latin-1. Para leerlos, se intenta primero UTF-8 en modo estricto y, si falla, Latin-1 (`scripts/build-emt-stops.mjs`). Algunos `stop_desc` traen texto mal codificado dos veces; ese campo no se usa.
- Una misma línea tiene varios `route_id` (uno por variante).

## FGV (Metrovalencia + TRAM)

### Estaciones
```
GET https://geoportal.valencia.es/server/rest/services/OPENDATA/Trafico/MapServer/221/query?where=1=1&outFields=*&f=geojson
```
- 143 estaciones (`codigo`, `nombre`, `linea`, `proximas_llegadas`). `tipo` siempre vale 1: el tranvía **no** se distingue en este campo, hay que fijarse en la línea (4, 6, 8, 10 = TRAM).
- `codigo` == `stop_id` del GTFS de FGV ✅

### Próximas salidas
```
GET https://geoportal.valencia.es/geoportal-services/api/v1/salidas-metro.html?estacion={codigo}&lang=es
```
```html
<span>1 - Torrent - Bétera</span>, <span>Destino</span> <b>Bétera</b> - <span>18:22:00</span>
```
- HTML con la línea, la ruta, el destino y la **hora absoluta** `HH:MM:SS`. Responde con normalidad desde Supabase (Edge Function `fgv-departures`).
- El `title` de la imagen no es fiable (pone "1" en trenes de la L2): la línea se saca del texto de la ruta. Cada tren aparece una vez por cada variante de ruta, así que hay que deduplicar. Si la estación no existe, responde HTTP 500.
- Funciona tanto para metro como para tranvía (probado con Trànsits, línea 4).
- Las variantes `.json` y sin extensión responden `{}`, así que hay que parsear el HTML.
- Queda pendiente averiguar si las horas son previsión real o el horario teórico. Para saberlo, hay que compararlas con el GTFS durante varios días.
- La API propia de FGV (`fgv.es/ap18/...`) no responde desde fuera (timeout).

### GTFS
```
https://www.metrovalencia.es/google_transit_feed/google_transit.zip
```
- 116 rutas (variantes por recorrido), 144 paradas, 12 058 viajes y solo 900 puntos de shape (los trazados son poco detallados; quizá haya que densificarlos o ajustarlos con OSM).
- Latin-1. `calendar.txt` lleva espacios después de las comas, así que hay que hacer `trim` al parsear.

## Valenbisi
```
GET https://geoportal.valencia.es/server/rest/services/OPENDATA/Trafico/MapServer/228/query?where=1=1&outFields=*&f=json
```
- `number`, `name`, `address`, `open`, `available` (bicis), `free` (anclajes), `total`, `updated_at`.
- Alternativa: CityBikes (`api.citybik.es/v2/networks/valenbisi`), con coordenadas WGS84 y marcas de tiempo ISO.
- La API de JCDecaux requiere API key (403 sin ella).

---

## Consecuencias para el backend

0. **Hecho:** Edge Functions `arrivals` (EMT, bloqueada desde la nube) y `fgv-departures` (metro y tranvía, operativa). Parsers compartidos con la app en `supabase/functions/_shared/`.
1. **Edge Function `ingest-gtfs`** (diaria): descarga los dos GTFS (resolviendo la URL de EMT vía CKAN), los decodifica como Latin-1 y los carga en PostGIS (`stops`, `routes`, `trips`, `stop_times`, `shapes` como `LineString`).
2. **Sondeo de EMT en servidor (`poll-emt`)**: requiere una salida que la EMT no bloquee (ver bloqueo arriba). Consulta las paradas por lotes. Si se consultan todas cada 30 s salen unas 40 peticiones por segundo, así que conviene priorizar: paradas con favoritos o usuarios cerca, cabeceras y puntos de control de cada línea.
3. **Edge Function `poll-fgv`**: 143 estaciones, sin cookie.
4. **Estimación de posición**: para cada pareja (línea, destino) se cruza el ETA de paradas consecutivas con los `stop_times` y el shape, y se interpola la posición a lo largo del `LineString`. El resultado se publica por Realtime.
5. Ser respetuosos con las fuentes: user-agent identificable, caché y backoff.
