# Malha das estruturas de Konoha, gerada offline. Uma região por vez.
#  - construções grandes (componentes com SMALL_MIN blocos ou mais): marching cubes + suavização Taubin
#    + simplificação (colapso de arestas, erro quadrático) -> superfície lisa;
#  - elementos finos (cercas, grades, vidros, muros baixos): continuam em cubos (greedy), para não quebrarem;
#  - peças pequenas e soltas (troncos sem copa, pedregulhos): saem. As copas ficam na textura aérea (FOLHAGEM).
# A colisão continua vindo de r.X.Z.solid.gz (mapbuild/export_solid.py), com o mesmo critério de decoração.
# As faixas da borda da região são congeladas, para as regiões vizinhas encaixarem sem fresta.
#
# Saída: public/mundo/r.X.Z.smooth.gz, binário little-endian (o cliente lê os dois tipos juntos):
#   u32 nV, u32 nT,
#   nV*3 i16  posição local da região em metros x16 (x, y, z; y = altura),
#   nV*3 u8   cor RGB por vértice,
#   nT*3 u32  índices dos triângulos (frente para fora).
#
# Uso: python3 tools/mapa/smooth.py            (as 9 regiões da arena)
#      python3 tools/mapa/smooth.py -1,-4 0,-3  (regiões específicas)
import sys, os, gzip, time
sys.path.insert(0, '/home/claude/mapbuild'); sys.path.insert(0, '/home/claude/shinobi-wilds/tools/mapa')
import numpy as np
from scipy import sparse, ndimage
from skimage import measure
from anvil import load_box
from ruas import aplicar_ruas
from palette import rgb
from paths import REG
from mesher import mesh as greedy_mesh

OUT = '/home/claude/shinobi-wilds/public/mundo'
TS = 512            # tamanho da região (blocos)
Y = 256             # altura máxima
M = 32              # margem em blocos (>= 2 * iterações Taubin + folga)
BAND = 6.0          # faixa da borda da região (em blocos) que fica congelada
TAUBIN_ITERS = 14   # mais iterações = bordas mais arredondadas (sem encolher o volume)
LAM, MU = 0.5, -0.53
TARGET_FACES = 350_000   # triângulos suaves por região (dentro da região) após simplificar
SMALL_MIN = 150          # componentes com menos blocos que isso viram cubos
NATURAL = {1, 2, 3, 7, 8, 9, 10, 11, 12, 13, 78, 79, 80, 82, 110, 87, 88}
FOLHAGEM = (18, 161)
# mesmo critério de colisão (mapbuild/export_solid.py): decoração que não é bloco cheio fica de fora
DECOR = (6, 27, 28, 30, 31, 32, 37, 38, 39, 40, 50, 59, 63, 65, 66, 68, 69, 70, 72, 75, 76, 77, 83, 106, 111, 131, 132, 140, 141, 142, 143, 147, 148, 157, 171, 175, 176, 177)
THIN = (85, 107, 113, 101, 102, 20, 139)   # cercas, grades, vidros, muros: ficam em cubos
ARENA = [(rx, rz) for rx in (-1, 0, 1) for rz in (-4, -3, -2)]
U_AX = np.array([1, 0, 0])   # eixo "u" de um quad, por eixo d (x=0, y=1, z=2)
V_AX = np.array([2, 2, 1])   # eixo "v"


def taubin(verts, faces, iters, lam, mu):
    """Suavização de Taubin: alisa sem encolher o volume."""
    n = len(verts)
    i = np.concatenate([faces[:, 0], faces[:, 1], faces[:, 2], faces[:, 1], faces[:, 2], faces[:, 0]])
    j = np.concatenate([faces[:, 1], faces[:, 2], faces[:, 0], faces[:, 0], faces[:, 1], faces[:, 2]])
    A = sparse.csr_matrix((np.ones(len(i)), (i, j)), shape=(n, n))
    A.data[:] = 1.0
    deg = np.asarray(A.sum(axis=1)).ravel()
    deg[deg == 0] = 1.0
    P = sparse.diags(1.0 / deg) @ A
    v = verts.astype(np.float64)
    for _ in range(iters):
        v = v + lam * (P @ v - v)
        v = v + mu * (P @ v - v)
    return v


