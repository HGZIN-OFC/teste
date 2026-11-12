// Shinobi Wilds — terreno do mundo novo, independente do mapa voxel legado.
// O navegador pode instalar uma consulta de altura a partir do GLB carregado.
// No servidor, a ausência de colisões do GLB é uma limitação conhecida da etapa atual.
export const ARENA_BOUNDS = Object.freeze({ x0: -350, x1: 350, z0: -300, z1: 350 });

export function createModelTerrain() {
  let groundResolver = null;
  let solidResolver = null;
  function groundAt(x, z, y = 0) {
    if (!groundResolver) return y;
    const v = groundResolver(x, z, y);
    return Number.isFinite(v) ? v : y;
  }
  function solidAt(x, y, z) {
    return solidResolver ? !!solidResolver(x, y, z) : false;
  }
  function clampToArena(x, z) {
    return [
      Math.max(ARENA_BOUNDS.x0 + 1, Math.min(ARENA_BOUNDS.x1 - 1, x)),
      Math.max(ARENA_BOUNDS.z0 + 1, Math.min(ARENA_BOUNDS.z1 - 1, z)),
    ];
  }
  return {
    regions: new Map(),
    groundAt,
    terrAt: groundAt,
    solidAt,
    blockedAt(x, feet, z) {
      return solidAt(x, feet + 1, z) || solidAt(x, feet + 2, z);
    },
    clampToArena,
    setGroundResolver(fn) { groundResolver = typeof fn === 'function' ? fn : null; },
    setSolidResolver(fn) { solidResolver = typeof fn === 'function' ? fn : null; },
  };
}
