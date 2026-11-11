# Ruas planas: nas colunas em que o topo é piso de rua (cobblestone, arenito, end stone, lajes)
# e fica 1 a 3 blocos acima do terreno natural, a superfície da rua vira um plano suave:
#  - o piso acima dessa superfície é removido (sobra o buraco/degrau irregular)
#  - o vão entre o terreno e a superfície é preenchido com o mesmo piso (sem buraco)
# Aplicado igual na colisão (export_solid), na malha suave (smooth) e na altura (alt).
import numpy as np
from scipy import ndimage

Y = 256
NATURAL = np.array([1, 2, 3, 7, 8, 9, 10, 11, 12, 13, 78, 79, 80, 82, 110, 87, 88])
FOLHAGEM = np.array([18, 161])
DECOR = np.array([6, 27, 28, 30, 31, 32, 37, 38, 39, 40, 50, 59, 63, 65, 66, 68, 69, 70, 72, 75, 76, 77, 83, 106, 111, 131, 132, 140, 141, 142, 143, 147, 148, 157, 171, 175, 176, 177])
PAVE = np.array([4, 24, 121, 43, 44, 98])
SIGMA = 3.0  # suavização da superfície (m)


def aplicar_ruas(ids):
    """ids: [X, Y, Z] int32 (id do bloco). Devolve cópia com as ruas planas."""
    ids = ids.copy()
    ignore = np.isin(ids, np.concatenate([FOLHAGEM, DECOR])) | (ids == 0)
    nat = np.isin(ids, NATURAL)
    # topo natural (altura exclusiva) por coluna
    rn = nat[:, ::-1, :]
    has_n = rn.any(axis=1)
    nt = np.where(has_n, Y - rn.argmax(axis=1), 0)
    # topo sólido (ignora decoração e folhagem)
    sol = ~ignore
    rs = sol[:, ::-1, :]
    has_s = rs.any(axis=1)
    k = rs.argmax(axis=1)
    ts = np.where(has_s, Y - k, 0)
    top_id = np.take_along_axis(ids, np.clip(Y - 1 - k, 0, Y - 1)[:, None, :], axis=1)[:, 0, :]
    # colunas de rua
    mask = has_s & np.isin(top_id, PAVE) & (ts - nt >= 1) & (ts - nt <= 3)
    if not mask.any():
        return ids
    # superfície suave: média normalizada das alturas das colunas de rua
    val = np.where(mask, ts, 0).astype(np.float32)
    w = mask.astype(np.float32)
    H = ndimage.gaussian_filter(val, SIGMA) / np.maximum(ndimage.gaussian_filter(w, SIGMA), 1e-6)
    Hs = np.clip(np.round(H), 1, Y - 1).astype(np.int32)
    Hs = np.maximum(Hs, nt + 1)
    ys = np.arange(Y, dtype=np.int32)[None, :, None]
    m3 = mask[:, None, :]
    Hs3 = Hs[:, None, :]
    nt3 = nt[:, None, :]
    tid3 = top_id[:, None, :]
    # vão entre o terreno natural e a superfície da rua: preenche com o piso
    fill = m3 & (ys >= nt3) & (ys < Hs3) & (ids == 0)
    ids = np.where(fill, tid3, ids)
    # piso acima da superfície: sai
    clear = m3 & (ys >= Hs3) & np.isin(ids, PAVE)
    ids = np.where(clear, 0, ids)
    return ids
