# Regenera a grade de terreno (.terr, 129x129, 4 m) das regiões da arena com as ruas de pedra/areia/cascalho
# (ids 1, 12, 13 na superfície) alisadas: altura suave por média normalizada, sem degraus nem buracos.
import sys, os, gzip
sys.path.insert(0, '/home/claude/mapbuild')
import numpy as np
from scipy import ndimage
from anvil import load_box
from paths import REG
Y = 256; MG = 32
OUT = '/home/claude/shinobi-wilds/public/mundo'
NAT = np.array([1, 2, 3, 7, 8, 9, 10, 11, 12, 13, 78, 79, 80, 82, 110, 87, 88])
RUA = np.array([1, 12, 13])
SIG = 3.0
REGIOES = [(rx, rz) for rx in (-1, 0, 1) for rz in (-4, -3, -2)]
for (rx, rz) in REGIOES:
    x0, z0 = rx * 512, rz * 512
    a = load_box(REG, x0 - MG, x0 + 512 + MG, z0 - MG, z0 + 512 + MG, 0, Y)
    ids = (a >> 4).astype(np.int32); del a
    nat = np.isin(ids, NAT)
    rn = nat[:, ::-1, :]
    has = rn.any(axis=1)
    nt = np.where(has, Y - rn.argmax(axis=1), 0).astype(np.float32)
    top_id = np.take_along_axis(ids, np.clip(Y - rn.argmax(axis=1) - 1, 0, Y - 1)[:, None, :], axis=1)[:, 0, :]
    # só trechos planos (ruas e praças): encostas e montanhas ficam como estão
    flat = (ndimage.maximum_filter(nt, 9) - ndimage.minimum_filter(nt, 9)) <= 4
    mask = has & np.isin(top_id, RUA) & flat
    # alisa só o trecho de rua (com margem), depois recorta
    val = np.where(mask, nt, 0).astype(np.float32); w = mask.astype(np.float32)
    H = ndimage.gaussian_filter(val, SIG) / np.maximum(ndimage.gaussian_filter(w, SIG), 1e-6)
    h = np.where(mask, H, nt)
    # o chão nunca fica abaixo de um bloco natural vizinho (janela ±2 m cobre a interpolação de 4 m):
    # evita buracos onde o personagem atravessava
    h = ndimage.maximum_filter(h, size=5)
    h = h[MG:MG + 512, MG:MG + 512]
    # mesma amostragem de export2: grade de 4 m incluindo a borda 512
    idx = np.clip(np.arange(0, 513, 4), 0, 511)
    grid = np.clip(np.round(h[np.ix_(idx, idx)]), 0, 255).astype(np.uint8)
    raw = os.path.join(OUT, 'r.%d.%d.terr' % (rx, rz))
    grid.tofile(raw)
    with open(raw, 'rb') as f, gzip.open(raw + '.gz', 'wb', compresslevel=9) as g:
        g.write(f.read())
    os.remove(raw)
    print(rx, rz, int(mask.sum()), flush=True)
print('done', flush=True)
