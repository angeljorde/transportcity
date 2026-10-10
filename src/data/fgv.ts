import fgvJson from './fgv-stations.json';

export type FgvMode = 'metro' | 'tram';

export type FgvLine = { line: string; mode: FgvMode; color: string; name: string };

export type Station = { id: string; name: string; lat: number; lon: number; lines: string[] };

export const fgvLines = fgvJson.lines as FgvLine[];
export const stations: Station[] = fgvJson.stations;

export const fgvLineByLine = new Map(fgvLines.map((l) => [l.line, l]));

/** Una estación es "metro" si pasa alguna línea de metro (Empalme, Benimaclet… mezclan ambos). */
export const stationMode = (s: Station): FgvMode =>
  s.lines.some((l) => fgvLineByLine.get(l)?.mode === 'metro') ? 'metro' : 'tram';
