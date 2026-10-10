/** Utilidades comunes para leer feeds GTFS en los scripts de datos. */

// Los GTFS de València mezclan codificaciones por fichero (p. ej. EMT: stops.txt en
// UTF-8, routes.txt en Latin-1): probamos UTF-8 estricto y si falla, Latin-1.
const utf8 = new TextDecoder('utf-8', { fatal: true });
const latin1 = new TextDecoder('latin1');
export const decode = (buf) => {
  try {
    return utf8.decode(buf);
  } catch {
    return latin1.decode(buf);
  }
};

const BOM = /^﻿/;

/** CSV mínimo para GTFS: soporta comillas y comas dentro de campos. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field.trim()); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field.trim()); field = '';
      if (row.length > 1 || row[0]) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field || row.length) { row.push(field.trim()); rows.push(row); }
  const [header, ...body] = rows;
  const keys = header.map((h) => h.replace(BOM, ''));
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? ''])));
}

/** Orden natural de líneas: 1, 2, 10, 99, C1, N1… */
export const lineOrder = (a, b) => {
  const na = Number(a), nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  if (!Number.isNaN(na)) return -1;
  if (!Number.isNaN(nb)) return 1;
  return a.localeCompare(b, 'es', { numeric: true });
};

/** "PL. DE L'AJUNTAMENT" → "Pl. de l'Ajuntament" (route_long_name viene en mayúsculas). */
export function titleCase(s) {
  const small = new Set(['de', 'del', 'la', 'les', 'el', 'els', 'i', 'y', 'a']);
  return s
    .toLowerCase()
    .replace(/(^|[\s\-/(])([\p{L}])/gu, (_, p, ch) => p + ch.toUpperCase())
    .replace(/\b(De|Del|La|Les|El|Els|I|Y|A)\b/g, (w, _m, off) => (off === 0 ? w : small.has(w.toLowerCase()) ? w.toLowerCase() : w))
    .replace(/\bL'(\p{L})/gu, (_, ch) => `l'${ch.toUpperCase()}`)
    .replace(/\bD'(\p{L})/gu, (_, ch) => `d'${ch.toUpperCase()}`);
}

/**
 * Recorre stop_times (cientos de miles de filas) sin construir objetos y devuelve
 * stop_id → Set de líneas (route_short_name) que paran ahí.
 */
export function linesByStop(stopTimesText, lineByTrip) {
  const out = new Map();
  const st = stopTimesText.split(/\r?\n/);
  const head = st[0].replace(BOM, '').split(',').map((h) => h.trim());
  const iTrip = head.indexOf('trip_id');
  const iStop = head.indexOf('stop_id');
  for (let i = 1; i < st.length; i++) {
    if (!st[i]) continue;
    const cols = st[i].split(',');
    const line = lineByTrip.get(cols[iTrip].trim());
    if (!line) continue;
    const stopId = cols[iStop].trim();
    let set = out.get(stopId);
    if (!set) out.set(stopId, (set = new Set()));
    set.add(line);
  }
  return out;
}
