// Inimigos, jogadores remotos, zonas de fogo e bolas de fogo inimigas (visualização a partir dos snapshots do servidor).
import * as THREE from 'three';
import { buildNinja, animateNinja } from './ninja.js';
import { textSprite } from './fx.js';
import { ENEMY_TYPES, RANKS } from './shared.js';

const LOOKS = {
  bandit: { hair: 'curto', outfit: 'colete', eyes: 'afiado', pupil: 'fenda', hairColor: '#2a2a2a', skin: '#d9a982', outfitA: '#6b4630', outfitB: '#34343f', accent: '#8a1c1c', eyeColor: '#c0392b', pupilColor: '#000000', muscle: 0.5, fat: 0.2 },
  firebandit: { hair: 'espetado', outfit: 'classico', eyes: 'afiado', pupil: 'fenda', hairColor: '#8a2410', skin: '#d9a982', outfitA: '#d4520f', outfitB: '#2a1a14', accent: '#2a1a14', eyeColor: '#ffb000', pupilColor: '#000000', muscle: 0.3, fat: 0.1 },
  boss: { hair: 'espetado', outfit: 'casaco', eyes: 'afiado', pupil: 'fenda', hairColor: '#111111', skin: '#c99772', outfitA: '#5a1426', outfitB: '#22222e', accent: '#b01e2e', eyeColor: '#ff3030', pupilColor: '#000000', muscle: 0.95, fat: 0.45 },
};
const DUR = { punch1: 0.42, punch2: 0.42, kick: 0.62, cast: 0.6, dash: 0.22, fear: 0.5, djump: 0.5 };
const lerpAng = (a, b, t) => { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * t; };

