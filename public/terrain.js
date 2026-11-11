// Terreno do mundo Naruto (Konoha, 1 bloco = 1 m). Usado pelo servidor (Node), pelo cliente (navegador)
// e pela simulação do modo solo. Não usa three.js nem DOM.
//  - terr: altura do chão numa grade de 4 m (129 x 129 por região)
//  - solid: colisão voxel por bit (512 x 512 colunas x 256 blocos de altura)

export const TS = 512;     // tamanho de uma região em blocos (= metros)
export const STEP = 4;     // passo da grade de terreno
export const G = 129;      // 512 / 4 + 1

// Arena jogável: 3 x 3 regiões em volta de Konoha (spawn em rx=0, rz=-3)
export const ARENA = { rx0: -1, rx1: 1, rz0: -4, rz1: -2 };
export const ARENA_BOUNDS = { x0: ARENA.rx0 * TS, x1: (ARENA.rx1 + 1) * TS, z0: ARENA.rz0 * TS, z1: (ARENA.rz1 + 1) * TS };

export function arenaRegions() {
  const out = [];
  for (let rx = ARENA.rx0; rx <= ARENA.rx1; rx++) for (let rz = ARENA.rz0; rz <= ARENA.rz1; rz++) out.push([rx, rz]);
  return out;
}

export function createTerrain() {
  const regions = new Map();   // "rx,rz" -> { rx, rz, terr, solid, quads, tex }
  const recAt = (x, z) => regions.get(Math.floor(x / TS) + ',' + Math.floor(z / TS));

  // altura do chão (interpolação bilinear); fora de regiões carregadas vale 0
  function terrAt(x, z) {
    const rec = recAt(x, z);
    if (!rec || !rec.terr) return 0;
    const lx = x - rec.rx * TS, lz = z - rec.rz * TS;
    const fx = Math.min(Math.max(lx / STEP, 0), G - 1.001), fz = Math.min(Math.max(lz / STEP, 0), G - 1.001);
    const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
    const h = (ii, jj) => rec.terr[ii * G + jj];
    const a = h(i, j) * (1 - tx) + h(i + 1, j) * tx, b = h(i, j + 1) * (1 - tx) + h(i + 1, j + 1) * tx;
    return a * (1 - tz) + b * tz;
  }

  // bloco sólido (estrutura) na posição (x, y, z) em metros
  function solidAt(x, y, z) {
    const rec = recAt(x, z);
    if (!rec || !rec.solid) return false;
    const ly = Math.floor(y);
    if (ly < 0 || ly >= 256) return false;
    const lx = Math.floor(x - rec.rx * TS), lz = Math.floor(z - rec.rz * TS);
    if (lx < 0 || lz < 0 || lx >= TS || lz >= TS) return false;
    const byte = rec.solid[(lx * TS + lz) * 32 + (ly >> 3)];
    return ((byte >> (7 - (ly & 7))) & 1) === 1;
  }

  // o corpo ocupa 2 blocos de altura e 0,6 m de largura. Só bloqueia o que está acima dos pés:
  // um bloco de 1 m na altura do chão (pedra, decoração) é "degrau": o chão sobe em cima dele (groundAt).
  function blockedAt(x, feet, z) {
    for (const ox of [-0.3, 0.3]) for (const oz of [-0.3, 0.3]) {
      if (solidAt(x + ox, feet + 1.0, z + oz) || solidAt(x + ox, feet + 2.0, z + oz)) return true;
    }
    return false;
  }

  // chão: o terreno, ou o topo de um bloco sólido logo abaixo (ex.: piso de casa)
  function groundAt(x, z, y = 0) {
    const t = terrAt(x, z);
    const rec = recAt(x, z);
    if (!rec || !rec.solid) return t;
    const top = Math.min(255, Math.floor(y + 1.6));
    for (let ly = top; ly >= Math.max(0, Math.floor(t)); ly--) {
      if (solidAt(x, ly, z)) return Math.max(t, ly + 1);
    }
    return t;
  }

  // ponto de nascimento: chão logo acima do terreno
  function clampToArena(x, z) {
    return [Math.min(ARENA_BOUNDS.x1 - 3, Math.max(ARENA_BOUNDS.x0 + 3, x)), Math.min(ARENA_BOUNDS.z1 - 3, Math.max(ARENA_BOUNDS.z0 + 3, z))];
  }

  return {
    regions,
    add(rx, rz, rec) { regions.set(rx + ',' + rz, { rx, rz, ...rec }); },
    has(x, z) { return !!recAt(x, z); },
    terrAt, solidAt, blockedAt, groundAt, clampToArena,
  };
}