def _quadrics(V, F):
    """Quádrica de erro (plano de cada face, ponderado pela área) somada em cada vértice."""
    a, b, c = V[F[:, 0]], V[F[:, 1]], V[F[:, 2]]
    n = np.cross(b - a, c - a)
    l2 = np.linalg.norm(n, axis=1)
    ok = l2 > 1e-12
    F = F[ok]; n = n[ok] / l2[ok, None]; area = l2[ok] * 0.5
    d = -(n * a[ok]).sum(axis=1)
    p = np.column_stack([n, d])
    idx = [(0, 0), (0, 1), (0, 2), (0, 3), (1, 1), (1, 2), (1, 3), (2, 2), (2, 3), (3, 3)]
    qf = np.column_stack([area * p[:, i] * p[:, j] for i, j in idx])
    Q = np.zeros((len(V), 10))
    flat = F.ravel()
    for k in range(10):
        Q[:, k] = np.bincount(flat, weights=np.repeat(qf[:, k], 3), minlength=len(V))
    return Q


def _qerr(Q, P):
    """Erro quadrático de colocar cada vértice em P (E x 3)."""
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    return (Q[:, 0] * x * x + 2 * Q[:, 1] * x * y + 2 * Q[:, 2] * x * z + 2 * Q[:, 3] * x
            + Q[:, 4] * y * y + 2 * Q[:, 5] * y * z + 2 * Q[:, 6] * y
            + Q[:, 7] * z * z + 2 * Q[:, 8] * z + Q[:, 9])


def _compact(V, F, C, used, frozen):
    newid = np.cumsum(used) - 1
    return V[used], newid[F], C[used], frozen[used]


def decimate(V, F, C, target, band=BAND, span=TS):
    """Simplifica a malha por colapso de arestas (QEM), em lote e vetorizado.
    Só o miolo da região (centroide dentro de [0, span)) é simplificado e contado no limite.
    Faces que tocam a faixa da borda ficam congeladas: a região vizinha gera exatamente a mesma malha ali."""
    cen = V[F].mean(axis=1)
    keep = (cen[:, 0] >= 0) & (cen[:, 0] < span) & (cen[:, 2] >= 0) & (cen[:, 2] < span)
    F = F[keep]
    used = np.zeros(len(V), bool); used[F.ravel()] = True
    V, F, C, _ = _compact(V, F, C, used, np.zeros(len(V), bool))
    V = V.astype(np.float64)
    nV = len(V)
    inside = (V[:, 0] >= band) & (V[:, 0] <= span - band) & (V[:, 2] >= band) & (V[:, 2] <= span - band)
    frozen = np.zeros(nV, bool)
    frozen[F[~inside[F].all(axis=1)].ravel()] = True
    Q = _quadrics(V, F)
    while len(F) > target:
        nV = len(V)
        e = np.sort(np.concatenate([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]]), axis=1).astype(np.int64)
        uk = np.unique(e[:, 0] * nV + e[:, 1])
        ea = uk // nV; eb = uk % nV
        mid = (V[ea] + V[eb]) * 0.5
        Qs = Q[ea] + Q[eb]
        cost = np.empty(len(ea))
        for s in range(0, len(ea), 1_000_000):
            cost[s:s + 1_000_000] = _qerr(Qs[s:s + 1_000_000], mid[s:s + 1_000_000])
        cost[frozen[ea] | frozen[eb]] = np.inf
        order = np.argsort(cost, kind='stable')
        rank = np.empty(len(cost), np.int64); rank[order] = np.arange(len(cost))
        best = np.full(nV, np.iinfo(np.int64).max, np.int64)
        np.minimum.at(best, ea, rank); np.minimum.at(best, eb, rank)
        sel = (rank == best[ea]) & (rank == best[eb]) & np.isfinite(cost)
        if not sel.any():
            break
        a = ea[sel]; b = eb[sel]
        V[a] = mid[sel]; Q[a] = Qs[sel]
        remap = np.arange(nV)
        remap[b] = a
        F = remap[F]
        F = F[(F[:, 0] != F[:, 1]) & (F[:, 1] != F[:, 2]) & (F[:, 2] != F[:, 0])]
        used = np.zeros(nV, bool); used[F.ravel()] = True
        V, F, C, frozen = _compact(V, F, C, used, frozen)
        Q = Q[used]
        if len(F) <= target:
            print(f'    simplificação: {len(F)} triângulos', flush=True)
    return V, F, C


