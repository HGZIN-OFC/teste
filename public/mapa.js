// Mapa Naruto em 1 bloco = 1 m: terreno (grade de 4 m com a textura do mapa), estruturas (malha dos blocos)
// e minimapa estilo Fortnite. Os dados vêm de /mundo (gerados por tools/mapa/export2.py).
import * as THREE from 'three';
import { buildNinja, defaultLook } from './ninja.js';
import { showLoading } from './loading.js';

const TS = 512;           // tamanho de uma região em blocos (= metros)
const STEP = 4;           // passo da grade de terreno
const G = 129;            // 512 / 4 + 1
const TOUCH = matchMedia('(pointer: coarse)').matches;   // celular/tablet: versão leve
const R_TERR = TOUCH ? 1 : 2;   // raio (em regiões) com terreno
const R_STRUCT = 0;       // raio (em regiões) com malha de estruturas: só a região atual (malha pesada)
const R_SOLID = 1;        // raio (em regiões) com colisão voxel das estruturas
const SPAWN = { x: 499, z: -1250 };   // praça no centro de Konoha

const $ = (id) => document.getElementById(id);
const statusEl = $('status');
const canvas = $('cena');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !TOUCH });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, TOUCH ? 1 : 2));
renderer.shadowMap.enabled = !TOUCH;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fd3f0);
// no celular a névoa é mais próxima: esconde a borda do terreno carregado e poupa GPU
scene.fog = TOUCH ? new THREE.Fog(0x9fd3f0, 400, 1000) : new THREE.Fog(0x9fd3f0, 900, 2600);
const camera = new THREE.PerspectiveCamera(60, 1, 0.5, TOUCH ? 1400 : 4000);
scene.add(new THREE.HemisphereLight(0xdff3ff, 0x4a6b3a, 0.85));
const sun = new THREE.DirectionalLight(0xfff1d6, 1.0);
sun.position.set(300, 500, 200);
sun.castShadow = !TOUCH;
sun.shadow.mapSize.set(TOUCH ? 1024 : 2048, TOUCH ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -180, right: 180, top: 180, bottom: -180, near: 10, far: 1200 });
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.0004;
scene.add(sun);

let indice = null, paleta = null, pal3 = null;
const regions = new Map();     // "rx,rz" -> { rx, rz, group, terr, alt, struct, texImg, tex, loading }
const texImgs = new Map();     // "rx,rz" -> HTMLImageElement (usado no minimapa e no terreno)

// ---------- carregamento ----------
let onFile = null;   // progresso da tela de carregamento (um arquivo a cada descompactação)
async function gunzip(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('não achei ' + url);
  const ds = new DecompressionStream('gzip');
  const buf = await new Response(r.body.pipeThrough(ds)).arrayBuffer();
  if (onFile) onFile();
  return buf;
}
function loadImg(key) {
  if (texImgs.has(key)) return texImgs.get(key);
  const img = new Image();
  img.src = '/mundo/tex/r.' + key.replace(',', '.') + '.jpg';
  texImgs.set(key, img);
  return img;
}
function hasRegion(rx, rz) {
  return indice.regioes.some(([a, b]) => a === rx && b === rz);
}
function keyOf(rx, rz) { return rx + ',' + rz; }

function buildTerrain(rec) {
  const pos = new Float32Array(G * G * 3), uv = new Float32Array(G * G * 2);
  for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) {
    const k = i * G + j;
    const x = Math.min(i * STEP, TS - 1), z = Math.min(j * STEP, TS - 1);
    pos[k * 3] = i * STEP; pos[k * 3 + 1] = rec.terr[i * G + j] + 0.02; pos[k * 3 + 2] = j * STEP;
    uv[k * 2] = x / TS; uv[k * 2 + 1] = 1 - z / TS;
  }
  const idx = [];
  for (let i = 0; i < G - 1; i++) for (let j = 0; j < G - 1; j++) {
    const a = i * G + j, b = a + 1, c = a + G, d = c + 1;
    idx.push(a, b, c, b, d, c);   // enrolamento: normal para cima (y+)
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const img = loadImg(rec.key);
  const tex = new THREE.Texture(img);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  img.onload = () => { tex.needsUpdate = true; };
  if (img.complete && img.naturalWidth) tex.needsUpdate = true;
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex }));
  mesh.receiveShadow = true;
  rec.tex = tex;
  return mesh;
}

