// Mundo do jogo: Konoha do mapa Naruto (1 bloco = 1 m). Terreno e estruturas vêm de /mundo (ver terrain.js).
// Quadro de missões, mesa do Hokage e barraca de ramen são provisórios: ficam perto do nascimento
// até você marcar os lugares reais na vila.
import * as THREE from 'three';
import { WORLD } from './shared.js';
import { toon } from './ninja.js';
import { TS, STEP, G } from './terrain.js';
import { gunzip } from './terrain-web.js';

function paletteRGB(paleta) {
  const p = new Float32Array(paleta.length * 3);
  paleta.forEach((c, i) => { p[i * 3] = c[0] / 255; p[i * 3 + 1] = c[1] / 255; p[i * 3 + 2] = c[2] / 255; });
  return p;
}

// grade de altura de 4 m com a textura do mapa (mesma lógica do mapa.html)
function buildTerrainMesh(rec) {
  const pos = new Float32Array(G * G * 3), uv = new Float32Array(G * G * 2);
  for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) {
    const k = i * G + j;
    const x = Math.min(i * STEP, TS - 1), z = Math.min(j * STEP, TS - 1);
    pos[k * 3] = i * STEP; pos[k * 3 + 1] = rec.terr[k] + 0.02; pos[k * 3 + 2] = j * STEP;
    uv[k * 2] = x / TS; uv[k * 2 + 1] = 1 - z / TS;
  }
  const idx = [];
  for (let i = 0; i < G - 1; i++) for (let j = 0; j < G - 1; j++) {
    const a = i * G + j, b = a + 1, c = a + G, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const tex = new THREE.TextureLoader().load(rec.tex);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex }));
  mesh.receiveShadow = true;
  return mesh;
}

