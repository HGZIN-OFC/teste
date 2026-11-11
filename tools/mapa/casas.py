# Casas originais: troca as construções pequenas de voxel (aparência de Minecraft) por casas 3D próprias
# de telhado de quatro águas com cantos levantados, base de pedra, parede de madeira, porta e janelas.
# A colisão continua a mesma (voxel); só a malha visual muda.
import numpy as np
from scipy import ndimage

MAX_FOOT = 40      # maior lado de uma casa (blocos)
MIN_H = 4          # altura mínima (blocos)
MIN_SIZE = 150     # volume mínimo do componente (blocos)


def achar_casas(mask):
    """mask: bool [X,Y,Z] (sólidos suaves). Devolve (máscara das casas, caixas [(x0,x1,y0,y1,z0,z1)])."""
    lab, _ = ndimage.label(mask)
    sl = ndimage.find_objects(lab)
    casa_ids, caixas = [], []
    for i, s in enumerate(sl, 1):
        if s is None:
            continue
        dx = s[0].stop - s[0].start
        dy = s[1].stop - s[1].start
        dz = s[2].stop - s[2].start
        if max(dx, dz) > MAX_FOOT or dy < MIN_H or min(dx, dz) < 4:
            continue
        if int((lab[s] == i).sum()) < MIN_SIZE:
            continue
        casa_ids.append(i)
        caixas.append((s[0].start, s[0].stop, s[1].start, s[1].stop, s[2].start, s[2].stop))
    mask_h = np.isin(lab, casa_ids) if casa_ids else np.zeros_like(mask)
    return mask_h, caixas


COR = {
    'parede': (150, 100, 58),
    'base': (146, 140, 128),
    'telhado': (58, 66, 82),
    'porta': (52, 30, 18),
    'janela': (250, 208, 120),
}


def _tom(c, seed, amp=10):
    r = np.random.RandomState(seed % (2 ** 31))
    return tuple(int(np.clip(v + r.randint(-amp, amp + 1), 0, 255)) for v in c)


class Malha:
    def __init__(self):
        self.v, self.c, self.f, self.n = [], [], [], 0

    def tri(self, a, b, c, col, hint):
        a, b, c = (np.asarray(p, float) for p in (a, b, c))
        if np.dot(np.cross(b - a, c - a), np.asarray(hint, float)) < 0:
            b, c = c, b                       # garante que a frente aponta para fora
        self.v += [a, b, c]
        self.c += [col, col, col]
        self.f.append((self.n, self.n + 1, self.n + 2))
        self.n += 3

    def quad(self, p0, p1, p2, p3, col, hint):
        self.tri(p0, p1, p2, col, hint)
        self.tri(p0, p2, p3, col, hint)

    def caixa(self, x0, x1, y0, y1, z0, z1, col):
        self.quad((x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1), col, (0, 0, 1))
        self.quad((x1, y0, z0), (x0, y0, z0), (x0, y1, z0), (x1, y1, z0), col, (0, 0, -1))
        self.quad((x1, y0, z1), (x1, y0, z0), (x1, y1, z0), (x1, y1, z1), col, (1, 0, 0))
        self.quad((x0, y0, z0), (x0, y0, z1), (x0, y1, z1), (x0, y1, z0), col, (-1, 0, 0))
        self.quad((x0, y1, z1), (x1, y1, z1), (x1, y1, z0), (x0, y1, z0), col, (0, 1, 0))
        self.quad((x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1), col, (0, -1, 0))

    def arrays(self):
        V = np.array(self.v, float).reshape(-1, 3)
        C = np.array(self.c, np.uint8).reshape(-1, 3)
        F = np.array(self.f, np.int64).reshape(-1, 3)
        return V, C, F