// ---------- materiais das estruturas ----------
// O mapa guarda só a cor de cada bloco, então cada cor da paleta vira um material pelo tom:
// madeira, telha, pedra, reboco (parede clara), folhagem ou liso. Cada material tem uma textura procedural.
const MATS = ['liso', 'madeira', 'telha', 'pedra', 'reboco', 'folhagem'];
function matOfRGB([r, g, b]) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), lum = (r + g + b) / 3;
  if (mx - mn < 18) return lum > 185 ? 'reboco' : 'pedra';                 // cinza/branco
  if (g > r + 15 && g > b + 15) return 'folhagem';                          // verde
  if (r > g + 40 && r > b + 50) return lum > 120 ? 'telha' : 'madeira';     // vermelho/laranja
  if (r > g && g > b && r - b > 25) return lum > 150 ? 'reboco' : 'madeira'; // marrom/bege
  return 'liso';
}
let MATOF = null;   // índice da cor da paleta -> índice do material
const matTexCache = {};

// textura procedural (256 px = 4 m); a cor do bloco é multiplicada por ela
function makeMatTex(name) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const R = (k) => Math.random() * k;
  g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 256);
  const speck = (n, a) => { for (let i = 0; i < n; i++) { const v = Math.random() < 0.5 ? 255 : 0; g.fillStyle = `rgba(${v},${v},${v},${a})`; g.fillRect(R(256), R(256), 2 + R(3), 2 + R(3)); } };
  if (name === 'madeira') {                                     // tábuas com veios
    for (let i = 0; i < 4; i++) {
      const v = 200 + R(40); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(0, i * 64, 256, 64);
      for (let k = 0; k < 14; k++) { g.strokeStyle = `rgba(0,0,0,${0.05 + R(0.08)})`; g.lineWidth = 1 + R(2); g.beginPath(); const y0 = i * 64 + R(64); g.moveTo(0, y0); g.bezierCurveTo(80, y0 + R(10) - 5, 170, y0 + R(10) - 5, 256, y0 + R(8) - 4); g.stroke(); }
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, i * 64, 256, 3);            // junta entre tábuas
    }
    speck(120, 0.06);
  } else if (name === 'telha') {                                // telhas em arco (escamas)
    for (let y = 0; y < 8; y++) for (let x = -1; x < 9; x++) {
      const v = 200 + R(50); g.fillStyle = `rgb(${v},${v},${v})`;
      g.beginPath(); g.arc(x * 32 + (y % 2 ? 16 : 0), y * 32 + 16, 17, 0, Math.PI); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 2; g.stroke();
    }
  } else if (name === 'pedra') {                                // blocos de pedra com juntas
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const o = (y % 2) * 32; const v = 185 + R(60); g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(x * 64 - o, y * 64, 64, 64);
      g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 3; g.strokeRect(x * 64 - o, y * 64, 64, 64);
    }
    speck(260, 0.07);
  } else if (name === 'reboco') {                               // parede de reboco com manchas suaves
    for (let i = 0; i < 40; i++) { const v = 215 + R(35); g.fillStyle = `rgba(${v},${v},${v},.5)`; g.beginPath(); g.arc(R(256), R(256), 10 + R(30), 0, Math.PI * 2); g.fill(); }
    speck(200, 0.05);
  } else if (name === 'folhagem') {                             // copa com manchas claras e escuras
    for (let i = 0; i < 60; i++) { const v = R() < 0.5 ? 170 : 255; g.fillStyle = `rgba(${v},${v},${v},.35)`; g.beginPath(); g.arc(R(256), R(256), 6 + R(18), 0, Math.PI * 2); g.fill(); }
  } else {                                                     // liso: leve granulação
    speck(180, 0.04);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function matTex(name) { return matTexCache[name] ??= makeMatTex(name); }
const AO_F = [0.55, 0.7, 0.85, 1.0];   // brilho por nível de oclusão (0 = canto fechado)
// bloco ocupado na região (lx,ly,lz) — usa o mesmo bitset da colisão
function solidLocal(rec, x, y, z) {
  if (!rec.solid || x < 0 || z < 0 || y < 0 || x >= TS || z >= TS || y >= 256) return false;
  return ((rec.solid[(x * TS + z) * 32 + (y >> 3)] >> (7 - (y & 7))) & 1) === 1;
}

// quads: int16 x8 = [x,y,z, sx,sy,sz, eixo*2+sinal, cor]. Um mesh por material (cada um com sua textura).
function buildStruct(quadsBuf, rec) {
  if (!MATOF) MATOF = paleta.map((c) => MATS.indexOf(matOfRGB(c)));
  const bytes = quadsBuf instanceof ArrayBuffer ? new Uint8Array(quadsBuf) : quadsBuf;   // gunzip devolve ArrayBuffer
  const q = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2), n = q.length / 8;
  const B = MATS.map(() => ({ pos: [], nor: [], col: [], uv: [] }));
  const mn = [0, 0, 0], sz = [0, 0, 0];
  for (let k = 0; k < n; k++) {
    const o = k * 8;
    mn[0] = q[o]; mn[1] = q[o + 1]; mn[2] = q[o + 2];
    sz[0] = q[o + 3]; sz[1] = q[o + 4]; sz[2] = q[o + 5];
    const ax = q[o + 6], d = ax >> 1, sgn = (ax & 1) ? 1 : -1;
    const ci = q[o + 7], cc = ci * 3;
    const cr = pal3[cc], cg = pal3[cc + 1], cb = pal3[cc + 2];
    const bk = B[MATOF[ci]];
    const U = d === 0 ? 1 : 0, Vax = d === 2 ? 1 : 2;
    const nrm = [0, 0, 0]; nrm[d] = sgn;
    const A = mn[d] + (sgn > 0 ? 0 : -1);   // coordenada do bloco de ar, na direção da normal
    // oclusão ambiental: vizinhos ocupados no ar em volta do canto (lado 1, lado 2 e diagonal)
    const ao = (cu, cv) => {
      const bu = mn[U] + cu * sz[U], bv = mn[Vax] + cv * sz[Vax];
      const inU = cu ? bu - 1 : bu, outU = cu ? bu : bu - 1;
      const inV = cv ? bv - 1 : bv, outV = cv ? bv : bv - 1;
      const at = (uu, vv) => { const pp = [0, 0, 0]; pp[d] = A; pp[U] = uu; pp[Vax] = vv; return solidLocal(rec, pp[0], pp[1], pp[2]) ? 1 : 0; };
      const s1 = at(outU, inV), s2 = at(inU, outV), c3 = at(outU, outV);
      return s1 && s2 ? 0 : 3 - (s1 + s2 + c3);
    };
    const flip = (d === 1 ? -1 : 1) * sgn < 0;   // (U x V) aponta para a normal?
    const cs = flip ? [[0, 0], [0, 1], [1, 1], [1, 0]] : [[0, 0], [1, 0], [1, 1], [0, 1]];
    const V4 = cs.map(([cu, cv]) => {
      const c = [mn[0], mn[1], mn[2]]; c[U] += cu * sz[U]; c[Vax] += cv * sz[Vax];
      const f = AO_F[ao(cu, cv)];
      return { c, f };
    });
    // dois triângulos por quad, sem índice (mais simples para dividir por material)
    for (const j of [0, 1, 2, 0, 2, 3]) {
      const { c, f } = V4[j];
      bk.pos.push(c[0], c[1], c[2]); bk.nor.push(nrm[0], nrm[1], nrm[2]);
      bk.col.push(cr * f, cg * f, cb * f); bk.uv.push(c[U] * 0.25, c[Vax] * 0.25);
    }
  }
  const group = new THREE.Group();
  B.forEach((bk, mi) => {
    if (!bk.pos.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(bk.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(bk.nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(bk.col, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(bk.uv, 2));
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, map: matTex(MATS[mi]) }));
    mesh.castShadow = !TOUCH; mesh.receiveShadow = true;
    group.add(mesh);
  });
  return group;
}

