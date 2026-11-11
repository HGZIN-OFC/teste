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


def _lerp(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def _lado(m, E0, E1, T0, T1, col_a, col_b, hint, curl, n=6, lamp=None):
    """Água de telhado: borda de beiral E0->E1 (curva, cantos levantados) até o topo T0->T1 (cumeeira/cantos).
    Faixas alternadas de telha (col_a/col_b) dão a leitura de telhado de verdade."""
    pts_e, pts_t = [], []
    for i in range(n + 1):
        t = i / n
        e = _lerp(E0, E1, t)
        lift = curl * (2 * t - 1) ** 2            # cantos sobem (curva de beiral)
        pts_e.append((e[0], e[1] + lift, e[2]))
        pts_t.append(_lerp(T0, T1, t))
    for i in range(n):
        col = col_a if i % 2 == 0 else col_b
        m.quad(pts_e[i], pts_e[i + 1], pts_t[i + 1], pts_t[i], col, hint)


def _ponta(m, E0, E1, T, col, hint, curl, n=4):
    """Água de ponta (hip): leque da borda até o topo de um ponto."""
    pts = []
    for i in range(n + 1):
        t = i / n
        e = _lerp(E0, E1, t)
        pts.append((e[0], e[1] + curl * (2 * t - 1) ** 2, e[2]))
    for i in range(n):
        m.tri(pts[i], pts[i + 1], T, col, hint)


def _caixa_fina(m, c, dim, col):
    """Viga/pilar fino centrado em c com meia-largura dim=(hx,hy,hz)."""
    m.caixa(c[0] - dim[0], c[0] + dim[0], c[1] - dim[1], c[1] + dim[1], c[2] - dim[2], c[2] + dim[2], col)


def _janela(m, cx, cy, z, w, h, seed, shoji=True):
    """Janela shoji: moldura escura atrás, papel iluminado na frente e grade de ripas. z é a face da parede (frente = -z)."""
    frame = _tom(COR['porta'], seed + 9, 4)
    m.quad((cx - w - 0.14, cy - h - 0.14, z - 0.02), (cx + w + 0.14, cy - h - 0.14, z - 0.02),
           (cx + w + 0.14, cy + h + 0.14, z - 0.02), (cx - w - 0.14, cy + h + 0.14, z - 0.02), frame, (0, 0, -1))
    m.quad((cx - w, cy - h, z - 0.05), (cx + w, cy - h, z - 0.05),
           (cx + w, cy + h, z - 0.05), (cx - w, cy + h, z - 0.05), _tom(COR['janela'], seed + 4, 6), (0, 0, -1))
    for fx in (-w / 3, w / 3):
        m.quad((cx + fx - 0.05, cy - h, z - 0.07), (cx + fx + 0.05, cy - h, z - 0.07),
               (cx + fx + 0.05, cy + h, z - 0.07), (cx + fx - 0.05, cy + h, z - 0.07), frame, (0, 0, -1))
    m.quad((cx - w, cy - 0.05, z - 0.07), (cx + w, cy - 0.05, z - 0.07),
           (cx + w, cy + 0.05, z - 0.07), (cx - w, cy + 0.05, z - 0.07), frame, (0, 0, -1))


def _telhado(m, X0, X1, Z0, Z1, yb, pitch, ov, curl, telha, telha2, madeira):
    """Telhado de quatro águas sobre o retângulo [X0,X1]x[Z0,Z1] com base em yb."""
    dx, dz = X1 - X0, Z1 - Z0
    xc, zc = (X0 + X1) / 2, (Z0 + Z1) / 2
    up = 0.3
    A = (X0 - ov, yb + up, Z0 - ov)
    B = (X1 + ov, yb + up, Z0 - ov)
    C = (X1 + ov, yb + up, Z1 + ov)
    D = (X0 - ov, yb + up, Z1 + ov)
    yr = yb + pitch + 0.2
    if dx >= dz:
        h = max((dx - dz) / 2, 1.2)
        R1 = (xc - h, yr, zc)
        R2 = (xc + h, yr, zc)
        _lado(m, A, B, R1, R2, telha, telha2, (0, 1, -1), curl)     # frente (-z)
        _lado(m, D, C, R1, R2, telha, telha2, (0, 1, 1), curl)      # trás (+z)
        _ponta(m, A, D, R1, telha, (-1, 0.3, 0), curl)              # ponta -x
        _ponta(m, B, C, R2, telha, (1, 0.3, 0), curl)               # ponta +x
        _caixa_fina(m, (xc, yr + 0.12, zc), (h + 0.3, 0.18, 0.35), madeira)   # cumeeira
    else:
        h = max((dz - dx) / 2, 1.2)
        R1 = (xc, yr, zc - h)
        R2 = (xc, yr, zc + h)
        _lado(m, A, D, R1, R2, telha, telha2, (-1, 1, 0), curl)     # -x
        _lado(m, B, C, R1, R2, telha, telha2, (1, 1, 0), curl)      # +x
        _ponta(m, A, B, R1, telha, (0, 0.3, -1), curl)              # ponta -z
        _ponta(m, D, C, R2, telha, (0, 0.3, 1), curl)               # ponta +z
        _caixa_fina(m, (xc, yr + 0.12, zc), (0.35, 0.18, h + 0.3), madeira)


def _casa(m, box, M, seed):
    x0, x1, y0, y1, z0, z1 = box
    # convenção de smooth.py: borda do bloco de índice i fica em i - M (xz) e i (y)
    X0, X1, Z0, Z1 = x0 - M, x1 - M, z0 - M, z1 - M
    Y0, Y1 = float(y0), float(y1)
    dx, dz, dy = X1 - X0, Z1 - Z0, Y1 - Y0
    xc, zc = (X0 + X1) / 2, (Z0 + Z1) / 2
    parede = _tom(COR['parede'], seed)
    parede2 = _tom(COR['parede'], seed + 11, 14)
    madeira = _tom((96, 62, 36), seed + 12, 6)          # pilares e vigas (mais escuros)
    base = _tom(COR['base'], seed + 1, 6)
    telha = _tom(COR['telhado'], seed + 2, 6)
    telha2 = _tom((76, 86, 104), seed + 5, 6)
    lanterna = (255, 176, 84)

    # base de pedra com degrau na porta
    m.caixa(X0 - 0.2, X1 + 0.2, Y0, Y0 + 1.0, Z0 - 0.2, Z1 + 0.2, base)
    m.caixa(xc - 1.0, xc + 1.0, Y0 + 1.0, Y0 + 1.25, Z0 - 0.75, Z0 - 0.2, base)   # degrau
    # parede de madeira com faixa escura no rodapé e viga de topo
    yw = Y1 - max(1.5, min(min(dx, dz) * 0.55, dy * 0.45, 6.0))
    m.caixa(X0, X1, Y0 + 1.0, yw, Z0, Z1, parede)
    m.caixa(X0 - 0.02, X1 + 0.02, Y0 + 1.0, Y0 + 1.5, Z0 - 0.02, Z1 + 0.02, madeira)
    m.caixa(X0 - 0.12, X1 + 0.12, yw - 0.35, yw, Z0 - 0.12, Z1 + 0.12, madeira)   # viga sob o beiral
    # pilares de canto (madeira escura, saltam da parede)
    for px in (X0, X1):
        for pz in (Z0, Z1):
            _caixa_fina(m, (px, (Y0 + 1.0 + yw) / 2, pz), (0.18, (yw - Y0 - 1.0) / 2, 0.18), madeira)

    # telhado em dois andares (pagode): o de baixo, largo, e um menor em cima
    if min(dx, dz) >= 9:
        sh = min(dx, dz) * 0.22
        _telhado(m, X0, X1, Z0, Z1, yw, pitch=3.2, ov=0.9, curl=0.8, telha=telha, telha2=telha2, madeira=madeira)
        _telhado(m, X0 + sh, X1 - sh, Z0 + sh, Z1 - sh, yw + 3.0, pitch=2.6, ov=0.5, curl=0.5, telha=telha, telha2=telha2, madeira=madeira)
    else:
        _telhado(m, X0, X1, Z0, Z1, yw, pitch=max(3.0, min(min(dx, dz) * 0.55, 7.0)), ov=0.75, curl=0.7, telha=telha, telha2=telha2, madeira=madeira)

    # frente (-z): porta com moldura, lanternas e janelas
    fz = Z0 - 0.04
    if dx >= 4:
        m.quad((xc - 0.95, Y0 + 1.25, fz - 0.02), (xc + 0.95, Y0 + 1.25, fz - 0.02),
               (xc + 0.95, Y0 + 3.4, fz - 0.02), (xc - 0.95, Y0 + 3.4, fz - 0.02), madeira, (0, 0, -1))  # moldura
        m.quad((xc - 0.7, Y0 + 1.25, fz - 0.04), (xc + 0.7, Y0 + 1.25, fz - 0.04),
               (xc + 0.7, Y0 + 3.2, fz - 0.04), (xc - 0.7, Y0 + 3.2, fz - 0.04),
               _tom(COR['porta'], seed + 3, 4), (0, 0, -1))
        # lanternas acesas nas laterais da porta
        for sx in (-1, 1):
            lx = xc + sx * 1.6
            _caixa_fina(m, (lx, Y0 + 2.6, fz - 0.15), (0.2, 0.3, 0.12), madeira)
            m.quad((lx - 0.14, Y0 + 2.4, fz - 0.28), (lx + 0.14, Y0 + 2.4, fz - 0.28),
                   (lx + 0.14, Y0 + 2.8, fz - 0.28), (lx - 0.14, Y0 + 2.8, fz - 0.28), lanterna, (0, 0, -1))
        for sx in (-1, 1):
            cx = xc + sx * dx / 3.2
            if abs(cx - xc) < 2.2 or (cx - 1.0) < X0 + 0.4 or (cx + 1.0) > X1 - 0.4:
                continue
            _janela(m, cx, Y0 + 2.6, fz, 0.7, 0.55, seed + int(sx * 17))
    # laterais (+x/-x): uma janela shoji em cada parede lateral
    for sxw in (X0 - 0.04, X1 + 0.04):
        if dz >= 5:
            cz = zc
            # janela em plano YZ: reaproveita o quad com eixo x
            w, hh = 0.7, 0.55
            ex = -1 if sxw < xc else 1
            m.quad((sxw, Y0 + 2.0, cz - w), (sxw, Y0 + 2.0, cz + w),
                   (sxw, Y0 + 3.2, cz + w), (sxw, Y0 + 3.2, cz - w), _tom(COR['porta'], seed + 8, 4), (ex, 0, 0))
            m.quad((sxw + ex * 0.02, Y0 + 2.12, cz - w + 0.12), (sxw + ex * 0.02, Y0 + 2.12, cz + w - 0.12),
                   (sxw + ex * 0.02, Y0 + 3.08, cz + w - 0.12), (sxw + ex * 0.02, Y0 + 3.08, cz - w + 0.12),
                   _tom(COR['janela'], seed + 6, 6), (ex, 0, 0))


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
