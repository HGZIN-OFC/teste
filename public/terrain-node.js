// Carregamento do terreno no servidor (Node): lê os arquivos .gz de /mundo de forma síncrona.
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { arenaRegions } from './terrain.js';

export function loadArenaNode(terrain, mundoDir) {
  for (const [rx, rz] of arenaRegions()) {
    const base = path.join(mundoDir, `r.${rx}.${rz}`);
    if (!fs.existsSync(base + '.terr.gz')) continue;
    const terr = new Uint8Array(zlib.gunzipSync(fs.readFileSync(base + '.terr.gz')));
    const solid = fs.existsSync(base + '.solid.gz') ? new Uint8Array(zlib.gunzipSync(fs.readFileSync(base + '.solid.gz'))) : null;
    terrain.add(rx, rz, { terr, solid, quads: null, tex: null });
  }
  return terrain;
}
