# Leitor mínimo de GLB: nós (TRS/matriz), malhas, primitivas (POSITION/índices), material (baseColorFactor)
import struct, json
import numpy as np

CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}

def carregar(path):
    b = open(path, 'rb').read()
    _, _, _ = struct.unpack('<4sII', b[:12])
    cl, _ = struct.unpack('<I4s', b[12:20])
    j = json.loads(b[20:20 + cl])
    bin_off = 20 + cl
    cb, _ = struct.unpack('<I4s', b[bin_off:bin_off + 8])
    BIN = b[bin_off + 8: bin_off + 8 + cb]
    return j, BIN

def acessor(j, BIN, idx):
    a = j['accessors'][idx]
    bv = j['bufferViews'][a['bufferView']]
    dt = np.dtype(CT[a['componentType']])
    n = NC[a['type']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = bv.get('byteStride', dt.itemsize * n)
    cnt = a['count']
    raw = np.frombuffer(BIN, dtype=np.uint8, count=stride * cnt, offset=off).reshape(cnt, stride)
    if stride == dt.itemsize * n:
        arr = np.frombuffer(raw.tobytes(), dtype=dt).reshape(cnt, n)
    else:
        arr = np.frombuffer(raw[:, :dt.itemsize * n].tobytes(), dtype=dt).reshape(cnt, n)
    return arr

def matriz_no(n):
    if 'matrix' in n:
        return np.array(n['matrix'], float).reshape(4, 4).T
    T = np.array(n.get('translation', [0, 0, 0]), float)
    R = np.array(n.get('rotation', [0, 0, 0, 1]), float)
    S = np.array(n.get('scale', [1, 1, 1]), float)
    x, y, z, w = R
    Rm = np.array([[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)],
                   [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)],
                   [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]])
    M = np.eye(4); M[:3, :3] = Rm * S[None, :]; M[:3, 3] = T
    return M

def cor_material(j, mi):
    if mi is None:
        return (200, 200, 200)
    m = j['materials'][mi]
    f = m.get('pbrMetallicRoughness', {}).get('baseColorFactor', [0.8, 0.8, 0.8, 1])
    return tuple(int(max(0, min(1, c)) * 255) for c in f[:3])

def primitivas(j, BIN):
    """Gera (nome_do_nó, matriz_mundo, posições[N,3], índices[T,3], cor RGB) para cada primitiva."""
    nodes = j['nodes']
    pais = {}
    for i, n in enumerate(nodes):
        for c in n.get('children', []):
            pais[c] = i
    cache = {}
    def mundo(i):
        if i in cache: return cache[i]
        M = matriz_no(nodes[i])
        if i in pais: M = mundo(pais[i]) @ M
        cache[i] = M
        return M
    saida = []
    for i, n in enumerate(nodes):
        if 'mesh' not in n: continue
        M = mundo(i)
        mesh = j['meshes'][n['mesh']]
        for p in mesh['primitives']:
            if p.get('mode', 4) != 4: continue
            pos = acessor(j, BIN, p['attributes']['POSITION']).astype(np.float64)
            if 'indices' in p:
                ind = acessor(j, BIN, p['indices']).astype(np.int64).reshape(-1, 3)
            else:
                ind = np.arange(len(pos)).reshape(-1, 3)
            cor = cor_material(j, p.get('material'))
            saida.append((n.get('name', ''), M, pos, ind, cor))
    return saida


def imagem_textura(j, BIN, ti, cache={}):
    """Textura (PIL RGB, reduzida a 512 px) de um índice de textura do glTF."""
    from PIL import Image
    import io
    if ti is None:
        return None
    if ti in cache:
        return cache[ti]
    src = j['textures'][ti].get('source')
    if src is None:
        cache[ti] = None
        return None
    img = j['images'][src]
    if 'bufferView' not in img:
        cache[ti] = None
        return None
    bv = j['bufferViews'][img['bufferView']]
    off = bv.get('byteOffset', 0)
    data = BIN[off: off + bv['byteLength']]
    im = Image.open(io.BytesIO(data)).convert('RGB')
    im.thumbnail((512, 512))
    arr = np.asarray(im, np.uint8)
    cache[ti] = arr
    return arr


def cor_vertices(j, BIN, mi, prim, n_vert):
    """Cor RGB float (0..255) por vértice: fator do material × textura amostrada no UV (sem UV: só o fator)."""
    fac = np.array(cor_material(j, mi), float)
    if mi is None:
        return np.tile(fac, (n_vert, 1))
    m = j['materials'][mi]
    pbr = m.get('pbrMetallicRoughness', {})
    bct = pbr.get('baseColorTexture')
    if bct is None or 'TEXCOORD_0' not in prim['attributes']:
        return np.tile(fac, (n_vert, 1))
    tex = imagem_textura(j, BIN, bct['index'])
    if tex is None:
        return np.tile(fac, (n_vert, 1))
    uv = acessor(j, BIN, prim['attributes']['TEXCOORD_0']).astype(np.float64)
    H, W = tex.shape[:2]
    col = (uv[:, 0] % 1.0) * (W - 1)
    row = (1.0 - (uv[:, 1] % 1.0)) * (H - 1)
    c = tex[row.astype(int), col.astype(int)].astype(float)
    base = np.array([1.0, 1.0, 1.0]) if pbr.get('baseColorFactor') is None else np.array(pbr['baseColorFactor'][:3], float)
    return np.clip(c * base, 0, 255)


def primitivas_completas(j, BIN):
    """Como primitivas(), mas devolve o dicionário da primitiva e a cor por vértice (com textura)."""
    nodes = j['nodes']
    pais = {}
    for i, n in enumerate(nodes):
        for c in n.get('children', []):
            pais[c] = i
    cache = {}
    def mundo(i):
        if i in cache: return cache[i]
        M = matriz_no(nodes[i])
        if i in pais: M = mundo(pais[i]) @ M
        cache[i] = M
        return M
    saida = []
    for i, n in enumerate(nodes):
        if 'mesh' not in n: continue
        M = mundo(i)
        for p in j['meshes'][n['mesh']]['primitives']:
            if p.get('mode', 4) != 4: continue
            pos = acessor(j, BIN, p['attributes']['POSITION']).astype(np.float64)
            ind = acessor(j, BIN, p['indices']).astype(np.int64).reshape(-1, 3) if 'indices' in p else np.arange(len(pos)).reshape(-1, 3)
            w = pos @ M[:3, :3].T + M[:3, 3]
            flip = np.linalg.det(M[:3, :3]) < 0
            cor = cor_vertices(j, BIN, p.get('material'), p, len(pos))
            saida.append({'nome': n.get('name', ''), 'pos': w, 'ind': ind, 'cor': cor, 'flip': flip})
    return saida