export function createEntities(scene) {
  const enemies = new Map(), remotes = new Map(), zones = [], ebs = [];
  const zoneGeo = new THREE.CircleGeometry(1, 24), zoneMat = new THREE.MeshBasicMaterial({ color: 0xff5a1f, transparent: true, opacity: 0.55, depthWrite: false });
  for (let i = 0; i < 24; i++) { const m = new THREE.Mesh(zoneGeo, zoneMat.clone()); m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); zones.push(m); }
  const ebGeo = new THREE.SphereGeometry(0.45, 10, 8), ebMat = new THREE.MeshBasicMaterial({ color: 0xff3b1f });
  for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(ebGeo, ebMat); m.visible = false; scene.add(m); ebs.push(m); }
  const flameGeo = new THREE.ConeGeometry(0.25, 0.7, 6), flameMat = new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.85 });
  const ringGeo = new THREE.TorusGeometry(0.35, 0.05, 6, 16), ringMat = new THREE.MeshBasicMaterial({ color: 0xffe14a });
  const barBg = new THREE.SpriteMaterial({ color: 0x14142b, depthTest: false }), barFg = new THREE.SpriteMaterial({ color: 0xe63946, depthTest: false });

  function view(J, scale, h) { const g = J.root; g.scale.setScalar(scale); scene.add(g); return { J, g, p: new THREE.Vector3(), tp: new THREE.Vector3(), ry: 0, tr: 0, init: false, speed: 0, act: null, actT: 0, hurt: 0, h }; }

  const api = {
    enemies, remotes,
    addRemote(info) {
      if (remotes.has(info.id)) return;
      const look = info.look || {}; const J = buildNinja(look, info.clan, info.tails || 0); const v = view(J, 1, (look.height || 1) * 2.15);
      v.name = info.name; v.rank = info.rank; v.tag = textSprite(`${info.name} · ${RANKS[info.rank]}`, { color: '#fff', bg: 'rgba(31,79,255,.85)' }); v.tag.position.y = v.h; v.g.add(v.tag); v.an = 'idle'; v.anAt = 0; v.dead = false; v.hp = 100; v.mhp = 100; remotes.set(info.id, v);
    },
    removeRemote(id) { const v = remotes.get(id); if (v) { scene.remove(v.g); remotes.delete(id); } },
    onSnap(snap, myId) {
      for (const p of snap.pl) {
        if (p.id === myId) continue; const v = remotes.get(p.id); if (!v) continue;
        v.tp.set(p.p[0], p.p[1], p.p[2]); v.tr = p.ry; if (!v.init) { v.p.copy(v.tp); v.ry = v.tr; v.init = true; }
        if (p.an !== v.an) { v.an = p.an; v.anAt = performance.now(); } v.dead = p.dead; v.cl = p.cl; v.hp = p.hp; v.mhp = p.mhp; v.burn = p.burn;
      }
      const seen = new Set();
      for (const e of snap.en) {
        seen.add(e.id); let v = enemies.get(e.id);
        if (!v) { const T = ENEMY_TYPES[e.ty]; const J = buildNinja({ ...LOOKS[e.ty], height: 1 }, 'uchiha', 0); v = view(J, T.scale, 2.2 * T.scale); v.type = e.ty;
          const bg = new THREE.Sprite(barBg), fg = new THREE.Sprite(barFg); bg.scale.set(1.5, 0.16, 1); fg.center.set(0, 0.5); fg.scale.set(1.4, 0.1, 1); bg.position.set(0, v.h / T.scale, 0); fg.position.set(-0.7, v.h / T.scale, 0); bg.renderOrder = 8; fg.renderOrder = 9; v.g.add(bg, fg); v.fg = fg;
          v.flame = new THREE.Mesh(flameGeo, flameMat); v.flame.position.y = 1.0; v.flame.visible = false; v.g.add(v.flame); v.ring = new THREE.Mesh(ringGeo, ringMat); v.ring.rotation.x = Math.PI / 2; v.ring.position.y = 2.0; v.ring.visible = false; v.g.add(v.ring);
          v.mark = textSprite('◆ inimigo', { color: '#ff6b6b', size: 34 }); v.mark.position.y = (v.h / T.scale) + 0.6; v.mark.visible = false; v.g.add(v.mark); enemies.set(e.id, v); }
        v.tp.set(e.p[0], 0, e.p[2]); v.tr = e.ry; if (!v.init) { v.p.copy(v.tp); v.ry = v.tr; v.init = true; }
        v.hp = e.hp; v.stun = e.st; v.burn = e.bn; v.fg.scale.x = Math.max(0.001, 1.4 * e.hp / e.mhp);
      }
      for (const [id, v] of enemies) if (!seen.has(id)) { scene.remove(v.g); enemies.delete(id); }
      zones.forEach((m, i) => { const z = snap.fz[i]; if (!z) { m.visible = false; return; } m.visible = true; m.position.set(z.p[0], 0.08, z.p[2]); m.userData.r = z.r; });
      ebs.forEach((m, i) => { const b = snap.fb[i]; if (!b) { m.visible = false; return; } m.visible = true; m.position.set(b.p[0], b.p[1], b.p[2]); });
    },
    swingAt(p) { let best = null, bd = 4; for (const v of enemies.values()) { const d = Math.hypot(v.p.x - p[0], v.p.z - p[2]); if (d < bd) { bd = d; best = v; } } if (best) { best.act = 'punch1'; best.actT = 0; } },
    update(dt, time, opt) {
      const k = 1 - Math.exp(-dt * 14);
      for (const v of enemies.values()) {
        const prev = v.p.x, prevz = v.p.z; v.p.lerp(v.tp, k); v.ry = lerpAng(v.ry, v.tr, k);
        v.speed = Math.hypot(v.p.x - prev, v.p.z - prevz) / Math.max(dt, 1e-3);
        v.g.position.copy(v.p); v.g.rotation.y = v.ry;
        if (v.act) { v.actT += dt / 0.42; if (v.actT >= 1) v.act = null; }
        animateNinja(v.J, dt, { speed: v.stun ? 0 : v.speed, grounded: true, vy: 0, act: v.act, actT: v.actT, hurt: v.stun ? 1 : 0, localVel: [0, v.speed * 0.4] });
        v.flame.visible = !!v.burn; if (v.burn) { v.flame.scale.y = 1 + Math.sin(time * 20) * 0.2; v.flame.rotation.y += dt * 6; }
        v.ring.visible = !!v.stun; if (v.stun) v.ring.rotation.z += dt * 6;
        v.mark.visible = !!opt.byakugan && v.p.distanceTo(opt.playerPos) < 45;
      }
      for (const v of remotes.values()) {
        const prev = v.p.x, prevz = v.p.z; v.p.lerp(v.tp, k); v.ry = lerpAng(v.ry, v.tr, k);
        v.speed = Math.hypot(v.p.x - prev, v.p.z - prevz) / Math.max(dt, 1e-3);
        v.g.position.set(v.p.x, Math.max(0, v.p.y), v.p.z); v.g.rotation.y = v.ry;
        const air = v.p.y > 0.25, an = v.an, isAct = DUR[an] !== undefined;
        const st = { speed: v.speed, grounded: !air, vy: air ? 1 : 0, act: isAct ? an : null, actT: isAct ? Math.min(1, (performance.now() - v.anAt) / 1000 / DUR[an]) : 0, dead: v.dead, hurt: 0, localVel: [0, v.speed * 0.4], cloak: !!v.cl };
        animateNinja(v.J, dt, st);
      }
      zones.forEach(m => { if (m.visible) { const s = m.userData.r * (0.92 + Math.sin(time * 12 + m.position.x) * 0.06); m.scale.set(s, s, s); } });
    },
    dispose() { for (const v of enemies.values()) scene.remove(v.g); for (const v of remotes.values()) scene.remove(v.g); zones.forEach(m => scene.remove(m)); ebs.forEach(m => scene.remove(m)); enemies.clear(); remotes.clear(); },
  };
  return api;
}