def colour_at(v, solid, lut_ids, ids, shape):
    """Cor do bloco sólido mais próximo de cada vértice (v em coordenadas de grade)."""
    base = np.floor(v).astype(np.int64)
    best_d = np.full(len(v), np.inf)
    out = np.zeros((len(v), 3), np.uint8)
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                c = base + (dx, dy, dz)
                c = np.minimum(c, np.array(shape) - 1)
                ok = solid[c[:, 0], c[:, 1], c[:, 2]]
                d = ((c - v) ** 2).sum(axis=1)
                take = ok & (d < best_d)
                if take.any():
                    cc = c[take]
                    out[take] = lut_ids[ids[cc[:, 0], cc[:, 1], cc[:, 2]]]
                    best_d[take] = d[take]
    return out


def cubes(keys, lut):
    """Peças pequenas em cubos (greedy). Cada quad tem vértices próprios, então a sombra é chapada por face.
    Retorna vértices (locais), cores e triângulos com a frente para fora."""
    quads = greedy_mesh(keys, 0, 0, 0)
    n = len(quads)
    if n == 0:
        return np.zeros((0, 3)), np.zeros((0, 3), np.uint8), np.zeros((0, 3), np.int64)
    q = np.array([(d, sgn, plane, u0, v0, du, dv, key) for (d, sgn, plane, u0, v0, du, dv, key) in quads], np.int64)
    d, sgn, plane, u0, v0, du, dv, key = q.T
    idx = np.arange(n)
    U = U_AX[d]; Vx = V_AX[d]
    mn = np.zeros((n, 3)); mn[idx, d] = plane; mn[idx, U] = u0; mn[idx, Vx] = v0
    eu = np.zeros((n, 3)); eu[idx, U] = du
    ev = np.zeros((n, 3)); ev[idx, Vx] = dv
    p0, p1, p2, p3 = mn, mn + eu, mn + eu + ev, mn + ev
    nsign = np.sign(np.cross(eu, ev)[idx, d])
    flip = (nsign * sgn) < 0
    p1f = np.where(flip[:, None], p3, p1); p3f = np.where(flip[:, None], p1, p3)
    verts = np.stack([p0, p1f, p2, p3f], axis=1).reshape(-1, 3)
    cols = np.array([lut[k] for k in key], np.uint8)
    colours = np.repeat(cols, 4, axis=0)
    base = np.arange(n) * 4
    faces = np.concatenate([np.stack([base, base + 1, base + 2], 1), np.stack([base, base + 2, base + 3], 1)])
    return verts, colours, faces


