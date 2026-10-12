#!/usr/bin/env node
/**
 * Genera assets/map/veh-*.png (iconos blancos de vehículo para MapLibre nativo) a partir
 * de los paths de src/theme/vehicle-icons.ts, renderizándolos con Chrome (puppeteer-core).
 *
 * Uso: CHROME="C:/Program Files/Google/Chrome/Application/chrome.exe" node scripts/build-vehicle-icons.mjs
 * (requiere `npx puppeteer-core` disponible; solo hace falta al cambiar los pictogramas)
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(resolve(root, 'src/theme/vehicle-icons.ts'), 'utf8');
// Extrae cada entrada 'veh-x': 'path' + 'path' ...
const icons = {};
for (const m of src.matchAll(/'(veh-[a-z]+)':\s*([\s\S]*?),\n\s*(?='veh-|\}\s*as const)/g)) {
  icons[m[1]] = [...m[2].matchAll(/'([^']*)'/g)].map((x) => x[1]).join('');
}
const SIZE = 64;
const puppeteer = (await import(process.env.PUPPETEER ?? 'puppeteer-core')).default;
const browser = await puppeteer.launch({ executablePath: process.env.CHROME, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: SIZE, height: SIZE, deviceScaleFactor: 1 });
for (const [name, d] of Object.entries(icons)) {
  await page.setContent(
    `<html><body style="margin:0;background:transparent"><svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="-2 -2 28 28"><path fill="#fff" fill-rule="evenodd" d="${d}"/></svg></body></html>`,
  );
  await page.screenshot({ path: resolve(root, `assets/map/${name}.png`), omitBackground: true });
  console.log(`✓ assets/map/${name}.png`);
}
await browser.close();
