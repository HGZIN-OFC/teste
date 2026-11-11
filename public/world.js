// Mundo do jogo: Konoha do mapa Naruto (1 bloco = 1 m). Terreno e estruturas vêm de /mundo (ver terrain.js).
// Quadro de missões, mesa do Hokage e barraca de ramen são provisórios: ficam perto do nascimento
// até você marcar os lugares reais na vila.
import * as THREE from 'three';
import { WORLD } from './shared.js';
import { toon } from './ninja.js';
import { TS, STEP, G } from './terrain.js';
import { gunzip } from './terrain-web.js';

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
  // sombreado por inclinação: encostas íngremes escurecem, o que dá volume ao chão pintado
  {
    const nrm = geo.attributes.normal.array, colArr = new Float32Array(G * G * 3);
    for (let k = 0; k < G * G; k++) {
      const slope = 1 - nrm[k * 3 + 1];
      const f = 1 - 0.55 * Math.min(1, slope * 2.5);
      colArr[k * 3] = f; colArr[k * 3 + 1] = f; colArr[k * 3 + 2] = f;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
  }

  const tex = new THREE.TextureLoader().load(rec.tex);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, vertexColors: true }));
  mesh.receiveShadow = true;
  return mesh;
}

// Estruturas suaves (gerada offline por tools/mapa/smooth.py): marching cubes + simplificação.
// Formato: u32 nV, u32 nT; i16 posição (metros x16, local da região); u8 cor RGB por vértice; u32 índices.
function buildSmoothMesh(u8) {
  const [nV, nT] = new Uint32Array(u8.slice(0, 8).buffer);
  const pos = new Int16Array(u8.slice(8, 8 + nV * 6).buffer);
  const colU = u8.subarray(8 + nV * 6, 8 + nV * 9);
  const idx = new Uint32Array(u8.slice(8 + nV * 9, 8 + nV * 9 + nT * 12).buffer);
  const P = new Float32Array(nV * 3), C = new Float32Array(nV * 3);
  for (let i = 0; i < nV * 3; i++) { P[i] = pos[i] / 16; C[i] = colU[i] / 255; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(C, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}

// Mapa visual inteiro vindo do .glb (malha com textura por vértice). Desliga a malha de grade do terreno.
const MAPA_GLB = true;

// Monta a arena: terreno de todas as regiões já, e as estruturas do nascimento primeiro (depois, uma região por vez).
export async function buildNarutoWorld(scene, terrain) {
  const root = new THREE.Group(); scene.add(root);
  const sx = WORLD.spawn[0], sz = WORLD.spawn[2];
  const near = (rec) => Math.hypot(rec.rx * TS + TS / 2 - sx, rec.rz * TS + TS / 2 - sz);
  const recs = [...terrain.regions.values()].sort((a, b) => near(a) - near(b));
  for (const rec of recs) {
    const g = new THREE.Group(); g.position.set(rec.rx * TS, 0, rec.rz * TS); root.add(g);
    if (!MAPA_GLB) g.add(buildTerrainMesh(rec));   // o chão visual vem do mapa .glb (ver glb_mapa.py)
    rec.group = g;
  }
  const addStruct = (rec, buf) => { rec.group.add(buildSmoothMesh(buf)); };
  const first = recs[0];
  const firstBuf = await gunzip(`/mundo/r.${first.rx}.${first.rz}.smooth.gz`);
  if (firstBuf) addStruct(first, firstBuf);
  const pending = recs.slice(1);
  let busy = false;
  const streamStructs = () => {
    if (busy || !pending.length) return;
    const rec = pending.shift(); busy = true;
    gunzip(`/mundo/r.${rec.rx}.${rec.rz}.smooth.gz`).then((buf) => { if (buf) addStruct(rec, buf); }).catch(() => {}).finally(() => { busy = false; });
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