def build(rx, rz):
    t0 = time.time()
    x0, z0 = rx * TS, rz * TS
    a = load_box(REG, x0 - M, x0 + TS + M, z0 - M, z0 + TS + M, 0, Y)
    ids = (a >> 4).astype(np.int32)
    del a
    ids = aplicar_ruas(ids)  # ruas planas (ver ruas.py)
    solid = (ids != 0) & ~np.isin(ids, list(NATURAL)) & ~np.isin(ids, list(FOLHAGEM)) & ~np.isin(ids, list(DECOR))
    ys = np.flatnonzero(solid.any(axis=(0, 2)))
    if ys.size == 0:
        return write(rx, rz, np.zeros((0, 3)), np.zeros((0, 3), np.uint8), np.zeros((0, 3), np.int64))
    hmax = min(Y, int(ys[-1]) + 4)
    solid = solid[:, :hmax, :]
    ids = ids[:, :hmax, :]
    shape = solid.shape
    print(f'  r.{rx}.{rz}: blocos {int(solid.sum())}, altura até {hmax}, lido em {time.time()-t0:.1f}s', flush=True)

    mx = int(ids.max())
    lut = np.zeros((mx + 1, 3), np.uint8)
    for u in np.unique(ids):
        lut[u] = rgb(int(u))

    # componentes grandes = construção (suave); pequenas e soltas saem; elementos finos ficam em cubos
    lab, _ = ndimage.label(solid)
    sizes = np.bincount(lab.ravel()); big = sizes >= SMALL_MIN; big[0] = False
    big_mask = big[lab]
    del lab, sizes
    thin = np.isin(ids, list(THIN))
    smooth_solid = solid & big_mask & ~thin
    cube_solid = solid & thin
    del big_mask, solid
    print(f'  construções (suaves): {int(smooth_solid.sum())} blocos; finos (cubos): {int(cube_solid.sum())}', flush=True)

    if smooth_solid.any():
        verts, faces, _, _ = measure.marching_cubes(smooth_solid.astype(np.float32), level=0.5, spacing=(1, 1, 1), allow_degenerate=False)
        v = taubin(verts, faces, TAUBIN_ITERS, LAM, MU)
        local = np.empty_like(v)
        local[:, 0] = v[:, 0] - M + 0.5
        local[:, 2] = v[:, 2] - M + 0.5
        local[:, 1] = v[:, 1] + 0.5
        colours = colour_at(v, smooth_solid, lut, ids, shape)
        local, faces, colours = decimate(local, faces.astype(np.int64), colours, TARGET_FACES)
        used, inv = np.unique(faces.ravel(), return_inverse=True)
        faces = inv.reshape(-1, 3)[:, ::-1].astype(np.int64)   # skimage devolve a frente para dentro: inverte
        local = local[used]
        colours = colours[used]
    else:
        local = np.zeros((0, 3)); colours = np.zeros((0, 3), np.uint8); faces = np.zeros((0, 3), np.int64)
    print(f'  suave: {len(faces)} triângulos, {time.time()-t0:.1f}s', flush=True)

    # peças pequenas em cubos (só o miolo da região; a borda fica com a região vizinha)
    keys = np.where(cube_solid[M:M + TS, :, M:M + TS], ids[M:M + TS, :, M:M + TS], 0).astype(np.uint16)
    if keys.any():
        cv, cc, cf = cubes(keys, lut)
    else:
        cv, cc, cf = np.zeros((0, 3)), np.zeros((0, 3), np.uint8), np.zeros((0, 3), np.int64)
    nS = len(local)
    V = np.vstack([local, cv])
    C = np.vstack([colours, cc])
    F = np.vstack([faces, cf + nS]) if len(cf) else faces
    print(f'  cubos: {len(cv)//4} peças; total {len(F)} triângulos, {time.time()-t0:.1f}s', flush=True)
    return write(rx, rz, V, C, F)


def write(rx, rz, local, colours, faces):
    pos = np.clip(np.round(local * 16), -32767, 32767).astype('<i2')
    head = np.array([len(local), len(faces)], '<u4')
    buf = head.tobytes() + pos.tobytes() + colours.astype(np.uint8).tobytes() + faces.astype('<u4').tobytes()
    path = os.path.join(OUT, f'r.{rx}.{rz}.smooth.gz')
    with gzip.open(path, 'wb', compresslevel=9) as f:
        f.write(buf)
    size = os.path.getsize(path)
    print(f'  -> {path} ({size/1e6:.2f} MB)', flush=True)
    return size


if __name__ == '__main__':
    regs = ARENA
    if len(sys.argv) > 1:
        regs = [tuple(int(t) for t in s.split(',')) for s in sys.argv[1:]]
    t0 = time.time()
    for rx, rz in regs:
        build(rx, rz)
    print('pronto em', round(time.time() - t0, 1), 's', flush=True)
