// Konoha (original): vila, portão, casas, barraca de ramen, prédio do Hokage com 5 pavimentos.
import * as THREE from 'three';
import { WORLD, HOUSES, RAMEN } from './shared.js';
import { toon } from './ninja.js';

function tex(w, h, draw, rx = 1, ry = 1) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const R = (() => { let s = 12345; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
const tmat = (map, color = 0xffffff) => new THREE.MeshToonMaterial({ map, color, gradientMap: toon(0xffffff).gradientMap });
const edgeMat = new THREE.LineBasicMaterial({ color: 0x2a1c14 });

function box(parent, w, h, d, mat, x, y, z, edges = true) {
  const g = new THREE.BoxGeometry(w, h, d); const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true;
  if (edges) m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), edgeMat));
  parent.add(m); return m;
}

export function buildKonoha(scene) {
  const root = new THREE.Group(); scene.add(root);
  const T = {
    grass: tex(256, 256, (g, w, h) => { g.fillStyle = '#6fb04a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { g.fillStyle = R() > 0.5 ? '#86c45a' : '#5a9a3c'; g.fillRect(R() * w, R() * h, 2, 5); } }, 90, 90),
    dirt: tex(256, 256, (g, w, h) => { g.fillStyle = '#c9a874'; g.fillRect(0, 0, w, h); for (let i = 0; i < 700; i++) { g.fillStyle = R() > 0.5 ? '#b8975f' : '#d8bb88'; g.fillRect(R() * w, R() * h, 3, 3); } }, 1, 1),
    stone: tex(256, 256, (g, w, h) => { g.fillStyle = '#b9b2a6'; g.fillRect(0, 0, w, h); g.strokeStyle = '#8c857a'; g.lineWidth = 4; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const o = y % 2 ? 32 : 0; g.strokeRect(x * 64 + o - 32, y * 64, 64, 64); } }, 1, 1),
    wood: tex(256, 256, (g, w, h) => { g.fillStyle = '#a8703f'; g.fillRect(0, 0, w, h); for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#9a6436' : '#b27a47'; g.fillRect(0, i * 32, w, 30); g.fillStyle = '#6e4423'; g.fillRect(0, i * 32 + 30, w, 2); } }, 4, 4),
    plaster: tex(128, 128, (g, w, h) => { g.fillStyle = '#efe6d3'; g.fillRect(0, 0, w, h); for (let i = 0; i < 300; i++) { g.fillStyle = 'rgba(160,140,110,.12)'; g.fillRect(R() * w, R() * h, 3, 3); } }, 3, 2),
    roof: tex(128, 128, (g, w, h) => { g.fillStyle = '#b8402a'; g.fillRect(0, 0, w, h); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#c64d34' : '#a63a25'; g.beginPath(); g.arc(x * 16 + (y % 2 ? 8 : 0), y * 16 + 8, 9, 0, Math.PI); g.fill(); } }, 4, 3),
  };
  const M = {
    grass: tmat(T.grass), dirt: tmat(T.dirt), stone: tmat(T.stone), wood: tmat(T.wood), plaster: tmat(T.plaster), roof: tmat(T.roof),
    dark: toon(0x3a2a22), red: toon(0xc03a2b), cream: toon(0xf2e8cf), glass: new THREE.MeshBasicMaterial({ color: 0xffe9a8 }),
  };
  const hv = WORLD.villageHalf;

  // chão
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), M.grass); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; root.add(ground);
  const street = (x, z, w, d, mat) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.02, z); m.receiveShadow = true; root.add(m); };
  const rep = (mat, w, d) => { mat.map = mat.map.clone(); mat.map.repeat.set(w / 6, d / 6); mat.map.needsUpdate = true; return mat; };
  street(0, 15, 12, 110, rep(tmat(T.dirt), 12, 110)); // avenida norte-sul
  street(0, 0, 130, 10, rep(tmat(T.dirt), 130, 10)); // rua leste-oeste
  street(0, hv + 20, 12, 40, rep(tmat(T.dirt), 12, 40)); // estrada fora do portão
  street(0, -23, 14, 6, rep(tmat(T.stone), 14, 6)); // praça diante do Hokage
  street(0, 105, 40, 40, rep(tmat(T.dirt), 40, 40));

  // muros
  const wallM = toon(0xd9cdb4);
  const wall = (cx, cz, w, d) => box(root, w, 3.2, d, wallM, cx, 1.6, cz);
  wall(0, -hv, hv * 2, 1.5); wall(-hv, 0, 1.5, hv * 2); wall(hv, 0, 1.5, hv * 2);
  const gap = 12; wall(-(hv + gap / 2) / 2, hv, hv - gap / 2, 1.5); wall((hv + gap / 2) / 2, hv, hv - gap / 2, 1.5);
  // portão (pórtico de madeira)
  for (const s of [-1, 1]) box(root, 1.2, 7, 1.2, M.red, s * (gap / 2 + 0.3), 3.5, hv);
  box(root, gap + 4, 0.9, 1.6, M.red, 0, 7, hv); box(root, gap + 7, 0.4, 2.4, M.dark, 0, 7.8, hv);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.4), new THREE.MeshBasicMaterial({ map: tex(256, 72, (g, w, h) => { g.fillStyle = '#f2e8cf'; g.fillRect(0, 0, w, h); g.fillStyle = '#7a2a1c'; g.font = 'bold 44px sans-serif'; g.textAlign = 'center'; g.fillText('KONOHA', w / 2, 52); }) }));
  sign.position.set(0, 7, hv - 0.85); sign.rotation.y = Math.PI; root.add(sign);
  const sign2 = sign.clone(); sign2.position.z = hv + 0.85; sign2.rotation.y = 0; root.add(sign2);

  // casas
  for (const h of HOUSES) {
    const g = new THREE.Group(); g.position.set(h.x, 0, h.z); root.add(g);
    box(g, h.w, h.h, h.d, new THREE.MeshToonMaterial({ map: T.plaster, color: h.color, gradientMap: M.dark.gradientMap }), 0, h.h / 2, 0);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.7071, 2.6, 4), M.roof); roof.rotation.y = Math.PI / 4; roof.scale.set(h.w * 1.25, 1, h.d * 1.25); roof.position.y = h.h + 1.3; roof.castShadow = true; roof.add(new THREE.LineSegments(new THREE.EdgesGeometry(roof.geometry), edgeMat)); g.add(roof);
    const front = h.z > 0 ? -1 : 1; // porta voltada para a avenida central
    box(g, 1.6, 2.6, 0.2, M.wood, 0, 1.3, front * (h.d / 2 + 0.05));
    for (const s of [-1, 1]) box(g, 1.3, 1.2, 0.15, M.glass, s * h.w * 0.3, h.h * 0.62, front * (h.d / 2 + 0.05));
    box(g, h.w + 0.6, 0.35, h.d + 0.6, M.dark, 0, 0.17, 0);
  }

  // barraca de ramen
  const rm = new THREE.Group(); rm.position.set(RAMEN.x, 0, RAMEN.z); root.add(rm);
  box(rm, 4.5, 1.1, 1.6, M.wood, 0, 0.55, 0); box(rm, 4.7, 0.15, 1.8, M.dark, 0, 1.15, 0);
  for (const s of [-1, 1]) box(rm, 0.2, 3.2, 0.2, M.dark, s * 2.2, 1.6, -0.6);
  const aw = box(rm, 5.2, 0.15, 2.4, M.red, 0, 3.2, -0.2); aw.rotation.x = 0.18;
  for (let i = -3; i <= 3; i++) box(rm, 0.5, 0.01, 2.4, M.cream, i * 0.7, 3.215, -0.2, false).rotation.x = 0.18;
  const noren = []; for (let i = 0; i < 4; i++) { const n = box(rm, 1.0, 0.9, 0.04, i % 2 ? M.cream : M.red, -1.65 + i * 1.1, 2.7, 0.55, false); noren.push(n); }
  for (let i = -1; i <= 1; i++) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.7, 10), M.wood); st.position.set(i * 1.3, 0.35, 1.5); st.castShadow = true; rm.add(st); }
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.cream); bowl.position.set(0, 1.25, 0.1); bowl.rotation.x = Math.PI; bowl.position.y = 1.4; rm.add(bowl);
  const rs = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ map: tex(256, 64, (g, w, h) => { g.fillStyle = '#c03a2b'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.fillText('RAMEN ICHI', w / 2, 46); }) })); rs.position.set(0, 3.7, 0.9); rm.add(rs);
  const lanterns = [];
  const lantern = (x, y, z) => { const l = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffb347 })); l.scale.y = 1.3; l.position.set(x, y, z); root.add(l); lanterns.push(l); };
  lantern(RAMEN.x - 2.4, 3.0, RAMEN.z + 0.9); lantern(RAMEN.x + 2.4, 3.0, RAMEN.z + 0.9);
  for (let z = -20; z <= 60; z += 16) for (const s of [-1, 1]) { const p = new THREE.Group(); p.position.set(s * 7, 0, z); box(p, 0.2, 3, 0.2, M.dark, 0, 1.5, 0); root.add(p); lantern(s * 7, 3.1, z); }

  // ===== Prédio do Hokage =====
  const H = WORLD.hokage, x0 = H.x - H.w / 2, x1 = H.x + H.w / 2, z0 = H.z - H.d / 2, z1 = H.z + H.d / 2, t = 0.8, door = 4;
  const hk = new THREE.Group(); root.add(hk);
  const wallH = 5, wm = new THREE.MeshToonMaterial({ map: T.plaster, gradientMap: M.dark.gradientMap });
  box(hk, H.w, wallH, t, wm, H.x, wallH / 2, z0); box(hk, t, wallH, H.d, wm, x0, wallH / 2, H.z); box(hk, t, wallH, H.d, wm, x1, wallH / 2, H.z);
  const seg = H.w / 2 - door / 2; box(hk, seg, wallH, t, wm, x0 + seg / 2, wallH / 2, z1); box(hk, seg, wallH, t, wm, x1 - seg / 2, wallH / 2, z1);
  box(hk, door + 0.4, wallH - 3.6, t, wm, H.x, 3.6 + (wallH - 3.6) / 2, z1); // verga acima da porta
  for (const s of [-1, 1]) box(hk, 0.4, 3.6, 0.9, M.red, s * (door / 2 + 0.2), 1.8, z1);
  box(hk, 0.8 + door, 0.4, 0.9, M.red, 0, 3.8, z1);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(H.w - t, H.d - t), tmat(T.wood.clone())); floor.material.map.repeat.set(5, 4); floor.material.map.needsUpdate = true; floor.rotation.x = -Math.PI / 2; floor.position.set(H.x, 0.03, H.z); floor.receiveShadow = true; hk.add(floor);
  box(hk, H.w + 1.6, 0.6, H.d + 1.6, M.dark, H.x, wallH + 0.3, H.z); // laje/teto sobre o térreo
  // janelas do térreo
  for (const s of [-1, 1]) for (const k of [-6, 6]) box(hk, 0.15, 1.8, 2.2, M.glass, H.x + s * (H.w / 2 + 0.45), 2.6, H.z + k, false);
  // tiers superiores (4 pavimentos adicionais)
  const tiers = [[18, 16], [14.5, 13], [11, 10], [8, 7]]; let y = wallH + 0.6;
  tiers.forEach(([w, d], i) => {
    const h = 3.3; box(hk, w, h, d, wm, H.x, y + h / 2, H.z);
    for (let k = -1; k <= 1; k++) { box(hk, 1.4, 1.5, 0.15, M.glass, H.x + k * (w / 3.2), y + h / 2 + 0.1, z1 - (H.d - d) / 2 + 0.05, false); box(hk, 1.4, 1.5, 0.15, M.glass, H.x + k * (w / 3.2), y + h / 2 + 0.1, z0 + (H.d - d) / 2 - 0.05, false); }
    for (const sx of [-1, 1]) box(hk, 0.15, 1.5, 1.4, M.glass, H.x + sx * (w / 2 + 0.05), y + h / 2 + 0.1, H.z, false);
    const rf = box(hk, w + 3, 0.5, d + 3, M.roof, H.x, y + h + 0.25, H.z); rf.material = M.roof;
    box(hk, w + 3.4, 0.25, d + 3.4, M.red, H.x, y + h + 0.62, H.z, false);
    y += h + 0.9;
  });
  const top = new THREE.Mesh(new THREE.ConeGeometry(0.7071, 3.2, 4), M.roof); top.rotation.y = Math.PI / 4; top.scale.set(11, 1, 10); top.position.set(H.x, y + 1.6 - 0.4, H.z); top.castShadow = true; top.add(new THREE.LineSegments(new THREE.EdgesGeometry(top.geometry), edgeMat)); hk.add(top);
  const hsign = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.6), new THREE.MeshBasicMaterial({ map: tex(512, 90, (g, w, h) => { g.fillStyle = '#7a2a1c'; g.fillRect(0, 0, w, h); g.fillStyle = '#f2e8cf'; g.font = 'bold 54px sans-serif'; g.textAlign = 'center'; g.fillText('SALA DO HOKAGE', w / 2, 64); }) }));
  hsign.position.set(H.x, 6.0, z1 + 0.75); hk.add(hsign);
  // degraus
  for (let i = 0; i < 3; i++) box(hk, 9 - i, 0.15, 1.2, M.dark, H.x, 0.075 + i * 0.0, z1 + 1.1 + i * 1.0, false);

  // interior
  const desk = new THREE.Group(); desk.position.set(0, 0, -42); hk.add(desk);
  box(desk, 5.4, 1.0, 1.7, M.wood, 0, 0.5, 0); box(desk, 5.7, 0.14, 2.0, M.dark, 0, 1.05, 0);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.5, 14), M.red); hat.position.set(-1.4, 1.37, 0); hat.castShadow = true; desk.add(hat);
  box(desk, 0.9, 0.05, 0.6, M.cream, 1.2, 1.15, 0.1, false);
  box(hk, 1.6, 1.2, 1.2, M.red, 0, 0.6, -43.9); // cadeira
  box(hk, 6, 0.04, 4, toon(0x9b2d2d), 0, 0.045, -38.5, false); // tapete
  const board = new THREE.Group(); board.position.set(-6, 0, -44.1); hk.add(board);
  box(board, 4.4, 2.8, 0.12, M.wood, 0, 2.1, 0); box(board, 4.8, 0.2, 0.2, M.dark, 0, 3.6, 0);
  const pc = [0xf2e8cf, 0xe8d9a8, 0xf5f0e0, 0xdccb96]; for (let i = 0; i < 6; i++) box(board, 0.8, 1.0, 0.03, toon(pc[i % 4]), -1.6 + (i % 3) * 1.5 + (i > 2 ? 0.3 : 0), 2.5 - Math.floor(i / 3) * 1.2, 0.08, false);
  const boardLabel = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.6), new THREE.MeshBasicMaterial({ map: tex(256, 50, (g, w, h) => { g.fillStyle = '#3a2a22'; g.fillRect(0, 0, w, h); g.fillStyle = '#f2e8cf'; g.font = 'bold 32px sans-serif'; g.textAlign = 'center'; g.fillText('MISSÕES', w / 2, 36); }) })); boardLabel.position.set(0, 3.15, 0.12); board.add(boardLabel);
  for (const s of [-1, 1]) { const b = box(hk, 0.1, 3, 1.4, toon(s < 0 ? 0xc03a2b : 0x2b3a67), s * 7, 2.6, -44.4, false); }
  const inLight = new THREE.PointLight(0xffd9a0, 18, 26, 1.6); inLight.position.set(0, 4.2, -36); hk.add(inLight);
  lantern(-8, 3.6, -34); lantern(8, 3.6, -34);

  // árvores
  const trunkG = new THREE.CylinderGeometry(0.35, 0.5, 4, 7), crownG = new THREE.IcosahedronGeometry(2.6, 0);
  const treePos = []; for (let i = 0; i < 90; i++) { const a = R() * 6.283, r = hv + 6 + R() * 90; const x = Math.cos(a) * r, z = Math.sin(a) * r; if (Math.abs(x) < 14 && z > 0) continue; treePos.push([x, z]); }
  for (let i = 0; i < 14; i++) treePos.push([-hv + 8 + R() * 2 - 1 + (i % 2) * 120, -hv + 8 + i * 9]);
  for (const [x, z] of treePos) { const g = new THREE.Group(); g.position.set(x, 0, z); const s = 0.8 + R() * 0.7; g.scale.setScalar(s); const tr = new THREE.Mesh(trunkG, M.wood); tr.position.y = 2; tr.castShadow = true; g.add(tr); const cr = new THREE.Mesh(crownG, toon(R() > 0.5 ? 0x4f9a3a : 0x5fae44)); cr.position.y = 5.2; cr.castShadow = true; cr.scale.y = 0.9; g.add(cr); root.add(g); }
  // rochas e montanhas ao fundo
  for (let i = 0; i < 18; i++) { const a = (i / 18) * 6.283, r = 260 + R() * 40; const m = new THREE.Mesh(new THREE.ConeGeometry(40 + R() * 40, 70 + R() * 60, 6), toon(i % 2 ? 0x7d8aa6 : 0x6f7c99)); m.position.set(Math.cos(a) * r, 25, Math.sin(a) * r); root.add(m); }
  for (let i = 0; i < 30; i++) { const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8 + R() * 1.4, 0), toon(0x8f8a82)); m.position.set((R() - 0.5) * 80, 0.5, 85 + R() * 50); m.castShadow = true; root.add(m); }
  // nuvens
  const clouds = []; for (let i = 0; i < 14; i++) { const c = new THREE.Group(); for (let k = 0; k < 4; k++) { const p = new THREE.Mesh(new THREE.SphereGeometry(6 + R() * 5, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff })); p.position.set(k * 8 - 12, R() * 3, R() * 4); p.scale.y = 0.55; c.add(p); } c.position.set((R() - 0.5) * 500, 70 + R() * 30, (R() - 0.5) * 500); root.add(c); clouds.push(c); }

  const interactables = [
    { id: 'board', pos: [-6, 0, -42], r: 3.4, label: 'E — Quadro de missões' },
    { id: 'desk', pos: [0, 0, -40.3], r: 3.4, label: 'E — Falar com o Hokage (promoção)' },
    { id: 'ramen', pos: [RAMEN.x, 0, RAMEN.z + 2], r: 3.6, label: 'E — Comer ramen (recupera HP e chakra)' },
  ];
  return {
    root, interactables,
    update(time) {
      lanterns.forEach((l, i) => { l.scale.setScalar(1 + Math.sin(time * 5 + i) * 0.04); });
      noren.forEach((n, i) => { n.rotation.x = Math.sin(time * 1.5 + i) * 0.06; });
      clouds.forEach(c => { c.position.x += 0.4 * 0.016; if (c.position.x > 260) c.position.x = -260; });
    },
  };
}
