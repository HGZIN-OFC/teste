// Mapa Naruto em 1 bloco = 1 m: terreno (grade de 4 m com a textura do mapa), estruturas (malha dos blocos)
// e minimapa estilo Fortnite. Os dados vêm de /mundo (gerados por tools/mapa/export2.py).
import * as THREE from 'three';
import { buildNinja, defaultLook } from './ninja.js';

const TS = 512;           // tamanho de uma região em blocos (= metros)
const STEP = 4;           // passo da grade de terreno
const G = 129;            // 512 / 4 + 1
const R_TERR = 2;         // raio (em regiões) com terreno
const R_STRUCT = 0;       // raio (em regiões) com estruturas: só a região atual (malha pesada)
const SPAWN = { x: 500, z: -1413 };   // spawn do próprio save

const $ = (id) => document.getElementById(id);
const statusEl = $('status');
const canvas = $('cena');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = false;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fd3f0);
scene.fog = new THREE.Fog(0x9fd3f0, 900, 2600);
const camera = new THREE.PerspectiveCamera(60, 1, 0.5, 4000);
scene.add(new THREE.HemisphereLight(0xdff3ff, 0x4a6b3a, 0.85));
const sun = new THREE.DirectionalLight(0xfff1d6, 1.0);
sun.position.set(300, 500, 200);
scene.add(sun);

let indice = null, paleta = null, pal3 = null;
const regions = new Map();     // "rx,rz" -> { rx, rz, group, terr, alt, struct, texImg, tex, loading }
const texImgs = new Map();     // "rx,rz" -> HTMLImageElement (usado no minimapa e no terreno)

// ---------- carregamento ----------
async function gunzip(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('não achei ' + url);
  const ds = new DecompressionStream('gzip');
  return await new Response(r.body.pipeThrough(ds)).arrayBuffer();
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
    idx.push(a, c, b, b, c, d);
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
  rec.tex = tex;
  return mesh;
}

