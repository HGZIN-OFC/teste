# Converte o mapa .glb inteiro para as 9 regiões da arena no formato do jogo:
#  - r.X.Z.smooth.gz : malha visual (posições i16 x16, cor RGB u8, triângulos u32), coordenadas locais da região
#  - r.X.Z.terr.gz   : altura do chão a cada 4 m (129x129, u8), a partir dos elementos de terreno do GLB
#  - r.X.Z.solid.gz  : colisão de voxel zerada (o mapa novo não tem colisão de construções ainda)
import sys, gzip, time, os
sys.path.insert(0, '/home/claude/glb')
import numpy as np
import gltf

GLB = '/home/claude/glb/mundo.glb'
OUT = '/home/claude/shinobi-wilds/public/mundo'
OX, OY, OZ = 256.0, 60.0, -1280.0 - 35.0       # centro do mapa (x 0, z 35) -> centro da arena; y do GLB +60
ARENA_X0, ARENA_Z0 = -512, -2048                # arena: rx -1..1, rz -4..-2
SEA_Y = 58.7                                    # nível do mar (-1,3 no GLB + 60)
TERRENO = ('Relevo', 'Terreno', 'Caminhos', 'Fundac', 'Embasamento', 'Mar')
REGIOES = [(rx, rz) for rx in (-1, 0, 1) for rz in (-4, -3, -2)]

t0 = time.time()
j, BIN = gltf.carregar(GLB)
prims = gltf.primitivas_completas(j, BIN)
print('primitivas', len(prims), round(time.time() - t0, 1), flush=True)

# 1) coloca no mundo do jogo
for p in prims:
    p['pos'] = p['pos'] + np.array([OX, OY, OZ])
    if p['flip']:
        p['ind'] = p['ind'][:, ::-1]

# 2) mar: uma placa por região (cobre toda a arena; o GLB fica por cima onde há terra)
mar_tris = []
for (rx, rz) in REGIOES:
    x0, z0 = rx * 512, rz * 512
    base = np.array([[x0, SEA_Y, z0], [x0 + 512, SEA_Y, z0], [x0 + 512, SEA_Y, z0 + 512], [x0, SEA_Y, z0 + 512]], float)
    prims.append({'nome': 'mar_arena', 'pos': base, 'ind': np.array([[0, 2, 1], [0, 3, 2]]),
                  'cor': np.tile(np.array([54, 104, 150.0]), (4, 1)), 'flip': False})

# 3) altura do chão: rasteriza os triângulos de terreno no grid de 1 m (máximo = topo)
H = np.full((1536, 1536), -np.inf)
for p in prims:
    if not any(p['nome'].startswith(k) for k in TERRENO) and p['nome'] != 'mar_arena':
        continue
    if p['nome'] == 'mar_arena':
        continue
    P = p['pos']; I = p['ind']
    a, b, c = P[I[:, 0]], P[I[:, 1]], P[I[:, 2]]
    # todas as faces de terreno (inclusive encostas): sem isso as encostas ficam sem chão e caem no mar
    for ta, tb, tc in zip(a, b, c):
        x0 = max(int(np.floor(min(ta[0], tb[0], tc[0]))) - ARENA_X0, 0)
        x1 = min(int(np.ceil(max(ta[0], tb[0], tc[0]))) - ARENA_X0, 1535)
        z0 = max(int(np.floor(min(ta[2], tb[2], tc[2]))) - ARENA_Z0, 0)
        z1 = min(int(np.ceil(max(ta[2], tb[2], tc[2]))) - ARENA_Z0, 1535)
        if x1 < x0 or z1 < z0:
            continue
        xs = np.arange(x0, x1 + 1) + ARENA_X0 + 0.5
        zs = np.arange(z0, z1 + 1) + ARENA_Z0 + 0.5
        X, Z = np.meshgrid(xs, zs, indexing='ij')
        d = (tb[2] - tc[2]) * (ta[0] - tc[0]) + (tc[0] - tb[0]) * (ta[2] - tc[2])
        if abs(d) < 1e-9:
            continue
        l1 = ((tb[2] - tc[2]) * (X - tc[0]) + (tc[0] - tb[0]) * (Z - tc[2])) / d
        l2 = ((tc[2] - ta[2]) * (X - tc[0]) + (ta[0] - tc[0]) * (Z - tc[2])) / d
        l3 = 1 - l1 - l2
        inside = (l1 >= -1e-6) & (l2 >= -1e-6) & (l3 >= -1e-6)
        if not inside.any():
            continue
        h = l1 * ta[1] + l2 * tb[1] + l3 * tc[1]
        sub = H[x0:x1 + 1, z0:z1 + 1]
        np.maximum(sub, np.where(inside, h, -np.inf), out=sub)
