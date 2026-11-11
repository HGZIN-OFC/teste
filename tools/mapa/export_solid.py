# Gera a colisão voxel de cada região: 1 bit por bloco (estruturas sólidas), 512x512x256 -> 512x512x32 bytes.
# Bit do bloco (x,y,z): byte = ((x*512+z)*32 + (y>>3)), bit = 7 - (y&7)  (packbits big-endian no eixo y).
import sys, os, time
sys.path.insert(0, '/home/claude/mapbuild')
import numpy as np
from scipy import ndimage
from anvil import load_box
from ruas import aplicar_ruas
from paths import REG, tile_list
OUT = '/home/claude/shinobi-wilds/public/mundo'
Y = 256
NATURAL = {1, 2, 3, 7, 8, 9, 10, 11, 12, 13, 78, 79, 80, 82, 110, 87, 88}
FOLHAGEM = (18, 161)
THIN = (85, 107, 113, 101, 102, 20, 139)
# decoração que não é bloco cheio (grama, flores, trilhos, placas...): não vira colisão nem malha suave
DECOR = (6, 27, 28, 30, 31, 32, 37, 38, 39, 40, 50, 59, 63, 65, 66, 68, 69, 70, 72, 75, 76, 77, 83, 106, 111, 131, 132, 140, 141, 142, 143, 147, 148, 157, 171, 175, 176, 177)
t0 = time.time()
for (rx, rz) in tile_list():
    x0, z0 = rx * 512, rz * 512
    MG = 32  # margem: a suavização das ruas usa vizinhança; recorta depois
    a = load_box(REG, x0 - MG, x0 + 512 + MG, z0 - MG, z0 + 512 + MG, 0, Y)
    ids = aplicar_ruas((a >> 4).astype(np.int32))[MG:MG + 512, :, MG:MG + 512]
    del a
    solid = (ids != 0) & ~np.isin(ids, list(NATURAL)) & ~np.isin(ids, list(FOLHAGEM)) & ~np.isin(ids, list(DECOR))
    # peças pequenas e soltas (troncos sem copa, pedregulhos) não bloqueiam: não aparecem no mapa suave
    # (elementos finos como cercas e vidros continuam sólidos)
    lab, _ = ndimage.label(solid)
    sizes = np.bincount(lab.ravel()); small = sizes < 150; small[0] = False
    solid = solid & (~small[lab] | np.isin(ids, list(THIN)))
    del lab, sizes, small
    solid = solid.transpose(0, 2, 1)     # [x, z, y] para empacotar ao longo de y
    packed = np.packbits(solid, axis=2)  # [512,512,32]
    packed.tofile(os.path.join(OUT, 'r.%d.%d.solid' % (rx, rz)))
    print(rx, rz, int(solid.sum()), round(time.time() - t0, 1), flush=True)
print('done', flush=True)
