# Exporta cada região em 3 partes para o navegador:
#  - terreno: altura natural (pedra, terra, grama, água...) numa grade de 4 m (129x129)
#  - estruturas: blocos não naturais (casas, muros, árvores...) como malha greedy
#  - alt: altura total por bloco (1 m), para colisão (paredes e telhados bloqueiam)
import sys, os, json, time
sys.path.insert(0, '/home/claude/mapbuild')
import numpy as np
from anvil import load_box
from mesher import mesh, TRANSP
from palette import rgb
from paths import REG, TILES_DIR, tile_list
from PIL import Image
OUT = '/home/claude/shinobi-wilds/public/mundo'
os.makedirs(OUT + '/tex', exist_ok=True)
Y = 256
NATURAL = {1, 2, 3, 7, 8, 9, 10, 11, 12, 13, 78, 79, 80, 82, 110, 87, 88}
FOLHAGEM = (18, 161)  # folhagem: fica só na textura (visão aérea), não vira malha nem colisão
pal = {}
def cidx(c):
    if c not in pal: pal[c] = len(pal)
    return pal[c]
def export(rx, rz):
    x0, z0 = rx * 512, rz * 512
    name = 'r.%d.%d' % (rx, rz)
    a = load_box(REG, x0, x0 + 512, z0, z0 + 512, 0, Y)
    ids = (a >> 4).astype(np.int32)
    natural = np.isin(ids, list(NATURAL))
    folhagem = np.isin(ids, list(FOLHAGEM))
    struct_mask = (ids != 0) & ~natural & ~folhagem
    # altura natural por coluna (topo do terreno)
    rev_n = natural[:, ::-1, :]
    has_n = rev_n.any(axis=1)
    top_n = (Y - 1 - rev_n.argmax(axis=1)) + 1
    terr_h = np.where(has_n, top_n, 0).astype(np.uint8)              # [512,512] (x,z)
    # altura total (colisão)
    solid_all = (ids != 0) & ~folhagem
    rev_s = solid_all[:, ::-1, :]
    has_s = rev_s.any(axis=1)
    top_s = (Y - 1 - rev_s.argmax(axis=1)) + 1
    alt = np.where(has_s, top_s, 0).astype(np.uint8)
    # grade do terreno em 4 m (inclui borda 512)
    idx = np.clip(np.arange(0, 513, 4), 0, 511)
    grid = terr_h[np.ix_(idx, idx)]  # 129x129, [x][z]
    grid.tofile(os.path.join(OUT, name + '.terr'))
    alt.tofile(os.path.join(OUT, name + '.alt'))
    # estruturas: malha greedy só com blocos não naturais
    keys = np.where(struct_mask, ids, 0).astype(np.uint16)
    qs = mesh(keys, 0, 0, 0)
    rows = np.zeros((len(qs), 8), dtype=np.int16)
    for i, (d, sgn, plane, u0, v0, du, dv, key) in enumerate(qs):
        if d == 0: mn = [plane, u0, v0]; sz = [0, du, dv]
        elif d == 1: mn = [u0, plane, v0]; sz = [du, 0, dv]
        else: mn = [u0, v0, plane]; sz = [du, dv, 0]
        rows[i, 0:3] = mn; rows[i, 3:6] = sz
        rows[i, 6] = d * 2 + (1 if sgn > 0 else 0)
        rows[i, 7] = cidx(rgb(key))
    rows.tofile(os.path.join(OUT, name + '.quads'))
    # textura do mapa (visão aérea 1 px = 1 m)
    src = os.path.join(TILES_DIR, '%d.%d.png' % (rx, rz))
    if os.path.exists(src):
        im = Image.open(src).convert('RGBA')
        bg = Image.new('RGB', im.size, (30, 60, 30)); bg.paste(im, (0, 0), im)
        bg.save(os.path.join(OUT, 'tex', name + '.jpg'), quality=85)
    return len(qs)
if __name__ == '__main__':
    t0 = time.time(); total = 0; tl = tile_list()
    for (rx, rz) in tl:
        n = export(rx, rz); total += n
        print(rx, rz, n, round(time.time() - t0, 1), flush=True)
    pl = [list(c) for c, i in sorted(pal.items(), key=lambda kv: kv[1])]
    json.dump({'regioes': [list(t) for t in tl], 'paleta': pl, 'tamanho': 512, 'altura_max': Y, 'passo_terreno': 4},
              open(os.path.join(OUT, 'indice.json'), 'w'))
    print('total quads', total, 'cores', len(pl), flush=True)
