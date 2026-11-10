# Malha greedy por eixo: transforma uma grade de blocos em quads (retângulos) com uma cor por face.
import numpy as np
TRANSP = {0, 8, 9, 20, 102, 95, 160, 50, 31, 37, 38, 39, 40, 59, 81, 83, 106, 111, 175, 176, 177, 65, 66, 27, 28, 63, 68, 69, 70, 72, 75, 76, 77, 78, 85, 101, 107, 113, 132, 139, 140, 143, 147, 148, 157, 171, 172, 37}
def quads_from_mask(M):
    """M: matriz 2D (u,v) de chaves de cor (0 = sem face). Retorna lista de (u0,v0,du,dv,key) gulosa."""
    out = []
    active = {}  # (v0, dv, key) -> índice em out, para estender pelo eixo u
    U, V = M.shape
    for u in range(U):
        row = M[u]
        # runs de chaves iguais e não-zero
        nz = row != 0
        if not nz.any():
            active = {}; continue
        change = np.flatnonzero(np.diff(np.concatenate(([-2], row.astype(np.int64), [-2]))) != 0)
        starts, ends = change[:-1], change[1:]
        new_active = {}
        for s, e in zip(starts, ends):
            key = int(row[s])
            if key == 0: continue
            dv = int(e - s)
            k2 = (int(s), dv, key)
            if k2 in active:
                q = active[k2]; q[2] += 1; new_active[k2] = q
            else:
                q = [u, int(s), 1, dv, key]; out.append(q); new_active[k2] = q
        active = new_active
    return out
def mesh(solid_keys, x0, y0, z0):
    """solid_keys: array [X,Y,Z] de chaves de cor (0 = ar/transparente). Retorna dict eixo->lista de quads."""
    X, Y, Z = solid_keys.shape
    res = []
    pad = np.pad(solid_keys, 1)  # bordas com ar
    for d in range(3):
        for sgn in (1, -1):
            # máscara das faces: voxel sólido cujo vizinho na direção sgn é ar
            sl_c = [slice(1, -1)] * 3
            sl_n = [slice(1, -1)] * 3
            sl_n[d] = slice(1 + sgn, pad.shape[d] - 1 + sgn)
            cur = pad[tuple(sl_c)]; nb = pad[tuple(sl_n)]
            face = (cur != 0) & ((nb == 0))
            keys = np.where(face, cur, 0)
            # também faces de vizinho transparente (água/vidro) já contam como ar acima
            # percorre fatias ao longo de d
            n = keys.shape[d]
            for k in range(n):
                idx = [slice(None)] * 3; idx[d] = k
                M = keys[tuple(idx)]
                if not M.any(): continue
                # ordem (u,v): os dois outros eixos
                ax_u, ax_v = [a for a in range(3) if a != d]
                if ax_u > ax_v: M2 = M.T  # garante u<v na ordem dos eixos restantes
                else: M2 = M
                qs = quads_from_mask(M2)
                plane = k + (1 if sgn > 0 else 0)
                for (u0, v0, du, dv, key) in qs:
                    res.append((d, sgn, plane, u0, v0, du, dv, key))
    return res