// quads: int16 x8 = [x,y,z, sx,sy,sz, eixo*2+sinal, cor] (mesma lógica do mapa.html). Arrays tipados: bem mais rápido.
function buildStructMesh(quadsBuf, pal3) {
  const q = new Int16Array(quadsBuf.buffer, quadsBuf.byteOffset, quadsBuf.byteLength / 2), n = q.length / 8;
  const pos = new Float32Array(n * 18), nor = new Float32Array(n * 18), col = new Float32Array(n * 18);
  const mn = [0, 0, 0], sz = [0, 0, 0], nrm = [0, 0, 0], c = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const TRI = [0, 1, 2, 0, 2, 3];   // 2 triângulos por quad
  let p = 0;
  for (let k = 0; k < n; k++) {
    const o = k * 8;
    mn[0] = q[o]; mn[1] = q[o + 1]; mn[2] = q[o + 2];
    sz[0] = q[o + 3]; sz[1] = q[o + 4]; sz[2] = q[o + 5];
    const ax = q[o + 6], d = ax >> 1, sgn = (ax & 1) ? 1 : -1;
    const cc = q[o + 7] * 3;
    const cr = pal3[cc], cg = pal3[cc + 1], cb = pal3[cc + 2];
    const U = d === 0 ? 1 : 0, Vax = d === 2 ? 1 : 2;
    nrm[0] = nrm[1] = nrm[2] = 0; nrm[d] = sgn;
    const flip = (d === 1 ? -1 : 1) * sgn < 0;
    const cs = flip ? [[0, 0], [0, 1], [1, 1], [1, 0]] : [[0, 0], [1, 0], [1, 1], [0, 1]];
    for (let i = 0; i < 4; i++) {
      const cu = cs[i][0], cv = cs[i][1], ci = c[i];
      ci[0] = mn[0]; ci[1] = mn[1]; ci[2] = mn[2];
      ci[U] += cu * sz[U]; ci[Vax] += cv * sz[Vax];
    }
    for (let j = 0; j < 6; j++) {
      const ci = c[TRI[j]];
      pos[p] = ci[0]; pos[p + 1] = ci[1]; pos[p + 2] = ci[2];
      nor[p] = nrm[0]; nor[p + 1] = nrm[1]; nor[p + 2] = nrm[2];
      col[p] = cr; col[p + 1] = cg; col[p + 2] = cb;
      p += 3;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}

// Monta a arena: terreno de todas as regiões já, e as estruturas do nascimento primeiro (depois, uma região por vez).
export async function buildNarutoWorld(scene, terrain, paleta) {
  const root = new THREE.Group(); scene.add(root);
  const pal3 = paletteRGB(paleta);
  const sx = WORLD.spawn[0], sz = WORLD.spawn[2];
  const near = (rec) => Math.hypot(rec.rx * TS + TS / 2 - sx, rec.rz * TS + TS / 2 - sz);
  const recs = [...terrain.regions.values()].sort((a, b) => near(a) - near(b));
  for (const rec of recs) {
    const g = new THREE.Group(); g.position.set(rec.rx * TS, 0, rec.rz * TS); root.add(g);
    g.add(buildTerrainMesh(rec));
    rec.group = g;
  }
  const addStruct = (rec, buf) => { rec.group.add(buildStructMesh(buf, pal3)); };
  const first = recs[0];
  const firstBuf = await gunzip(`/mundo/r.${first.rx}.${first.rz}.quads.gz`);
  if (firstBuf) addStruct(first, firstBuf);
  const pending = recs.slice(1);
  let busy = false;
  const streamStructs = () => {
    if (busy || !pending.length) return;
    const rec = pending.shift(); busy = true;
    gunzip(`/mundo/r.${rec.rx}.${rec.rz}.quads.gz`).then((buf) => { if (buf) addStruct(rec, buf); }).catch(() => {}).finally(() => { busy = false; });
  };

  // provisórios (posições relativas ao nascimento; a altura vem do terreno)
  const M = { wood: toon(0xa8703f), dark: toon(0x3a2a22), red: toon(0xc03a2b), cream: toon(0xf2e8cf), glow: new THREE.MeshBasicMaterial({ color: 0xffb347 }) };
  const at = (x, z, y0 = 0) => { const g = new THREE.Group(); g.position.set(x, terrain.groundAt(x, z, 0) + y0, z); root.add(g); return g; };
  const box = (parent, w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };

  const bx = sx - 6, bz = sz - 4; const board = at(bx, bz);       // quadro de missões
  box(board, 4.4, 2.8, 0.12, M.wood, 0, 2.1, 0); box(board, 0.2, 2.2, 0.2, M.dark, -2, 1.1, 0); box(board, 0.2, 2.2, 0.2, M.dark, 2, 1.1, 0);

  const dz2 = sz - 9; const desk = at(sx, dz2);                    // mesa do Hokage (promoção)
  box(desk, 5.4, 1.0, 1.7, M.wood, 0, 0.5, 0); box(desk, 5.7, 0.14, 2.0, M.dark, 0, 1.05, 0);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.5, 14), M.red); hat.position.set(-1.4, 1.37, 0); desk.add(hat);

  const rx = sx + 8, rz = sz + 4; const ramen = at(rx, rz);        // barraca de ramen
  box(ramen, 4.5, 1.1, 1.6, M.wood, 0, 0.55, 0); box(ramen, 4.7, 0.15, 1.8, M.dark, 0, 1.15, 0);
  for (const s of [-1, 1]) box(ramen, 0.2, 3.2, 0.2, M.dark, s * 2.2, 1.6, -0.6);
  box(ramen, 5.2, 0.15, 2.4, M.red, 0, 3.2, -0.2);
  const lanterns = [];
  for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), M.glow); l.position.set(rx + s * 2.4, terrain.groundAt(rx, rz, 0) + 3, rz + 0.9); root.add(l); lanterns.push(l); }

  const interactables = [
    { id: 'board', pos: [bx, 0, bz + 2], r: 3.4, label: 'E — Quadro de missões' },
    { id: 'desk', pos: [sx, 0, dz2 + 1.7], r: 3.4, label: 'E — Falar com o Hokage (promoção)' },
    { id: 'ramen', pos: [rx, 0, rz + 2], r: 3.6, label: 'E — Comer ramen (recupera HP e chakra)' },
  ];
  return {
    root, interactables,
    update(time) { lanterns.forEach((l, i) => { l.scale.setScalar(1 + Math.sin(time * 5 + i) * 0.04); }); streamStructs(); },
  };
}