async function ensureRegion(rx, rz, wantStruct, wantSolid = false) {
  if (!hasRegion(rx, rz)) return null;
  const key = keyOf(rx, rz);
  let rec = regions.get(key);
  if (!rec) {
    rec = { key, rx, rz, group: new THREE.Group(), terr: null, alt: null, struct: null, tex: null, loading: null, structLoading: null };
    rec.group.position.set(rx * TS, 0, rz * TS);
    scene.add(rec.group);
    regions.set(key, rec);
  }
  if (!rec.loading) {
    rec.loading = (async () => {
      const [t, a] = await Promise.all([
        gunzip(`/mundo/r.${rx}.${rz}.terr.gz`), gunzip(`/mundo/r.${rx}.${rz}.alt.gz`),
      ]);
      rec.terr = new Uint8Array(t); rec.alt = new Uint8Array(a);
      rec.group.add(buildTerrain(rec));
    })().catch((e) => { console.warn(e); rec.loading = null; });
  }
  await rec.loading;
  if (wantSolid && !rec.solid && !rec.solidLoading && rec.terr) {
    rec.solidLoading = gunzip(`/mundo/r.${rx}.${rz}.solid.gz`).then((buf) => {
      rec.solid = new Uint8Array(buf);
    }).catch((e) => console.warn(e));
  }
  if (rec.solidLoading) await rec.solidLoading;
  if (wantStruct && !rec.struct && !rec.structLoading && rec.terr) {
    rec.structLoading = gunzip(`/mundo/r.${rx}.${rz}.quads.gz`).then((buf) => {
      rec.struct = buildStruct(buf, rec); rec.group.add(rec.struct);
    }).catch((e) => console.warn(e));
  }
  if (rec.structLoading) await rec.structLoading;
  return rec;
}

