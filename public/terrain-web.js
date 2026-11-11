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
// onProgress(p) recebe o avanço de 0 a 1 conforme cada arquivo é baixado e descompactado.
export async function loadArenaWeb(onProgress = () => {}) {
  const indice = await (await fetch(abs('/mundo/indice.json'))).json();
  const terrain = createTerrain();
  const regions = arenaRegions();
  const total = regions.length * 3; let done = 0;
  const tick = () => onProgress(++done / total);
  await Promise.all(regions.map(async ([rx, rz]) => {
    const base = `/mundo/r.${rx}.${rz}`;
    const [terr, solid, quads] = await Promise.all([
      gunzip(base + '.terr.gz').finally(tick), gunzip(base + '.solid.gz').finally(tick), gunzip(base + '.quads.gz').finally(tick),
    ]);
    if (!terr) return;
    terrain.add(rx, rz, { terr, solid, quads, tex: `/mundo/tex/r.${rx}.${rz}.jpg` });
  }));
  return { terrain, paleta: indice.paleta };
}