// quads: int16 x8 = [x,y,z, sx,sy,sz, eixo*2+sinal, cor]
function buildStruct(quadsBuf) {
  const q = new Int16Array(quadsBuf), n = q.length / 8;
  const pos = new Float32Array(n * 12), nor = new Float32Array(n * 12), col = new Float32Array(n * 12);
  const idx = new Uint32Array(n * 6);
  const mn = [0, 0, 0], sz = [0, 0, 0], e = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  let p = 0, t = 0, v = 0;
  for (let k = 0; k < n; k++) {
    const o = k * 8;
    mn[0] = q[o]; mn[1] = q[o + 1]; mn[2] = q[o + 2];
    sz[0] = q[o + 3]; sz[1] = q[o + 4]; sz[2] = q[o + 5];
    const ax = q[o + 6], d = ax >> 1, sgn = (ax & 1) ? 1 : -1;
    const cc = q[o + 7] * 3;
    const cr = pal3[cc], cg = pal3[cc + 1], cb = pal3[cc + 2];
    const U = d === 0 ? 1 : 0, Vax = d === 2 ? 1 : 2;
    const nrm = [0, 0, 0]; nrm[d] = sgn;
    const c0 = [mn[0], mn[1], mn[2]];
    const c1 = c0.slice(); c1[U] += sz[U];
    const c2 = c1.slice(); c2[Vax] += sz[Vax];
    const c3 = c0.slice(); c3[Vax] += sz[Vax];
    for (const c of [c0, c1, c2, c3]) {
      pos[p++] = c[0]; pos[p++] = c[1]; pos[p++] = c[2];
      nor[v++] = nrm[0]; nor[v] = nrm[1]; nor[v + 1] = nrm[2]; v += 2;
      col[t++] = cr; col[t++] = cg; col[t++] = cb;
    }
    const b = k * 4;
    idx[k * 6] = b; idx[k * 6 + 1] = b + 1; idx[k * 6 + 2] = b + 2;
    idx[k * 6 + 3] = b; idx[k * 6 + 4] = b + 2; idx[k * 6 + 5] = b + 3;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
}

async function ensureRegion(rx, rz, wantStruct) {
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
  if (wantStruct && !rec.struct && !rec.structLoading && rec.terr) {
    rec.structLoading = gunzip(`/mundo/r.${rx}.${rz}.quads.gz`).then((buf) => {
      rec.struct = buildStruct(buf); rec.group.add(rec.struct);
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
const keys = {};
let yaw = 0, pitch = 0.35, dist = 12, dragging = false, lastX = 0, lastY = 0;
let miniScale = 0.9;  // pixels do minimapa por metro

addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'KeyM') toggleFull();
  if (e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
addEventListener('pointerup', () => { dragging = false; });
addEventListener('pointermove', (e) => {
  if (!dragging) return;
  yaw -= (e.clientX - lastX) * 0.006;
  pitch = Math.min(1.2, Math.max(0.05, pitch + (e.clientY - lastY) * 0.004));
  lastX = e.clientX; lastY = e.clientY;
});
canvas.addEventListener('wheel', (e) => { dist = Math.min(60, Math.max(4, dist + e.deltaY * 0.01)); }, { passive: true });
$('zin').onclick = () => { miniScale = Math.min(4, miniScale * 1.4); };
$('zout').onclick = () => { miniScale = Math.max(0.2, miniScale / 1.4); };
$('mapbtn').onclick = () => toggleFull();
$('mini').onclick = () => toggleFull();

function step(dt) {
  let ix = 0, iz = 0;
  if (keys.KeyW || keys.ArrowUp) iz -= 1;
  if (keys.KeyS || keys.ArrowDown) iz += 1;
  if (keys.KeyA || keys.ArrowLeft) ix -= 1;
  if (keys.KeyD || keys.ArrowRight) ix += 1;
  const len = Math.hypot(ix, iz);
  if (len > 0) {
    ix /= len; iz /= len;
    const run = keys.ShiftLeft || keys.ShiftRight;
    const sp = (run ? 11 : 6) * dt;
    // direção relativa à câmera
    const sx = ix * Math.cos(yaw) + iz * Math.sin(yaw);
    const sz = -ix * Math.sin(yaw) + iz * Math.cos(yaw);
    const nx = player.x + sx * sp, nz = player.z + sz * sp;
    const ground = terrAt(player.x, player.z);
    const blockedAt = (x, z) => {
      const a = altAt(x, z), t = terrAt(x, z);
      return (a - t) > 1.2 && a > player.y + 1.2;   // parede ou telhado acima do chão
    };
    if (!blockedAt(nx, player.z)) player.x = nx;
    if (!blockedAt(player.x, nz)) player.z = nz;
    player.facing = Math.atan2(sx, sz);
    void ground;
  }
  // gravidade e pulo
  const gy = terrAt(player.x, player.z);
  if (keys.Space && player.onGround) { player.vy = 9; player.onGround = false; }
  player.vy -= 26 * dt;
  player.y += player.vy * dt;
  if (player.y <= gy) { player.y = gy; player.vy = 0; player.onGround = true; }
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
      await ensureRegion(rx, rz, near);
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
  // o terreno sob o jogador precisa estar pronto antes de posicionar
  await ensureRegion(Math.floor(SPAWN.x / TS), Math.floor(SPAWN.z / TS), true);
  player.y = terrAt(player.x, player.z);
  ready = true;
  statusEl.textContent = 'Konoha · regiões: ' + regions.size + ' · M: mapa completo';
  streamRegions();
  requestAnimationFrame(frame);
  setInterval(() => { statusEl.textContent = 'Regiões carregadas: ' + [...regions.values()].filter((r) => r.terr).length + ' · M: mapa completo'; }, 1500);
}
start().catch((e) => { statusEl.textContent = 'Erro ao carregar o mapa: ' + e.message; console.error(e); });
