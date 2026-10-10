// maplibre-gl v6 carga su worker como módulo ES aparte (import.meta.url), algo que Metro no
// empaqueta. Lo servimos como estático desde public/ y la web lo apunta con setWorkerUrl().
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = createRequire(import.meta.url).resolve('maplibre-gl/package.json', { paths: [root] });
mkdirSync(resolve(root, 'public'), { recursive: true });
copyFileSync(resolve(dirname(pkg), 'dist/maplibre-gl-worker.mjs'), resolve(root, 'public/maplibre-gl-worker.mjs'));
console.log('✓ public/maplibre-gl-worker.mjs');