function disposeRegion(rec) {
  scene.remove(rec.group);
  rec.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
  regions.delete(rec.key);
}

// ---------- consultas de terreno e colisão ----------
function regionAt(x, z) { return regions.get(keyOf(Math.floor(x / TS), Math.floor(z / TS))); }
function terrAt(x, z) {
  const rec = regionAt(x, z);
  if (!rec || !rec.terr) return 0;
  const lx = x - rec.rx * TS, lz = z - rec.rz * TS;
  const fx = Math.min(Math.max(lx / STEP, 0), G - 1.001), fz = Math.min(Math.max(lz / STEP, 0), G - 1.001);
  const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
  const h = (ii, jj) => rec.terr[ii * G + jj];
  const a = h(i, j) * (1 - tx) + h(i + 1, j) * tx, b = h(i, j + 1) * (1 - tx) + h(i + 1, j + 1) * tx;
  return a * (1 - tz) + b * tz;
}
function altAt(x, z) {
  const rec = regionAt(x, z);
  if (!rec || !rec.alt) return 0;
  const lx = Math.min(Math.max(Math.floor(x - rec.rx * TS), 0), TS - 1);
  const lz = Math.min(Math.max(Math.floor(z - rec.rz * TS), 0), TS - 1);
  return rec.alt[lx * TS + lz];
}

// ---------- jogador ----------
const player = { x: SPAWN.x, z: SPAWN.z, y: 0, vy: 0, onGround: false, facing: 0 };
const ninja = buildNinja(defaultLook());
scene.add(ninja.root);
ninja.root.traverse((o) => { if (o.isMesh) { o.castShadow = !TOUCH; } });
const keys = {};
const touch = { mx: 0, my: 0, run: false, jumpQ: false };   // controles de toque (joystick e botões)
let yaw = 0, pitch = 0.35, dist = 12, dragging = false, lastX = 0, lastY = 0;
let miniScale = 0.9;  // pixels do minimapa por metro

addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'KeyM') toggleFull();
  if (e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
// arrastar gira a câmera (1 dedo/mouse); pinça com 2 dedos aproxima/afasta
const ptrs = new Map(); let pinch0 = 1, dist0 = dist;
const pinchDist = () => { const [a, b] = [...ptrs.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
canvas.addEventListener('pointerdown', (e) => {
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 1) { dragging = true; lastX = e.clientX; lastY = e.clientY; }
  else if (ptrs.size === 2) { dragging = false; pinch0 = pinchDist(); dist0 = dist; }
});
addEventListener('pointermove', (e) => {
  const p = ptrs.get(e.pointerId);
  if (!p) return;
  p.x = e.clientX; p.y = e.clientY;
  if (ptrs.size === 2) { dist = Math.min(60, Math.max(4, dist0 * pinch0 / pinchDist())); return; }
  if (!dragging) return;
  yaw -= (e.clientX - lastX) * 0.006;
  pitch = Math.min(1.2, Math.max(0.05, pitch + (e.clientY - lastY) * 0.004));
  lastX = e.clientX; lastY = e.clientY;
});
const ptrUp = (e) => {
  ptrs.delete(e.pointerId);
  dragging = ptrs.size === 1;
  if (dragging) { const p = [...ptrs.values()][0]; lastX = p.x; lastY = p.y; }
};
addEventListener('pointerup', ptrUp);
addEventListener('pointercancel', ptrUp);
canvas.addEventListener('wheel', (e) => { dist = Math.min(60, Math.max(4, dist + e.deltaY * 0.01)); }, { passive: true });
$('zin').onclick = () => { miniScale = Math.min(4, miniScale * 1.4); };
$('zout').onclick = () => { miniScale = Math.max(0.2, miniScale / 1.4); };
$('mapbtn').onclick = () => toggleFull();
$('mini').onclick = () => toggleFull();

// joystick (canto inferior esquerdo): empurra o personagem na direção do polegar
const joy = $('joy'), knob = $('knob');
let joyId = null;
const JOY_MAX = 0.7;   // fração do raio em que o joystick chega a "velocidade máxima"
function joyMove(e) {
  const r = joy.getBoundingClientRect();
  const R = r.width / 2, cx = r.left + R, cy = r.top + R;
  let dx = e.clientX - cx, dy = e.clientY - cy;
  const d = Math.hypot(dx, dy), m = Math.min(d, R * JOY_MAX);
  if (d > 0) { dx = dx / d * m; dy = dy / d * m; }
  knob.style.transform = `translate(${dx}px, ${dy}px)`;
  touch.mx = dx / (R * JOY_MAX); touch.my = dy / (R * JOY_MAX);   // para cima = negativo = frente (W)
}
function joyEnd(e) {
  if (e.pointerId !== joyId) return;
  joyId = null; touch.mx = 0; touch.my = 0; knob.style.transform = '';
}
joy.addEventListener('pointerdown', (e) => { e.preventDefault(); joyId = e.pointerId; joy.setPointerCapture(e.pointerId); joyMove(e); });
joy.addEventListener('pointermove', (e) => { if (e.pointerId === joyId) joyMove(e); });
joy.addEventListener('pointerup', joyEnd);
joy.addEventListener('pointercancel', joyEnd);

// botões: Correr (segurar) e Pular (toque)
const btnRun = $('btnRun'), btnJump = $('btnJump');
btnRun.addEventListener('pointerdown', (e) => { e.preventDefault(); touch.run = true; });
btnRun.addEventListener('pointerup', () => { touch.run = false; });
btnRun.addEventListener('pointercancel', () => { touch.run = false; });
btnRun.addEventListener('pointerleave', () => { touch.run = false; });
btnJump.addEventListener('pointerdown', (e) => { e.preventDefault(); touch.jumpQ = true; });

// bloco sólido (estrutura) em (x,y,z) em metros inteiros
function solidAt(x, y, z) {
  const rec = regionAt(x, z);
  if (!rec || !rec.solid) return false;
  const ly = Math.floor(y);
  if (ly < 0 || ly >= 256) return false;
  const lx = Math.floor(x - rec.rx * TS), lz = Math.floor(z - rec.rz * TS);
  if (lx < 0 || lz < 0 || lx >= TS || lz >= TS) return false;
  const byte = rec.solid[(lx * TS + lz) * 32 + (ly >> 3)];
  return ((byte >> (7 - (ly & 7))) & 1) === 1;
}
// o corpo ocupa 2 blocos de altura e tem uma largura de 0,6 m
function blockedAt(x, feet, z) {
  for (const ox of [-0.3, 0.3]) for (const oz of [-0.3, 0.3]) {
    if (solidAt(x + ox, feet + 1.0, z + oz) || solidAt(x + ox, feet + 2.0, z + oz)) return true;   // degrau de 1 bloco: sobe
  }
  return false;
}
// chão: o terreno ou o topo de um bloco sólido (ex.: piso de casa), o que estiver logo abaixo
function groundAt(x, z, y) {
  const t = terrAt(x, z);
  const rec = regionAt(x, z);
  if (!rec || !rec.solid) return t;
  const top = Math.min(255, Math.floor(y + 1.6));
  for (let ly = top; ly >= Math.max(0, Math.floor(t)); ly--) {
    if (solidAt(x, ly, z)) return Math.max(t, ly + 1);
  }
  return t;
}

function step(dt) {
  let ix = 0, iz = 0;
  if (keys.KeyW || keys.ArrowUp) iz -= 1;      // W = para frente
  if (keys.KeyS || keys.ArrowDown) iz += 1;    // S = para trás
  if (keys.KeyA || keys.ArrowLeft) ix -= 1;    // A = esquerda
  if (keys.KeyD || keys.ArrowRight) ix += 1;   // D = direita
  ix += touch.mx; iz += touch.my;              // joystick (valores entre -1 e 1)
  const len = Math.hypot(ix, iz);
  if (len > 0) {
    const mag = Math.min(1, len);              // joystick parcial anda mais devagar
    ix /= len; iz /= len;
    const run = keys.ShiftLeft || keys.ShiftRight || touch.run;
    const sp = (run ? 11 : 6) * dt * mag;
    // frente da câmera = (sin yaw, cos yaw); direita = (-cos yaw, sin yaw)
    const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = -Math.cos(yaw), rz = Math.sin(yaw);
    const mx = rx * ix - fx * iz, mz = rz * ix - fz * iz;
    const nx = player.x + mx * sp, nz = player.z + mz * sp;
    if (!blockedAt(nx, player.y, player.z)) player.x = nx;
    if (!blockedAt(player.x, player.y, nz)) player.z = nz;
    player.facing = Math.atan2(mx, mz);
  }
  // gravidade, pulo e chão (terreno ou piso de estrutura)
  const gy = groundAt(player.x, player.z, player.y);
  const jumpReq = keys.Space || touch.jumpQ; touch.jumpQ = false;
  if (jumpReq && player.onGround) { player.vy = 9; player.onGround = false; }
  player.vy -= 26 * dt;
  player.y += player.vy * dt;
  if (player.y <= gy) { player.y = gy; player.vy = 0; player.onGround = true; }
  else if (player.onGround && player.y > gy + 0.3) { player.onGround = false; }
}

// ---------- minimapa ----------
const mc = $('mc').getContext('2d');
function drawMini() {
  const W = mc.canvas.width, H = mc.canvas.height, cx = W / 2, cy = H / 2;
  mc.clearRect(0, 0, W, H);
  mc.save();
  mc.beginPath(); mc.arc(cx, cy, W / 2, 0, Math.PI * 2); mc.clip();
  mc.fillStyle = '#1d3a1f'; mc.fillRect(0, 0, W, H);
  const s = miniScale * (W / 190) * 1.2;   // px por metro no canvas
  for (const [rx, rz] of indice.regioes) {
    const img = loadImg(keyOf(rx, rz));
    if (!img.complete || !img.naturalWidth) continue;
    const dx = (rx * TS - player.x) * s + cx, dz = (rz * TS - player.z) * s + cy;
    if (dx > W || dz > H || dx + TS * s < 0 || dz + TS * s < 0) continue;
    mc.drawImage(img, dx, dz, TS * s, TS * s);
  }
  mc.restore();
  // seta do jogador (sempre no centro, gira com a câmera)
  mc.save(); mc.translate(cx, cy); mc.rotate(-player.facing + Math.PI);
  mc.fillStyle = '#ffffff'; mc.strokeStyle = '#14142b'; mc.lineWidth = 6;
  mc.beginPath(); mc.moveTo(0, -20); mc.lineTo(13, 13); mc.lineTo(0, 6); mc.lineTo(-13, 13); mc.closePath();
  mc.fill(); mc.stroke(); mc.restore();
}

// ---------- mapa completo (M) ----------
const fc = $('fc').getContext('2d');
let fullOn = false;
function toggleFull() { fullOn = !fullOn; $('full').classList.toggle('on', fullOn); }
$('full').onclick = () => toggleFull();
function drawFull() {
  const W = fc.canvas.width, H = fc.canvas.height;
  const rs = indice.regioes;
  const minX = Math.min(...rs.map((r) => r[0])), maxX = Math.max(...rs.map((r) => r[0])) + 1;
  const minZ = Math.min(...rs.map((r) => r[1])), maxZ = Math.max(...rs.map((r) => r[1])) + 1;
  const s = Math.min(W / ((maxX - minX) * TS), H / ((maxZ - minZ) * TS));
  const ox = (W - (maxX - minX) * TS * s) / 2, oz = (H - (maxZ - minZ) * TS * s) / 2;
  const tx = (x) => ox + (x - minX * TS) * s, tz = (z) => oz + (z - minZ * TS) * s;
  fc.fillStyle = '#1d3a1f'; fc.fillRect(0, 0, W, H);
  for (const [rx, rz] of rs) {
    const img = loadImg(keyOf(rx, rz));
    if (img.complete && img.naturalWidth) fc.drawImage(img, tx(rx * TS), tz(rz * TS), TS * s, TS * s);
    fc.strokeStyle = 'rgba(255,255,255,.25)'; fc.strokeRect(tx(rx * TS), tz(rz * TS), TS * s, TS * s);
    fc.fillStyle = '#fff'; fc.font = '14px Arial'; fc.fillText(rx + ',' + rz, tx(rx * TS) + 4, tz(rz * TS) + 16);
  }
  const px = tx(player.x), pz = tz(player.z);
  fc.fillStyle = '#ffd23f'; fc.strokeStyle = '#14142b'; fc.lineWidth = 3;
  fc.beginPath(); fc.arc(px, pz, 9, 0, Math.PI * 2); fc.fill(); fc.stroke();
}

// ---------- câmera e loop ----------
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

let loadBusy = false;
async function streamRegions() {
  if (loadBusy) return;
  loadBusy = true;
  try {
    const crx = Math.floor(player.x / TS), crz = Math.floor(player.z / TS);
    for (let dx = -R_TERR; dx <= R_TERR; dx++) for (let dz = -R_TERR; dz <= R_TERR; dz++) {
      const rx = crx + dx, rz = crz + dz;
      const near = Math.abs(dx) <= R_STRUCT && Math.abs(dz) <= R_STRUCT;
      const solid = Math.abs(dx) <= R_SOLID && Math.abs(dz) <= R_SOLID;
      await ensureRegion(rx, rz, near, solid);
    }
    for (const rec of [...regions.values()]) {
      const dx = Math.abs(rec.rx - crx), dz = Math.abs(rec.rz - crz);
      if (dx > R_TERR + 1 || dz > R_TERR + 1) disposeRegion(rec);
    }
  } finally { loadBusy = false; }
}

let last = performance.now(), streamTimer = 0, ready = false;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (ready) step(dt);
  // câmera em terceira pessoa
  const ty = player.y + 1.6;
  const cxp = player.x - Math.sin(yaw) * Math.cos(pitch) * dist;
  const czp = player.z - Math.cos(yaw) * Math.cos(pitch) * dist;
  const cyp = ty + Math.sin(pitch) * dist;
  camera.position.set(cxp, Math.max(cyp, terrAt(cxp, czp) + 1.5), czp);
  camera.lookAt(player.x, ty, player.z);
  // personagem
  ninja.root.position.set(player.x, player.y, player.z);
  ninja.root.rotation.y = player.facing;
  // fonte de luz acompanha o jogador
  sun.position.set(player.x + 300, 500, player.z + 200); sun.target.position.set(player.x, 0, player.z); sun.target.updateMatrixWorld();
  renderer.render(scene, camera);
  if (ready) drawMini();
  if (fullOn) drawFull();
  if (now - streamTimer > 600) { streamTimer = now; streamRegions(); }
  requestAnimationFrame(frame);
}

async function start() {
  indice = await (await fetch('/mundo/indice.json')).json();
  paleta = indice.paleta;
  pal3 = new Float32Array(paleta.length * 3);
  paleta.forEach((c, i) => { pal3[i * 3] = c[0] / 255; pal3[i * 3 + 1] = c[1] / 255; pal3[i * 3 + 2] = c[2] / 255; });
  // o terreno sob o jogador precisa estar pronto antes de posicionar (terreno, altura, estruturas e colisão = 4 arquivos)
  const loader = showLoading('Carregando Konoha…'); let got = 0; const need = 4;
  onFile = () => { got++; loader.set(got / need * 0.95, 'Baixando terreno, altura, estruturas e colisão…'); };
  try { await ensureRegion(Math.floor(SPAWN.x / TS), Math.floor(SPAWN.z / TS), true, true); }
  catch (e) { loader.error('Erro: ' + e.message); throw e; }
  onFile = null; loader.set(1, 'Pronto!'); setTimeout(() => loader.done(), 150);
  player.y = terrAt(player.x, player.z);
  ready = true;
  statusEl.textContent = 'Konoha · regiões: ' + regions.size + ' · M: mapa completo';
  streamRegions();
  requestAnimationFrame(frame);
  setInterval(() => { statusEl.textContent = 'Regiões carregadas: ' + [...regions.values()].filter((r) => r.terr).length + ' · M: mapa completo'; }, 1500);
}
start().catch((e) => { statusEl.textContent = 'Erro ao carregar o mapa: ' + e.message; console.error(e); });
