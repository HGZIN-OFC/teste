// Efeitos: adesivos de impacto estilo mangá, partículas, bolas de fogo, anéis de genjutsu.
import * as THREE from 'three';

const popTex = new Map();
function popTexture(text, color) {
  const key = text + color; if (popTex.has(key)) return popTex.get(key);
  const c = document.createElement('canvas'); c.width = 256; c.height = 160; const g = c.getContext('2d'); g.translate(128, 80);
  g.beginPath(); for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, r = i % 2 ? 56 : 78; g.lineTo(Math.cos(a) * r * 1.5, Math.sin(a) * r); } g.closePath();
  g.fillStyle = color; g.fill(); g.lineWidth = 10; g.strokeStyle = '#fff'; g.stroke(); g.lineWidth = 4; g.strokeStyle = '#14142b'; g.stroke();
  g.font = 'bold 54px Impact, "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 9; g.strokeStyle = '#14142b'; g.strokeText(text, 0, 4); g.fillStyle = '#fff'; g.fillText(text, 0, 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; popTex.set(key, t); return t;
}
export function textSprite(text, { color = '#fff', bg = 'rgba(20,20,43,.8)', size = 40 } = {}) {
  const c = document.createElement('canvas'); c.width = 320; c.height = 64; const g = c.getContext('2d');
  g.font = `bold ${size}px Trebuchet MS, Arial`; const w = Math.min(310, g.measureText(text).width + 30);
  g.fillStyle = bg; g.beginPath(); g.roundRect ? g.roundRect(160 - w / 2, 6, w, 52, 14) : g.rect(160 - w / 2, 6, w, 52); g.fill();
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 160, 33);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); s.scale.set(2.4, 0.48, 1); s.renderOrder = 10; return s;
}

export function createFx(scene) {
  const pops = [], parts = [], balls = [], rings = [];
  const pg = new THREE.SphereGeometry(0.12, 6, 5);
  const pool = []; for (let i = 0; i < 140; i++) { const m = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ transparent: true })); m.visible = false; scene.add(m); pool.push({ m, life: 0, vel: new THREE.Vector3(), max: 1 }); }
  const ballGeo = new THREE.SphereGeometry(0.5, 14, 10), coreGeo = new THREE.SphereGeometry(0.3, 10, 8);
  const ballMat = new THREE.MeshBasicMaterial({ color: 0xff6a1a }), coreMat = new THREE.MeshBasicMaterial({ color: 0xffe27a });
  const ringGeo = new THREE.RingGeometry(0.9, 1, 40);
  return {
    pop(pos, text, color = '#e63946') {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: popTexture(text, color), depthTest: false, transparent: true })); s.scale.set(2.4, 1.5, 1); s.position.set(pos[0], pos[1], pos[2]); s.renderOrder = 11;
      scene.add(s); pops.push({ s, t: 0 });
    },
    burst(pos, color = 0xff8a1f, n = 14, speed = 5) {
      let k = 0; for (const p of pool) { if (k >= n) break; if (p.life > 0) continue; k++; p.life = p.max = 0.4 + Math.random() * 0.4; p.m.visible = true; p.m.material.color.setHex(color); p.m.position.set(pos[0], pos[1], pos[2]);
        p.vel.set((Math.random() - 0.5) * speed, Math.random() * speed * 0.8, (Math.random() - 0.5) * speed); }
    },
    fireball(pos, dir, big, mine) {
      const g = new THREE.Group(); g.add(new THREE.Mesh(ballGeo, ballMat), new THREE.Mesh(coreGeo, coreMat)); const sc = big ? 1.5 : 1; g.scale.setScalar(sc); g.position.set(pos[0], pos[1], pos[2]); scene.add(g);
      const b = { g, v: new THREE.Vector3(dir[0], dir[1], dir[2]).normalize().multiplyScalar(26), life: 2.4, mine, big, dead: false }; balls.push(b); return b;
    },
    ring(pos, r, color = 0x8a2be2) {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, opacity: 0.8 })); m.rotation.x = -Math.PI / 2; m.position.set(pos[0], 0.15, pos[2]); scene.add(m); rings.push({ m, t: 0, r });
    },
    update(dt, onBall) {
      for (let i = pops.length - 1; i >= 0; i--) { const p = pops[i]; p.t += dt; p.s.position.y += dt * 1.6; p.s.material.opacity = Math.max(0, 1 - Math.max(0, p.t - 0.5) / 0.4); const sc = p.t < 0.15 ? 0.5 + p.t * 6 : 1.4; p.s.scale.set(2.4 * sc / 1.4, 1.5 * sc / 1.4, 1); if (p.t > 0.9) { scene.remove(p.s); p.s.material.dispose(); pops.splice(i, 1); } }
      for (const p of pool) { if (p.life <= 0) continue; p.life -= dt; p.vel.y -= 9 * dt; p.m.position.addScaledVector(p.vel, dt); p.m.material.opacity = Math.max(0, p.life / p.max); if (p.life <= 0) p.m.visible = false; }
      for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.t += dt; const s = r.r * Math.min(1, r.t / 0.4); r.m.scale.set(s, s, s); r.m.material.opacity = Math.max(0, 0.8 - r.t * 1.2); if (r.t > 0.7) { scene.remove(r.m); r.m.material.dispose(); rings.splice(i, 1); } }
      for (let i = balls.length - 1; i >= 0; i--) {
        const b = balls[i]; b.life -= dt; b.g.position.addScaledVector(b.v, dt); b.g.rotation.y += dt * 8;
        if (Math.random() < 0.8) this.burst([b.g.position.x, b.g.position.y, b.g.position.z], Math.random() > 0.5 ? 0xff8a1f : 0xffd23f, 1, 1.5);
        if (!b.dead && b.mine && onBall) { if (onBall(b)) b.dead = true; }
        if (b.life <= 0 || b.dead) { scene.remove(b.g); balls.splice(i, 1); }
      }
    },
    clear() { for (const p of pops) scene.remove(p.s); for (const b of balls) scene.remove(b.g); for (const r of rings) scene.remove(r.m); pops.length = balls.length = rings.length = 0; },
  };
}
