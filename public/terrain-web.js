// Carregamento do terreno no navegador (cliente e modo solo): busca os .gz de /mundo e descompacta.
import { arenaRegions, createTerrain } from './terrain.js';

// caminhos /mundo/... em relação à página (no navegador e nos testes com location simulado)
const abs = (p) => new URL(p, `${location.protocol}//${location.host}/`).href;

async function gunzip(url) {
  const r = await fetch(abs(url));
  if (!r.ok) return null;
  const ds = new DecompressionStream('gzip');
  return new Uint8Array(await new Response(r.body.pipeThrough(ds)).arrayBuffer());
}

// Retorna { terrain, paleta } com as 9 regiões da arena (terreno, colisão e estruturas).
export async function loadArenaWeb() {
  const indice = await (await fetch(abs('/mundo/indice.json'))).json();
  const terrain = createTerrain();
  await Promise.all(arenaRegions().map(async ([rx, rz]) => {
    const base = `/mundo/r.${rx}.${rz}`;
    const [terr, solid, quads] = await Promise.all([gunzip(base + '.terr.gz'), gunzip(base + '.solid.gz'), gunzip(base + '.quads.gz')]);
    if (!terr) return;
    terrain.add(rx, rz, { terr, solid, quads, tex: `/mundo/tex/r.${rx}.${rz}.jpg` });
  }));
  return { terrain, paleta: indice.paleta };
}