def _casa(m, box, M, seed):
    x0, x1, y0, y1, z0, z1 = box
    # convenção de smooth.py: borda do bloco de índice i fica em i - M (xz) e i (y)
    X0, X1, Z0, Z1 = x0 - M, x1 - M, z0 - M, z1 - M
    Y0, Y1 = float(y0), float(y1)
    dx, dz, dy = X1 - X0, Z1 - Z0, Y1 - Y0
    xc, zc = (X0 + X1) / 2, (Z0 + Z1) / 2
    parede = _tom(COR['parede'], seed)
    base = _tom(COR['base'], seed + 1, 6)
    telha = _tom(COR['telhado'], seed + 2, 6)
    # base de pedra (um pouco mais larga) e parede de madeira
    m.caixa(X0 - 0.15, X1 + 0.15, Y0, Y0 + 1.0, Z0 - 0.15, Z1 + 0.15, base)
    yw = Y1 - max(1.5, min(min(dx, dz) * 0.55, dy * 0.45, 6.0))
    m.caixa(X0, X1, Y0 + 1.0, yw, Z0, Z1, parede)
    # telhado de quatro águas; cantos levantados (ov = beirada, up = curvatura)
    ov, up = 0.9, 0.35
    A = (X0 - ov, yw + up, Z0 - ov)
    B = (X1 + ov, yw + up, Z0 - ov)
    C = (X1 + ov, yw + up, Z1 + ov)
    D = (X0 - ov, yw + up, Z1 + ov)
    pitch = max(2.5, min(min(dx, dz) * 0.5, 7.0))   # altura do telhado (sempre com inclinação)
    yr = yw + pitch + 0.2
    if dx >= dz:
        h = (dx - dz) / 2                  # comprimento da cumeeira / 2
        R1 = (xc - h, yr, zc)
        R2 = (xc + h, yr, zc)
        m.quad(A, B, R2, R1, telha, (0, 1, -1))     # água da frente (-z)
        m.quad(C, D, R1, R2, telha, (0, 1, 1))      # água de trás (+z)
        m.tri(A, D, R1, telha, (-1, 0.3, 0))        # ponta -x
        m.tri(B, C, R2, telha, (1, 0.3, 0))         # ponta +x
    else:
        h = (dz - dx) / 2
        R1 = (xc, yr, zc - h)
        R2 = (xc, yr, zc + h)
        m.quad(A, R1, R2, D, telha, (-1, 1, 0))     # água -x
        m.quad(B, C, R2, R1, telha, (1, 1, 0))      # água +x
        m.tri(A, B, R1, telha, (0, 0.3, -1))        # ponta -z
        m.tri(C, D, R2, telha, (0, 0.3, 1))         # ponta +z
    # porta e janelas na face -z
    fz = Z0 - 0.03
    if dx >= 4:
        m.quad((xc - 0.7, Y0 + 1.0, fz), (xc + 0.7, Y0 + 1.0, fz),
               (xc + 0.7, Y0 + 3.0, fz), (xc - 0.7, Y0 + 3.0, fz),
               _tom(COR['porta'], seed + 3, 4), (0, 0, -1))
        for sx in (-1, 1):
            cx = xc + sx * dx / 3.2
            if abs(cx - xc) < 1.6 or (cx - 0.5) < X0 + 0.5 or (cx + 0.5) > X1 - 0.5:
                continue
            m.quad((cx - 0.5, Y0 + 2.0, fz), (cx + 0.5, Y0 + 2.0, fz),
                   (cx + 0.5, Y0 + 3.0, fz), (cx - 0.5, Y0 + 3.0, fz),
                   _tom(COR['janela'], seed + 4, 6), (0, 0, -1))


def casas_mesh(caixas, M, core, seed0=0):
    """Malha de todas as casas cujo centro cai dentro do núcleo da região [M, M+core)."""
    m = Malha()
    n = 0
    for k, box in enumerate(caixas):
        x0, x1, _, _, z0, z1 = box
        cx = (x0 + x1) / 2
        cz = (z0 + z1) / 2
        if not (M <= cx < M + core and M <= cz < M + core):
            continue
        _casa(m, box, M, seed0 + k * 31 + x0 * 7 + z0 * 13)
        n += 1
    V, C, F = m.arrays()
    return V, C, F, n