from scipy import ndimage
falta = ~np.isfinite(H)
if falta.any() and (~falta).any():
    idx = ndimage.distance_transform_edt(falta, return_distances=False, return_indices=True)
    H_pre = H[idx[0], idx[1]]
    H = np.where(falta & (H_pre > -np.inf), H_pre, H)
print('altura do chão rasterizada', round(time.time() - t0, 1), 'com', int(np.isfinite(H).sum()), 'células', flush=True)

# 4) grava as regiões
for (rx, rz) in REGIOES:
    x0, z0 = rx * 512, rz * 512
    # altura: amostra 129x129 a cada 4 m; sem terreno vale o mar
    xs = x0 + np.arange(129) * 4.0
    zs = z0 + np.arange(129) * 4.0
    ix = np.clip((xs - ARENA_X0).astype(int), 0, 1535)
    iz = np.clip((zs - ARENA_Z0).astype(int), 0, 1535)
    hs = H[np.ix_(ix, iz)]
    hs = np.where(np.isfinite(hs), hs, SEA_Y)
    terr = np.clip(np.round(hs), 0, 255).astype(np.uint8)
    with gzip.open(os.path.join(OUT, 'r.%d.%d.terr.gz' % (rx, rz)), 'wb', compresslevel=9) as f:
        f.write(terr.tobytes())
    with gzip.open(os.path.join(OUT, 'r.%d.%d.solid.gz' % (rx, rz)), 'wb', compresslevel=9) as f:
        f.write(np.zeros(512 * 512 * 32, np.uint8).tobytes())

    # triângulos cujo centro cai na região
    corners = []; cols = []
    for p in prims:
        P = p['pos']; I = p['ind']
        if len(I) == 0:
            continue
        cen = (P[I[:, 0]] + P[I[:, 1]] + P[I[:, 2]]) / 3.0
        sel = (np.floor(cen[:, 0] / 512).astype(int) == rx) & (np.floor(cen[:, 2] / 512).astype(int) == rz)
        if not sel.any():
            continue
        Is = I[sel]
        corners.append(P[Is].reshape(-1, 3) - np.array([x0, 0, z0]))
        cols.append(p['cor'][Is].reshape(-1, 3))
    if not corners:
        raise SystemExit('região vazia ' + str((rx, rz)))
    V = np.vstack(corners); C = np.vstack(cols)
    q = np.round(V * 16).astype(np.int32)
    q = np.clip(q, -32768, 32767)
    C8 = np.clip(np.round(C), 0, 255).astype(np.uint8)
    key = np.hstack([q, C8.astype(np.int32)])
    uniq, inv = np.unique(key, axis=0, return_inverse=True)
    inv = inv.reshape(-1)
    nT = len(inv) // 3
    faces = inv.reshape(-1, 3).astype(np.uint32)
    posU = uniq[:, :3].astype('<i2')
    colU = uniq[:, 3:].astype(np.uint8)
    buf = np.array([len(uniq), nT], '<u4').tobytes() + posU.tobytes() + colU.tobytes() + faces.astype('<u4').tobytes()
    with gzip.open(os.path.join(OUT, 'r.%d.%d.smooth.gz' % (rx, rz)), 'wb', compresslevel=9) as f:
        f.write(buf)
    print('região', (rx, rz), 'vértices', len(uniq), 'triângulos', nT, 'KB', len(buf) // 1024, round(time.time() - t0, 1), flush=True)
print('pronto', round(time.time() - t0, 1), flush=True)
