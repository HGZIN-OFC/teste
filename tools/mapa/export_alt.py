# Regenera .alt (altura total por bloco, 512x512 uint8) com as ruas planas. O .terr não muda (só natural).
import sys, os, gzip, time
sys.path.insert(0, '/home/claude/mapbuild')
import numpy as np
from anvil import load_box
from paths import REG, tile_list
from ruas import aplicar_ruas, FOLHAGEM, Y
OUT = '/home/claude/shinobi-wilds/public/mundo'
MG = 32
for (rx, rz) in tile_list():
    x0, z0 = rx * 512, rz * 512
    a = load_box(REG, x0 - MG, x0 + 512 + MG, z0 - MG, z0 + 512 + MG, 0, Y)
    ids = aplicar_ruas((a >> 4).astype(np.int32))[MG:MG + 512, :, MG:MG + 512]
    del a
    solid_all = (ids != 0) & ~np.isin(ids, list(FOLHAGEM))
    rev = solid_all[:, ::-1, :]
    has = rev.any(axis=1)
    top = np.where(has, Y - rev.argmax(axis=1), 0).astype(np.uint8)
    with gzip.open(os.path.join(OUT, 'r.%d.%d.alt.gz' % (rx, rz)), 'wb', compresslevel=9) as f:
        f.write(top.tobytes())
    print(rx, rz, round(time.time(), 0), flush=True)
print('done', flush=True)
