# Lê chunks Anvil (Minecraft 1.12.2) de arquivos r.X.Z.mca e devolve blocos (id*16+meta) numa caixa.
import zlib, struct, os, numpy as np
from nbt import read_named
def read_chunk(fp, rx, rz, cx, cz):
    # cx, cz: coordenadas do chunk dentro da região (0..31)
    idx = 4 * ((cx & 31) + (cz & 31) * 32)
    with open(fp, 'rb') as f:
        f.seek(idx); loc = f.read(4)
        off = int.from_bytes(loc[:3], 'big') * 4096; cnt = loc[3]
        if off == 0 or cnt == 0: return None
        f.seek(off); ln = struct.unpack('>I', f.read(4))[0]; comp = f.read(1)[0]
        data = f.read(ln - 1)
    raw = zlib.decompress(data) if comp == 2 else (__import__('gzip').decompress(data) if comp == 1 else data)
    _, root = read_named(raw)
    return root['Level']
def load_box(mca_dir, x0, x1, z0, z1, y0=0, y1=256):
    """Retorna array numpy [X, Y, Z] de uint16 (id<<4 | meta). Ar = 0."""
    W, H, D = x1 - x0, y1 - y0, z1 - z0
    out = np.zeros((W, H, D), dtype=np.uint16)
    rx0, rx1 = x0 >> 9, (x1 - 1) >> 9; rz0, rz1 = z0 >> 9, (z1 - 1) >> 9
    for rx in range(rx0, rx1 + 1):
        for rz in range(rz0, rz1 + 1):
            fp = os.path.join(mca_dir, 'r.%d.%d.mca' % (rx, rz))
            if not os.path.exists(fp): continue
            for lcx in range(32):
                for lcz in range(32):
                    cxw = rx * 32 + lcx; czw = rz * 32 + lcz
                    bx0, bz0 = cxw * 16, czw * 16
                    if bx0 + 16 <= x0 or bx0 >= x1 or bz0 + 16 <= z0 or bz0 >= z1: continue
                    lvl = read_chunk(fp, rx, rz, lcx, lcz)
                    if lvl is None: continue
                    for sec in lvl.get('Sections', []):
                        sy = sec['Y'] * 16
                        if sy + 16 <= y0 or sy >= y1 or 'Blocks' not in sec: continue
                        ids = np.frombuffer(bytes(sec['Blocks']), dtype=np.uint8).reshape(16, 16, 16)  # [y][z][x]
                        dat = np.frombuffer(bytes(sec['Data']), dtype=np.uint8)
                        meta = np.empty(4096, dtype=np.uint8)
                        meta[0::2] = dat & 0x0F; meta[1::2] = dat >> 4
                        meta = meta.reshape(16, 16, 16)
                        add = np.zeros(4096, dtype=np.uint16)
                        if 'Add' in sec:
                            a = np.frombuffer(bytes(sec['Add']), dtype=np.uint8)
                            an = np.empty(4096, dtype=np.uint8); an[0::2] = a & 0x0F; an[1::2] = a >> 4
                            add = an.astype(np.uint16).reshape(16, 16, 16) << 8
                        else:
                            add = np.zeros((16, 16, 16), dtype=np.uint16)
                        full = (ids.astype(np.uint16) | add) << 4 | meta.astype(np.uint16)  # [y][z][x]
                        # para o recorte
                        ya, yb = max(sy, y0), min(sy + 16, y1)
                        xa, xb = max(bx0, x0), min(bx0 + 16, x1)
                        za, zb = max(bz0, z0), min(bz0 + 16, z1)
                        sub = full[ya - sy:yb - sy, za - bz0:zb - bz0, xa - bx0:xb - bx0]  # [y][z][x]
                        out[xa - x0:xb - x0, ya - y0:yb - y0, za - z0:zb - z0] = sub.transpose(2, 0, 1)
    return out
