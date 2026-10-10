/** HTML autocontenido del mapa para el WebView de Expo Go (ver webview-map.tsx). */
import { placesGeoJSON } from '@/data/places';
import { VALENCIA_CENTER } from '@/lib/geo';
import { darkMapStyle } from '@/theme/map-style';

import {
  meDotLayer,
  meHaloLayer,
  ME_SOURCE,
  PLACES_SOURCE,
  routeLayers,
  ROUTE_SOURCE,
  selectedHaloLayer,
  selectedLayer,
  stationsLabelLayer,
  stationsLayer,
  stopsLabelLayer,
  stopsLayer,
} from './layers';

// Build UMD (worker incluido): la v6 que usa la web es solo ESM y su worker aparte complica el WebView.
const MAPLIBRE = 'https://unpkg.com/maplibre-gl@5.24.0/dist';

export type Outgoing =
  | { type: 'press'; key: string }
  | { type: 'mapPress' }
  | { type: 'moveend'; center: [number, number] };

export function buildHtml(topInset: number): string {
  const init = {
    style: darkMapStyle,
    center: VALENCIA_CENTER,
    places: placesGeoJSON,
    placesSource: PLACES_SOURCE,
    meSource: ME_SOURCE,
    placeLayers: [selectedHaloLayer(null), stopsLayer([]), stopsLabelLayer([]), stationsLayer([]), stationsLabelLayer([]), selectedLayer(null)],
    meLayers: [meHaloLayer, meDotLayer],
    routeSource: ROUTE_SOURCE,
    routeLayers,
  };
  // `</` escapado para que ningún nombre de parada cierre el <script>.
  const initJson = JSON.stringify(init).replace(/<\//g, '<\\/');
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="${MAPLIBRE}/maplibre-gl.css">
<style>
  html,body,#map{margin:0;height:100%;background:#0D0F12}
  .maplibregl-ctrl-top-right{top:${topInset}px}
  .maplibregl-ctrl.maplibregl-ctrl-attrib{background:rgba(20,22,27,.85);color:#9aa0ab;font:11px sans-serif;border:1px solid rgba(255,255,255,.08)}
  .maplibregl-ctrl-attrib a{color:#9aa0ab}
  .maplibregl-ctrl-attrib-button{filter:invert(1) opacity(.7);background-color:transparent!important}
</style>
<script src="${MAPLIBRE}/maplibre-gl.js"></script>
</head><body><div id="map"></div><script>
(function(){
  var I = ${initJson};
  var send = function(m){ window.ReactNativeWebView.postMessage(JSON.stringify(m)); };
  var map = new maplibregl.Map({ container:'map', style:I.style, center:I.center, zoom:13.6, minZoom:10, maxZoom:19,
    pitchWithRotate:false, dragRotate:false, attributionControl:false });
  map.touchZoomRotate.disableRotation();
  map.addControl(new maplibregl.AttributionControl({ compact:true }), 'top-right');
  var ready = false, pending = null;
  var EMPTY = { type:'FeatureCollection', features:[] };
  map.on('load', function(){
    map.addSource(I.placesSource, { type:'geojson', data:I.places });
    I.placeLayers.forEach(function(l){ map.addLayer(Object.assign({}, l, { source:I.placesSource })); });
    map.addSource(I.routeSource, { type:'geojson', data:EMPTY });
    I.routeLayers.forEach(function(l){ map.addLayer(Object.assign({}, l, { source:I.routeSource })); });
    map.addSource(I.meSource, { type:'geojson', data:EMPTY });
    I.meLayers.forEach(function(l){ map.addLayer(Object.assign({}, l, { source:I.meSource })); });
    var a = document.querySelector('.maplibregl-ctrl-attrib'); if (a) a.classList.remove('maplibregl-compact-show');
    ready = true; if (pending) { window.tc.update(pending); pending = null; }
  });
  map.on('click', function(e){
    var hit = map.queryRenderedFeatures(e.point, { layers:['stations','stops'] })[0];
    if (hit && hit.properties && hit.properties.key) send({ type:'press', key:String(hit.properties.key) });
    else send({ type:'mapPress' });
  });
  map.on('moveend', function(){ var c = map.getCenter(); send({ type:'moveend', center:[c.lng, c.lat] }); });
  window.tc = {
    update: function(s){
      if (!ready) { pending = s; return; }
      map.setFilter('stops', s.filters.stops); map.setFilter('stops-label', s.filters.stops);
      map.setFilter('stations', s.filters.stations); map.setFilter('stations-label', s.filters.stations);
      map.setFilter('selected', s.filters.selected); map.setFilter('selected-halo', s.filters.selected);
      map.getSource(I.meSource).setData(s.me ? { type:'Point', coordinates:s.me } : EMPTY);
      map.getSource(I.routeSource).setData(s.route || EMPTY);
    },
    fitBounds: function(b, padding){
      map.fitBounds(b, { padding:padding, duration:900, essential:true, maxZoom:17 });
    },
    flyTo: function(center, zoom, bottom){
      map.flyTo({ center:center, zoom:zoom, padding:{ top:0, left:0, right:0, bottom:bottom }, duration:900, essential:true });
    }
  };
})();
</script></body></html>`;
}

