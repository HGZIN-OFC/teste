// Construtor procedural de ninjas (modelo 100% original, sem arquivos externos).
// Visual "cel-shading": MeshToonMaterial em 3 tons + contorno por casco invertido.
import * as THREE from 'three';

export const HAIR_STYLES = [['espetado', 'Espetado'], ['curto', 'Curto com franja'], ['longo', 'Longo'], ['rabo', 'Rabo de cavalo'], ['coque', 'Coque'], ['selvagem', 'Selvagem espetado'], ['raspado', 'Espetado curto (laterais raspadas)'], ['liso', 'Penteado para trás'], ['lateral', 'Franja lateral']];
export const OUTFITS = [['classico', 'Shinobi clássico'], ['colete', 'Colete tático'], ['regata', 'Regata de treino'], ['casaco', 'Casaco longo']];
export const EYE_STYLES = [['chibi', 'Redondo fofo'], ['amendoado', 'Amendoado'], ['grande', 'Grande'], ['afiado', 'Afiado'], ['sereno', 'Sereno']];
export const BAND_OPTS = [['nao', 'Sem testeira'], ['sim', 'Com testeira']];
export const PUPIL_STYLES = [['redonda', 'Redonda'], ['fenda', 'Fenda'], ['tomoe', 'Tomoe (3 marcas)'], ['anel', 'Anel pálido'], ['estrela', 'Estrela']];

export function defaultLook() {
  return {
    hair: 'espetado', outfit: 'classico', eyes: 'chibi', pupil: 'redonda', band: 'nao',
    hairColor: '#e8b923', skin: '#f1c9a5', outfitA: '#e8731a', outfitB: '#2b3a67', accent: '#1f2a44',
    eyeColor: '#4a2c1c', pupilColor: '#101018',
    height: 1.0, muscle: 0.35, fat: 0.1,
  };
}

// ---------- materiais compartilhados ----------
const gradient = (() => {
  const t = new THREE.DataTexture(new Uint8Array([175, 200, 225, 245, 255]), 5, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true; return t;
})();
export const outlineMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  uniforms: { thick: { value: 0.0035 } },
  vertexShader: 'uniform float thick; void main(){ gl_Position = projectionMatrix*modelViewMatrix*vec4(position+normal*thick,1.0); }',
  fragmentShader: 'void main(){ gl_FragColor = vec4(0.16,0.09,0.09,1.0); }',
});
const matCache = new Map();
export function toon(color) {
  const k = String(color);
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshToonMaterial({ color: new THREE.Color(color), gradientMap: gradient }));
  return matCache.get(k);
}
export function setOutlines(on) { outlineMat.visible = on; }

const ell = (rx, ry, rz, seg = 32) => new THREE.SphereGeometry(1, seg, Math.max(12, seg >> 1)).scale(rx, ry, rz);
function mesh(geo, color, parent, { outline = true, pos, rot } = {}) {
  const m = new THREE.Mesh(geo, typeof color === 'object' && color.isMaterial ? color : toon(color));
  if (outline) { const o = new THREE.Mesh(geo, outlineMat); o.userData.outline = true; m.add(o); }
  if (pos) m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  m.castShadow = true;
  parent && parent.add(m); return m;
}
const grp = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent && parent.add(g); return g; };

// Costuras: pequenas caixinhas instanciadas ao longo de um caminho
const stitchGeo = new THREE.BoxGeometry(0.006, 0.0025, 0.022);
function stitches(parent, pts, color = 0x2a1c14) {
  return null; // costuras removidas: visual mais limpo
  const im = new THREE.InstancedMesh(stitchGeo, new THREE.MeshBasicMaterial({ color }), pts.length);
  const d = new THREE.Object3D();
  pts.forEach((s, i) => { d.position.set(s[0], s[1], s[2]); d.rotation.set(s[3] || 0, s[4] || 0, s[5] || 0); d.updateMatrix(); im.setMatrixAt(i, d.matrix); });
  parent.add(im); return im;
}
function ringStitches(parent, y, rx, rz, n, color) { // anel horizontal (barra/gola)
  const pts = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push([Math.sin(a) * rx, y, Math.cos(a) * rz, 0, a, 0]); }
  return stitches(parent, pts, color);
}
function lineStitches(parent, a, b, n, color) { // fileira reta de pontos
  const pts = [], dir = new THREE.Vector3(...b).sub(new THREE.Vector3(...a)), L = dir.length();
  const rx = Math.atan2(dir.y, Math.hypot(dir.x, dir.z)), ry = Math.atan2(dir.x, dir.z);
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; pts.push([a[0] + dir.x * t, a[1] + dir.y * t, a[2] + dir.z * t, -rx, ry, 0]); }
  return stitches(parent, pts, color);
}

// Tubo afilado (mecha de cabelo). Pontos relativos à raiz.
function taperedTube(points, r0, r1, radial = 6) {
  const n = points.length, pos = [], idx = [];
  const up = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i < n; i++) {
    const p = points[i], q = points[Math.min(n - 1, i + 1)], o = points[Math.max(0, i - 1)];
    const tan = new THREE.Vector3().subVectors(q, o).normalize();
    let side = new THREE.Vector3().crossVectors(tan, up);
    if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
    side.normalize();
    const bin = new THREE.Vector3().crossVectors(tan, side).normalize();
    const r = r0 + (r1 - r0) * (i / (n - 1));
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      pos.push(p.x + (side.x * Math.cos(a) + bin.x * Math.sin(a)) * r, p.y + (side.y * Math.cos(a) + bin.y * Math.sin(a)) * r, p.z + (side.z * Math.cos(a) + bin.z * Math.sin(a)) * r);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < radial; j++) {
    const a = i * radial + j, b = i * radial + (j + 1) % radial, c = (i + 1) * radial + j, d = (i + 1) * radial + (j + 1) % radial;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

// ---------- rosto (olhos/pupilas) ----------
function faceTexture(look, clan) {
  const W = 512, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const eye = (cx, cy, mirror) => {
    const ch = look.eyes === 'chibi'; const ew = ch ? 58 : 62, eh = ch ? 62 : look.eyes === 'grande' ? 42 : look.eyes === 'afiado' ? 24 : look.eyes === 'sereno' ? 26 : 32;
    g.save(); g.translate(cx, cy); if (mirror) g.scale(-1, 1);
    const tilt = look.eyes === 'afiado' ? -0.28 : look.eyes === 'amendoado' ? -0.12 : 0;
    g.rotate(tilt);
    g.beginPath(); g.ellipse(0, 0, ew, eh, 0, 0, Math.PI * 2); g.fillStyle = '#fbfbff'; g.fill();
    g.save(); g.beginPath(); g.ellipse(0, 0, ew, eh, 0, 0, Math.PI * 2); g.clip();
    const ir = ch ? 56 : Math.min(eh, 34) * (look.eyes === 'sereno' ? 1.1 : 1.0) + 4;
    g.beginPath(); g.arc(0, 2, ir, 0, Math.PI * 2); g.fillStyle = look.eyeColor; g.fill();
    g.beginPath(); g.arc(0, 2, ir, 0, Math.PI * 2); g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.45)'; g.stroke();
    const pc = look.pupilColor; g.fillStyle = pc; g.strokeStyle = pc;
    if (look.pupil === 'redonda') { g.beginPath(); g.arc(0, 2, ir * (ch ? 0.72 : 0.45), 0, 7); g.fill(); }
    else if (look.pupil === 'fenda') { g.beginPath(); g.ellipse(0, 2, ir * 0.16, ir * 0.9, 0, 0, 7); g.fill(); }
    else if (look.pupil === 'tomoe') {
      g.beginPath(); g.arc(0, 2, ir * 0.22, 0, 7); g.fill();
      for (let k = 0; k < 3; k++) { const a = k * 2.094 - 1.57; g.beginPath(); g.arc(Math.cos(a) * ir * 0.62, 2 + Math.sin(a) * ir * 0.62, ir * 0.17, 0, 7); g.fill(); }
      g.lineWidth = 2; g.beginPath(); g.arc(0, 2, ir * 0.62, 0, 7); g.stroke();
    } else if (look.pupil === 'anel') { g.lineWidth = 5; g.beginPath(); g.arc(0, 2, ir * 0.72, 0, 7); g.stroke(); }
    else if (look.pupil === 'estrela') {
      g.beginPath(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, r = k % 2 ? ir * 0.22 : ir * 0.62; g.lineTo(Math.cos(a) * r, 2 + Math.sin(a) * r); } g.closePath(); g.fill();
    }
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(-ir * 0.35, -ir * 0.35, ir * (ch ? 0.28 : 0.2), 0, 7); g.fill();
    if (ch) { g.beginPath(); g.arc(ir * 0.38, ir * 0.4, ir * 0.12, 0, 7); g.fill(); }
    g.restore();
    g.lineWidth = ch ? 8 : 6; g.strokeStyle = '#2a1820'; g.beginPath(); g.ellipse(0, 0, ew, eh, 0, Math.PI * 1.02, Math.PI * 1.98); g.stroke();
    if (look.eyes === 'sereno') { g.fillStyle = look.skin; g.fillRect(-ew - 4, -eh - 4, ew * 2 + 8, eh * 0.7); g.beginPath(); g.moveTo(-ew, -eh * 0.3); g.lineTo(ew, -eh * 0.3); g.lineWidth = 6; g.stroke(); }
    g.restore();
    // sobrancelha
    g.save(); g.translate(cx, cy - eh - (ch ? 14 : 30)); if (mirror) g.scale(-1, 1); g.rotate(look.eyes === 'afiado' ? -0.25 : -0.05);
    g.fillStyle = look.hairColor; g.fillRect(-48, -5, 96, 11); g.restore();
  };
  const cyE = look.eyes === 'chibi' ? 122 : 148;
  eye(150, cyE, false); eye(362, cyE, true);
  if (look.eyes === 'chibi') { g.fillStyle = 'rgba(255,110,110,0.38)'; for (const x of [92, 420]) { g.beginPath(); g.ellipse(x, 204, 34, 20, 0, 0, 7); g.fill(); } }
  g.strokeStyle = '#6b3a30'; g.lineWidth = 4; g.beginPath(); g.moveTo(236, 212); g.quadraticCurveTo(256, 224, 276, 212); g.stroke(); // boca
  if (clan === 'uzumaki') { g.strokeStyle = 'rgba(60,30,20,.55)'; g.lineWidth = 3; for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(256 + s * 150, 170 + k * 14); g.lineTo(256 + s * 205, 166 + k * 16); g.stroke(); } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// ---------- materiais do personagem (vinil liso, estilo boneco colecionável) ----------
const vinylCache = new Map();
function vinyl(color, double = false) {
  const k = String(color) + double;
  if (!vinylCache.has(k)) vinylCache.set(k, new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.55, metalness: 0, side: double ? THREE.DoubleSide : THREE.FrontSide }));
  return vinylCache.get(k);
}
function part(geo, mat, parent, pos, rot) {
  const m = new THREE.Mesh(geo, typeof mat === 'object' && mat.isMaterial ? mat : vinyl(mat));
  if (pos) m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  m.castShadow = true; parent.add(m); return m;
}
// Perfil suave (Catmull-Rom) de pontos [raio, y], de baixo para cima
function smoothProfile(ctrl, per = 6) {
  const out = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push(new THREE.Vector2(Math.max(0, f(p0[0], p1[0], p2[0], p3[0])), f(p0[1], p1[1], p2[1], p3[1])));
    }
  }
  const l = ctrl[ctrl.length - 1]; out.push(new THREE.Vector2(l[0], l[1]));
  return out;
}
function lathe(ctrl, sx = 1, sz = 1, seg = 40, phiStart = 0, phiLen = Math.PI * 2) {
  return new THREE.LatheGeometry(smoothProfile(ctrl), seg, phiStart, phiLen).scale(sx, 1, sz);
}
// Membro afilado de uma peça só: começa na articulação (y=0) e desce até -L
function limb(r0, r1, L, seg = 24) {
  const pts = [];
  for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 + (i / 8) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.cos(a) * r1, -L + Math.sin(a) * r1)); }
  for (let i = 1; i <= 8; i++) { const a = (i / 8) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.cos(a) * r0, Math.sin(a) * r0)); }
  return new THREE.LatheGeometry(pts, seg);
}

// Textura de fios: riscos finos ao longo da mecha (claros e escuros), multiplicada pela cor do cabelo
let hairTexCache = null;
function hairTexture() {
  if (hairTexCache) return hairTexCache;
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  g.fillStyle = '#d9d9d9'; g.fillRect(0, 0, S, S);
  let sd = 12345; const R = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  for (let i = 0; i < 44; i++) { // fios: linhas levemente onduladas no sentido do comprimento
    const x = R() * S, w = 2 + R() * 5, dark = R() < 0.55, a = 0.1 + R() * 0.22, wob = (R() - 0.5) * 12;
    g.strokeStyle = dark ? `rgba(70,60,60,${a})` : `rgba(255,255,255,${a + 0.15})`; g.lineWidth = w;
    for (const off of [-S, 0, S]) { g.beginPath(); g.moveTo(x + off, 0); g.bezierCurveTo(x + off + wob, S * 0.33, x + off - wob, S * 0.66, x + off, S); g.stroke(); }
  }
  const sh = g.createLinearGradient(0, 0, 0, S); sh.addColorStop(0, 'rgba(0,0,0,0.22)'); sh.addColorStop(0.35, 'rgba(0,0,0,0)'); sh.addColorStop(0.55, 'rgba(255,255,255,0.16)'); sh.addColorStop(0.75, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.1)');
  g.fillStyle = sh; g.fillRect(0, 0, S, S); // raiz mais escura + faixa de brilho no meio
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return (hairTexCache = t);
}
const hairMatCache = new Map();
function hairMaterial(color) {
  const k = String(color);
  if (!hairMatCache.has(k)) { const t = hairTexture(); hairMatCache.set(k, new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(1.12), map: t, bumpMap: t, bumpScale: 0.25, roughness: 0.5, metalness: 0, side: THREE.DoubleSide })); }
  return hairMatCache.get(k);
}

// ---------- cabelo: mechas largas e achatadas que seguem a curva da cabeça ----------
const HC = new THREE.Vector3(0, 0.008, -0.004), HR = new THREE.Vector3(0.134, 0.138, 0.134), HAVG = 0.133;
const unitAt = (th, ph) => new THREE.Vector3(Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph)); // th=0 topo, ph=0 frente
const onCap = (u, k = 1) => new THREE.Vector3(u.x * HR.x * k, u.y * HR.y * k, u.z * HR.z * k).add(HC);
function clumpPath(root, target, o) {
  const u0 = unitAt(root[0], root[1]);
  let d0;
  if (o.dir) { d0 = new THREE.Vector3(o.dir[0], o.dir[1], o.dir[2]); d0.addScaledVector(u0, -d0.dot(u0)); } // direção do penteado projetada na cabeça
  else { const t = unitAt(target[0], target[1]); d0 = t.clone().addScaledVector(u0, -t.dot(u0)); }
  if (d0.lengthSq() < 1e-6) d0.set(0, -1, 0).addScaledVector(u0, -u0.y);
  d0.normalize();
  const side = new THREE.Vector3().crossVectors(u0, d0);
  const n = 16, pts = [], hang = o.hang || 0, Lg = o.len * (1 - hang);
  let last = null;
  for (let i = 0; i < n; i++) {
    const s = i / (n - 1), dist = s * o.len;
    let p;
    if (dist <= Lg + 1e-9) {
      const a = dist / HAVG, u = u0.clone().multiplyScalar(Math.cos(a)).addScaledVector(d0, Math.sin(a));
      p = onCap(u, 0.985 + (o.lift || 0) * s * s + (o.base || 0) * Math.min(1, s * 4));
      p.addScaledVector(side, (o.bend || 0) * s * s);
      p.y -= (o.grav || 0) * s * s; p.y += (o.up || 0) * s * s;
      last = p.clone();
    } else {
      const h = (dist - Lg), out = new THREE.Vector3(last.x - HC.x, 0, last.z - HC.z).normalize();
      p = last.clone().addScaledVector(out, h * 0.18 + (o.flare || 0) * h * h * 4).add(new THREE.Vector3(0, -h, 0)).addScaledVector(side, (o.bend || 0) * (1 + h * 4));
    }
    pts.push(p);
  }
  return pts;
}
function clumpGeo(pts, W, T, uOff = 0, root = 0.7, wrap = 0, tipQ = 2.2) {
  const n = pts.length, radial = 10, pos = [], uv = [], idx = [];
  for (let i = 0; i < n; i++) {
    const s = i / (n - 1), p = pts[i];
    const tan = new THREE.Vector3().subVectors(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize();
    const out = new THREE.Vector3().subVectors(p, HC).normalize();
    const side = new THREE.Vector3().crossVectors(tan, out); if (side.lengthSq() < 1e-6) side.set(1, 0, 0); side.normalize();
    const up = new THREE.Vector3().crossVectors(side, tan).normalize();
    let fw, ft;
    if (wrap) { // lâmina larga e fluida: nasce fina e rente à calota, fica cheia no meio e fecha em ponta de cunha
      const x3 = Math.max(0, Math.min(1, s / 0.3)), rise = x3 * x3 * (3 - 2 * x3), tp = Math.pow(1 - Math.pow(s, tipQ), 0.8);
      fw = (root + (1 - root) * rise) * tp; ft = (0.12 + 0.88 * rise) * tp;
    } else fw = ft = Math.pow(1 - s, 0.85) * (root + (1 - root) * Math.sin(Math.PI * Math.min(1, s * 1.7)));
    const w = W * fw, th = T * ft;
    const c = p.clone().addScaledVector(up, th * 0.55);
    const Rl = wrap ? new THREE.Vector3().subVectors(c, HC).length() : 0;
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const lens = Math.sign(sa) * Math.pow(Math.abs(sa), 0.8); // seção em "lente": bordas finas, miolo cheio
      const x = ca * w, drop = wrap ? (Rl - Math.sqrt(Math.max(Rl * Rl - x * x, Rl * Rl * 0.3))) * wrap : 0; // mecha larga acompanha a curva da cabeça
      const h = lens * th - drop;
      pos.push(c.x + side.x * x + up.x * h, c.y + side.y * x + up.y * h, c.z + side.z * x + up.z * h);
      uv.push((j / radial) * 2 + uOff, s);
    }
  }
  const R1 = radial + 1;
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < radial; j++) {
    const a = i * R1 + j, b = a + 1, c = (i + 1) * R1 + j, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
// calota: casca que cobre o topo; a borda desce mais atrás que na testa
function capGeo(thFront, thSide, thBack, k = 1.0, edge = 0.06) {
  const W = 48, H = 18, pos = [], uv = [], idx = [];
  for (let i = 0; i <= H; i++) for (let j = 0; j <= W; j++) {
    const ph = (j / W) * Math.PI * 2, back = (1 - Math.cos(ph)) / 2, sd = Math.sin(ph) ** 2;
    const tmax = thFront + (thBack - thFront) * back * back + (thSide - (thFront + (thBack - thFront) * 0.25)) * sd;
    const e = Math.max(0, Math.min(1, (i / H - 0.72) / 0.28)), ke = k * (1 - edge * e * e * (3 - 2 * e));
    const p = onCap(unitAt((i / H) * tmax, ph), ke); pos.push(p.x, p.y, p.z); uv.push((j / W) * 8, (i / H) * 1.5);
  }
  for (let i = 0; i < H; i++) for (let j = 0; j < W; j++) { const a = i * (W + 1) + j, b = a + W + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

function buildHair(head, look, rng, hasBand) {
  const hm = hairMaterial(look.hairColor);
  const locks = [];
  const style = look.hair;
  const add = (root, target, o) => {
    const pts = clumpPath(root, target, o), r0 = pts[0].clone();
    const pivot = grp(head, r0.x, r0.y, r0.z);
    part(clumpGeo(pts.map((p) => p.clone().sub(r0)), o.w || 0.05, o.t || 0.026, rng(), o.root ?? 0.7, o.wrap ?? 0, o.q ?? 2.2), hm, pivot);
    const tip = pts[pts.length - 1].clone().sub(r0);
    locks.push({ pivot, sway: o.sway ?? 0.5, phase: rng() * 6.28, len: o.len, up: tip.y > 0.02 ? -1 : 1 });
  };
  const ring = (n, th, from, to, fn) => { for (let i = 0; i < n; i++) { const ph = n === 1 ? from : from + (to - from) * (i / (n - 1)); fn(ph, i, th); } };
  const j = (a) => (rng() - 0.5) * a; // pequena variação, sem bagunça

  if (style === 'raspado') {
    const sc = new THREE.Color(look.skin).lerp(new THREE.Color(look.hairColor), 0.45);
    part(capGeo(0.9, 1.6, 2.35, 0.965, 0.03), hairMaterial('#' + sc.getHexString()), head);
    part(capGeo(0.93, 1.0, 1.1, 1.0, 0.035), hm, head);
  } else part(capGeo(0.95, 1.5, 2.3), hm, head);

  if (style === 'espetado' || style === 'selvagem') { // pontas grandes e largas em camadas (estilo anime): topo para cima, lados para fora, franja em triângulos
    const W = style === 'selvagem' ? 1.3 : 1;
    ring(5, 0.12, 0.6, 0.6 + Math.PI * 2 * 4 / 5, (ph) => add([0.12, ph], [1.4, ph], { len: 0.04, lift: 0.6 * W, up: 0.02 * W, w: 0.1, t: 0.046, sway: 0.4 })); // topo
    ring(7, 0.5, 0.75, Math.PI * 2 - 0.75, (ph) => add([0.5, ph], [1.6, ph], { len: 0.055, lift: 0.62 * W, w: 0.11, t: 0.046, sway: 0.45 })); // camada alta
    ring(8, 0.95, 1.0, Math.PI * 2 - 1.0, (ph) => add([0.95, ph], [1.9, ph], { len: 0.06, lift: 0.6 * W, w: 0.11, t: 0.044, sway: 0.5 })); // lados e trás
    ring(6, 1.4, 1.55, Math.PI * 2 - 1.55, (ph) => add([1.4, ph], [2.4, ph], { len: 0.055, lift: 0.5 * W, w: 0.095, t: 0.04, sway: 0.6 })); // nuca
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) add([0.42 + k * 0.07, s * (0.07 + k * 0.06)], [1.3, s * (0.8 + k * 0.28)], { len: 0.12 + k * 0.012, lift: hasBand ? 0.22 : 0.14, base: hasBand ? 0.17 : 0.04, w: 0.088, t: 0.034, sway: 0.6 }); // franja repartida ao meio: metade para cada lado
    for (const s of [-1, 1]) add([0.7, s * 1.0], [2.2, s * 1.05], { len: 0.19 * W, lift: 0.3, w: 0.08, t: 0.034, sway: 0.8 }); // mecha do rosto
  } else if (style === 'curto') {
    ring(9, 0.45, 0, Math.PI * 2 * 8 / 9, (ph) => add([0.45, ph], [1.5, ph + 0.15], { len: 0.15, lift: 0.22, w: 0.065, t: 0.03, sway: 0.4 }));
    ring(11, 1.0, 1.0, Math.PI * 2 - 1.0, (ph) => add([1.0, ph], [1.9, ph], { len: 0.12, lift: 0.25, w: 0.06, t: 0.028, sway: 0.5 }));
    ring(5, 0.72, -0.55, 0.55, (ph) => add([0.72, ph], [1.35, ph * 1.3], { len: hasBand ? 0.05 : 0.058, lift: hasBand ? 0.5 : 0.2, w: 0.055, t: 0.026, sway: 0.6 }));
    for (const s of [-1, 1]) add([1.05, s * 1.2], [2.0, s * 1.05], { len: 0.12, lift: 0.15, w: 0.05, t: 0.024, sway: 0.7 });
  } else if (style === 'longo') {
    ring(11, 0.55, 1.05, Math.PI * 2 - 1.05, (ph) => add([0.55, ph], [1.6, ph], { len: 0.52, hang: 0.55, lift: 0.12, w: 0.065, t: 0.026, sway: 1.1, flare: 0.05 }));
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) add([0.3 + k * 0.12, s * 0.2], [1.45, s * (1.6 + k * 0.15)], { len: 0.5, hang: 0.42, lift: 0.18, w: 0.06, t: 0.024, sway: 1.0 });
  } else if (style === 'rabo') {
    const tie = [0.95, Math.PI];
    ring(12, 1.0, 0.3, Math.PI * 2 - 0.3, (ph) => { const r = [0.75 + Math.abs(Math.cos(ph)) * 0.25, ph]; const u = unitAt(...r), tu = unitAt(...tie); add(r, tie, { len: Math.acos(Math.max(-1, Math.min(1, u.dot(tu)))) * HAVG * 0.98, lift: 0.04, w: 0.06, t: 0.02, sway: 0.15 }); });
    ring(5, 0.95, Math.PI - 0.25, Math.PI + 0.25, (ph) => add([0.95, ph], [1.7, ph], { len: 0.5, hang: 0.7, lift: 0.35, w: 0.06, t: 0.03, sway: 1.5, flare: 0.04 }));
    const tp = onCap(unitAt(...tie), 1.06); part(new THREE.TorusGeometry(0.03, 0.012, 10, 24), vinyl(look.accent), head, [tp.x, tp.y, tp.z], [0.5, 0, 0]);
    for (const s of [-1, 1]) add([1.0, s * 1.15], [2.0, s * 1.0], { len: 0.13, lift: 0.12, w: 0.045, t: 0.022, sway: 0.8 });
  } else if (style === 'coque') {
    const top = [0.4, Math.PI];
    ring(12, 1.0, 0.3, Math.PI * 2 - 0.3, (ph) => { const r = [0.85 + Math.abs(Math.cos(ph)) * 0.2, ph]; const u = unitAt(...r), tu = unitAt(...top); add(r, top, { len: Math.acos(Math.max(-1, Math.min(1, u.dot(tu)))) * HAVG * 0.95, lift: 0.04, w: 0.06, t: 0.02, sway: 0.15 }); });
    const bp = onCap(unitAt(...top), 1.28); part(ell(0.068, 0.062, 0.068, 32), hm, head, [bp.x, bp.y, bp.z]);
    for (const s of [-1, 1]) add([0.95, s * 1.0], [2.0, s * 0.95], { len: 0.17, lift: 0.12, w: 0.05, t: 0.022, sway: 0.9 });
  } else if (style === 'selvagem') {
    // (tratado junto com 'espetado')
  } else if (style === 'raspado') { // topo penteado para cima e para trás, rente à cabeça; franja pequena na testa; laterais raspadas
    const flow = (root, dir, o) => add(root, null, { wrap: 1, q: 1.1, sway: 0.4, ...o, dir });
    ring(5, 0.66, -0.75, 0.75, (ph) => flow([0.62, ph], [0, 0.5, -1], { len: 0.085, lift: 0.3, up: 0.008, w: 0.075, t: 0.018 })); // frente do topo: sobe e vira para trás
    ring(5, 0.4, -1.0, 1.0, (ph) => flow([0.4, ph], [0, 0.3, -1], { len: 0.085, lift: 0.3, up: 0.006, w: 0.085, t: 0.024 })); // segunda fileira
    ring(5, 0.35, Math.PI - 1.2, Math.PI + 1.2, (ph) => flow([0.35, ph], [0, -0.2, -1], { len: 0.09, lift: 0.28, w: 0.085, t: 0.024 })); // coroa
    for (const s of [-1, 1]) ring(3, 0.55, s * 1.0, s * 2.1, (ph) => flow([0.55, ph], [0, -1, -0.7], { len: 0.07, lift: 0.04, q: 1.3, w: 0.07, t: 0.016 })); // lados: caem para trás e terminam em ponta na linha do raspado
    ring(4, 0.6, Math.PI - 0.75, Math.PI + 0.75, (ph) => flow([0.6, ph], [0, -1, -0.3], { len: 0.07, lift: 0.06, q: 1.3, w: 0.07, t: 0.016 })); // barra de trás
    const fl = [0.046, 0.052, 0.048, 0.054, 0.05, 0.046];
    ring(6, 0.72, -0.62, 0.62, (ph, i) => flow([0.72, ph], [0.15, -1, 0.3], { len: fl[i], lift: 0.02, base: hasBand ? 0.14 : 0, q: 1.3, root: 0.6, w: 0.05, t: 0.012, sway: 0.5 })); // franja pequena caindo na testa
  } else if (style === 'liso') {
    ring(13, 0.95, -1.25, 1.25, (ph) => add([0.95, ph], [1.25, Math.PI - ph * 0.3], { len: 0.31, lift: 0.07, w: 0.05, t: 0.018, sway: 0.15 }));
    for (const s of [-1, 1]) ring(3, 1.3, s * 1.35, s * 1.85, (ph) => add([1.3, ph], [1.55, Math.PI], { len: 0.2, lift: 0.06, w: 0.05, t: 0.018, sway: 0.15 }));
    ring(5, 1.7, Math.PI - 0.6, Math.PI + 0.6, (ph) => add([1.7, ph], [2.4, ph], { len: 0.07, lift: 0.5, w: 0.05, t: 0.022, sway: 0.4 }));
  } else if (style === 'lateral') { // repartido de lado: franja longa descendo em diagonal pela testa, laterais e nuca cobertas em camadas
    const flow = (root, dir, o) => add(root, null, { wrap: 1, ...o, dir });
    const P = -0.5;
    const fr = [[0.3, [1, -0.5, 0.2], 0.2], [0.42, [1, -0.55, 0.25], 0.18], [0.54, [1, -0.65, 0.32], 0.155], [0.66, [1, -0.75, 0.4], 0.125], [0.78, [1, -0.85, 0.5], 0.095]];
    for (const [th, dir, len] of fr) flow([th, P + 0.05], dir, { len, lift: hasBand ? 0.22 : 0.12, base: 0.03, w: 0.078, t: 0.022, root: 0.4, sway: 0.6 }); // franja longa: do repartido, em diagonal pela testa, até o lado do rosto
    for (let k = 0; k < 4; k++) flow([0.3 + k * 0.16, P - 0.1], [-0.9, -0.8, 0.2], { len: 0.13 + k * 0.012, lift: 0.1, base: 0.03, w: 0.078, t: 0.022, root: 0.4, sway: 0.5 }); // lado curto do repartido
    ring(7, 0.5, 1.25, Math.PI * 2 - 1.25, (ph) => flow([0.5, ph], [0, -1, -0.25], { len: 0.2, lift: 0.06, q: 1.6, w: 0.095, t: 0.03, sway: 0.45 })); // coroa e costas
    ring(6, 1.05, 1.6, Math.PI * 2 - 1.6, (ph) => flow([1.05, ph], [0, -1, -0.2], { len: 0.14, lift: 0.1, q: 1.6, w: 0.09, t: 0.03, sway: 0.5 })); // nuca
    ring(3, 0.6, 1.0, 1.6, (ph) => flow([0.6, ph], [0.3, -1, 0.1], { len: 0.16, lift: 0.08, w: 0.09, t: 0.032, sway: 0.5 })); // lado da franja
    ring(3, 0.7, -1.4, -2.0, (ph) => flow([0.7, ph], [-0.3, -1, -0.1], { len: 0.15, lift: 0.08, w: 0.09, t: 0.032, sway: 0.5 })); // lado do repartido
  }
  return locks;
}

// ---------- corpo completo ----------
export function buildNinja(look, clan = 'uchiha', tails = 0) {
  look = { ...defaultLook(), ...look };
  let seed = 7; for (const ch of look.hair + look.hairColor) seed = (seed * 31 + ch.charCodeAt(0)) % 99991;
  const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const M = look.muscle, F = look.fat, sk = look.skin;
  const HIPY = 0.58, HEADS = 2.4;
  const root = new THREE.Group();
  const scaleG = grp(root); scaleG.scale.setScalar(look.height);
  const hips = grp(scaleG, 0, HIPY, 0);
  const J = { root, scaleG, hips, hipY: HIPY };
  const spine = grp(hips, 0, 0.04, 0); J.spine = spine;
  const A = look.outfitA, B = look.outfitB, o = look.outfit;
  const top = { classico: A, colete: B, regata: A, casaco: B }[o] || A;
  const sleeves = o !== 'regata', shorts = o === 'regata';
  const wM = 1 + 0.22 * M, wF = 1 + 0.3 * F;

  // tronco: uma peça lisa (camisa/jaqueta) + quadril (calça)
  const torsoCtrl = [[0.0, -0.06], [0.155 * wF, -0.05], [0.162 * wF, 0.0], [0.165 * wF, 0.08], [0.168 * (0.5 * wF + 0.5 * wM), 0.17], [0.176 * wM, 0.26], [0.172 * wM, 0.32], [0.14 * wM, 0.385], [0.075, 0.425], [0.0, 0.435]];
  part(lathe(torsoCtrl, 1, 0.74), top, spine);
  part(lathe([[0.0, -0.13], [0.09, -0.125], [0.135 * wF, -0.09], [0.152 * wF, -0.03], [0.155 * wF, 0.04], [0.14 * wF, 0.09], [0.0, 0.1]], 1, 0.78), B, hips);
  if (o === 'classico') {
    part(lathe([[0.0, 0.26], [0.18 * wM, 0.262], [0.176 * wM, 0.32], [0.145 * wM, 0.385], [0.08, 0.428], [0.0, 0.44]], 1.02, 0.76), B, spine); // ombros em outra cor
    part(new THREE.CylinderGeometry(0.068, 0.085, 0.07, 32, 1, true), vinyl(A, true), spine, [0, 0.445, 0]); // gola alta
    part(lathe([[0.0, -0.035], [0.166 * wF, -0.035], [0.168 * wF, 0.01], [0.0, 0.012]], 1, 0.76), look.accent, spine); // faixa da cintura
  } else if (o === 'colete') {
    part(lathe([[0.0, -0.02], [0.17 * wF, -0.02], [0.174 * wF, 0.08], [0.182 * wM, 0.2], [0.188 * wM, 0.28], [0.15 * wM, 0.37], [0.09, 0.42], [0.0, 0.43]], 1, 0.82), A, spine); // colete
    part(new THREE.TorusGeometry(0.085, 0.022, 12, 32), A, spine, [0, 0.42, 0], [Math.PI / 2, 0, 0]);
    for (const s of [-1, 1]) part(ell(0.045, 0.04, 0.02, 24), A, spine, [s * 0.075, 0.12, 0.13 * wF]); // bolsos
  } else if (o === 'casaco') {
    const coat = grp(spine, 0, 0.36, 0); J.coat = coat;
    part(lathe([[0.27, -0.92], [0.24, -0.6], [0.205 * wF, -0.36], [0.19 * wM, -0.12], [0.19 * wM, -0.02], [0.15, 0.04], [0.09, 0.08]], 1, 0.8, 40, 0.35, Math.PI * 2 - 0.7), vinyl(A, true), coat);
    part(new THREE.TorusGeometry(0.09, 0.022, 12, 32), A, spine, [0, 0.43, 0], [Math.PI / 2, 0, 0]);
  } else if (o === 'regata') {
    part(lathe([[0.0, -0.035], [0.166 * wF, -0.035], [0.168 * wF, 0.01], [0.0, 0.012]], 1, 0.76), look.accent, spine);
  }
  // emblema nas costas
  const em = new THREE.Mesh(new THREE.CircleGeometry(0.055, 32), new THREE.MeshBasicMaterial({ map: emblemTexture(clan), transparent: true }));
  const backZ = (o === 'colete' ? 0.188 * wM * 0.82 : o === 'casaco' ? 0.19 * wM * 0.8 : 0.176 * wM * 0.74) + 0.004;
  em.position.set(0, o === 'casaco' ? 0.27 : 0.25, -backZ); em.rotation.y = Math.PI; spine.add(em);

  // pescoço e cabeça
  part(new THREE.CylinderGeometry(0.048, 0.055, 0.12, 24), sk, spine, [0, 0.46, 0]);
  const head = grp(spine, 0, 0.76, 0); head.scale.setScalar(HEADS); J.head = head;
  part(ell(0.124, 0.127, 0.123, 48), sk, head); // cabeça mais redonda (largura ≈ altura)
  for (const s of [-1, 1]) part(ell(0.016, 0.026, 0.014, 16), sk, head, [s * 0.122, -0.01, -0.005]); // orelhas
  const faceGeo = new THREE.SphereGeometry(1, 40, 20, Math.PI / 2 - 0.95, 1.9, Math.PI * 0.30, Math.PI * 0.40).scale(0.125, 0.1295, 0.1245);
  head.add(new THREE.Mesh(faceGeo, new THREE.MeshBasicMaterial({ map: faceTexture(look, clan), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })));
  const hasBand = look.band === 'sim' || look.band === true;
  J.locks = buildHair(head, look, rng, hasBand);
  if (hasBand) { // testeira (opcional): faixa justa na calota + placa inclinada
    part(new THREE.TorusGeometry(0.107, 0.011, 12, 48).scale(1, 1.08, 1), look.accent, head, [0, 0.095, -0.004], [Math.PI / 2, 0, 0]);
    const plate = part(new THREE.BoxGeometry(0.075, 0.03, 0.008), 0xc3cbd6, head, [0, 0.095, 0.12], [-0.5, 0, 0]);
    part(new THREE.TorusGeometry(0.009, 0.0025, 8, 16, 5.2), 0x39404c, plate, [0, 0, 0.005]);
  }
  if (clan === 'hyuga') { J.veins = grp(head); for (const s of [-1, 1]) for (let k = 0; k < 4; k++) part(new THREE.BoxGeometry(0.005, 0.018, 0.003), new THREE.MeshBasicMaterial({ color: 0x8a7fd0 }), J.veins, [s * (0.07 + k * 0.011), 0.0 + (k % 2) * 0.01, 0.09 - k * 0.012], [0, s * 0.6, s * 0.4]); J.veins.visible = false; }

  // braços: peças únicas e afiladas; mãos em luva arredondada
  const arm = (s) => {
    const sh = grp(spine, s * (0.21 + 0.04 * M), 0.31, 0);
    const r0 = 0.064 + 0.018 * M + 0.008 * F, r1 = 0.054 + 0.014 * M;
    part(limb(r0 + (sleeves ? 0.008 : 0), r1 + (sleeves ? 0.008 : 0), 0.19), sleeves ? top : sk, sh);
    const el = grp(sh, 0, -0.19, 0);
    part(limb(r1 + (sleeves ? 0.008 : 0), 0.048 + 0.01 * M + (sleeves ? 0.008 : 0), 0.15), sleeves ? top : sk, el);
    const hand = grp(el, 0, -0.2, 0.0);
    part(ell(0.054, 0.06, 0.044, 24), sk, hand);
    part(ell(0.017, 0.026, 0.017, 16), sk, hand, [-s * 0.034, 0.008, 0.016], [0, 0, -s * 0.4]);
    return { sh, el };
  };
  const aL = arm(1), aR = arm(-1);
  J.shL = aL.sh; J.elL = aL.el; J.shR = aR.sh; J.elR = aR.el;

  // pernas: coxa e canela afiladas, sapato arredondado
  const leg = (s) => {
    const hp = grp(hips, s * 0.082, -0.02, 0);
    const r0 = 0.074 + 0.018 * M + 0.02 * F, r1 = 0.06 + 0.01 * M + 0.008 * F;
    part(limb(r0, r1, 0.25), B, hp);
    const kn = grp(hp, 0, -0.25, 0);
    part(limb(r1 - (shorts ? 0.008 : 0), 0.05 + 0.006 * M, 0.25), shorts ? sk : B, kn);
    if (shorts) part(limb(r1 + 0.004, r1 + 0.004, 0.04), B, kn, [0, 0.02, 0]);
    part(ell(0.06, 0.05, 0.105, 32), 0x2c3040, kn, [0, -0.275, 0.03]);
    part(lathe([[0.0, -0.01], [0.058, -0.01], [0.06, 0.006], [0.0, 0.008]], 1, 1.75), 0xe9e6dc, kn, [0, -0.3, 0.03]); // sola
    return { hp, kn };
  };
  const lL = leg(1), lR = leg(-1);
  J.hipL = lL.hp; J.kneeL = lL.kn; J.hipR = lR.hp; J.kneeR = lR.kn;

  // caudas de chakra (Uzumaki)
  J.tails = null;
  if (clan === 'uzumaki' && tails > 0) {
    J.tails = grp(spine, 0, 0.0, -0.12); J.tails.visible = false;
    const tm = new THREE.MeshBasicMaterial({ color: 0xff9a2e, transparent: true, opacity: 0.55 });
    for (let i = 0; i < tails; i++) { const a = (i - (tails - 1) / 2) * 0.3; const pts = []; for (let k = 0; k < 9; k++) { const s = k / 8; pts.push(new THREE.Vector3(Math.sin(a) * s * 0.7, 0.2 * Math.sin(s * 3) + s * 0.3, -s * 0.8)); }
      const t = new THREE.Mesh(taperedTube(pts, 0.05, 0.008, 10), tm); t.userData.phase = i; J.tails.add(t); }
  }

  J.anim = { t: 0, lag: new THREE.Vector3(), flip: 0 };
  return J;
}

function emblemTexture(clan) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.translate(64, 64);
  if (clan === 'uchiha') { g.fillStyle = '#c8281e'; g.beginPath(); g.arc(0, 0, 58, 0, 7); g.fill(); g.fillStyle = '#f4f0e6'; g.beginPath(); g.moveTo(-20, 58); g.lineTo(0, 12); g.lineTo(20, 58); g.fill(); g.strokeStyle = '#2a1010'; g.lineWidth = 6; g.beginPath(); g.arc(0, 0, 58, 0, 7); g.stroke(); }
  else if (clan === 'uzumaki') { g.strokeStyle = '#d9382a'; g.lineWidth = 12; g.beginPath(); for (let a = 0; a < 12; a += 0.15) { const r = 4 + a * 4.4; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.stroke(); }
  else { g.fillStyle = '#e8e4f6'; g.beginPath(); g.arc(0, 0, 58, 0, 7); g.fill(); g.strokeStyle = '#6a60b8'; g.lineWidth = 8; g.beginPath(); g.arc(0, 0, 40, 0, 7); g.stroke(); g.beginPath(); g.moveTo(0, -40); g.lineTo(0, 40); g.moveTo(-40, 0); g.lineTo(40, 0); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------- animação procedural ----------
// st: { speed, grounded, vy, act, actT (0..1), dashX, dashZ, dead, hurt, localVel:[x,z], time, byakugan, cloak }
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);
export function animateNinja(J, dt, st) {
  const a = J.anim; a.t += dt;
  const run = Math.min(1, st.speed / 9);
  const ph = a.t * (6 + run * 8);
  const idle = Math.sin(a.t * 1.8) * 0.02;
  const P = { shLx: 0, shRx: 0, shLz: 0.06, shRz: -0.06, elL: -0.12, elR: -0.12, hipL: 0, hipR: 0, knL: 0.05, knR: 0.05, lean: 0, bodyY: 0, twist: 0, flip: 0, headX: 0 };
  if (st.grounded) {
    const sw = Math.sin(ph) * run * 1.0, sw2 = Math.sin(ph + Math.PI) * run * 1.0;
    P.hipL = -sw * 0.9; P.hipR = -sw2 * 0.9; P.knL = 0.05 + Math.max(0, sw) * 1.1 * run; P.knR = 0.05 + Math.max(0, sw2) * 1.1 * run;
    P.shLx = sw * 0.9; P.shRx = sw2 * 0.9; P.elL = -0.3 - run * 0.9; P.elR = -0.3 - run * 0.9;
    P.lean = run * 0.28; P.bodyY = -Math.abs(Math.cos(ph)) * 0.05 * run + idle * (1 - run);
  } else {
    P.hipL = -0.5; P.hipR = 0.3; P.knL = 0.9; P.knR = 0.5; P.shLx = -0.5; P.shRx = -0.5; P.shLz = 0.6; P.shRz = -0.6; P.lean = 0.1;
    if (st.vy > 0) { P.hipL = -0.9; P.knL = 1.2; }
  }
  const t = st.actT || 0, e = ease(Math.min(1, t));
  switch (st.act) {
    case 'punch1': case 'punch2': { // soco direito / esquerdo, alternados, com torção do tronco
      const right = st.act === 'punch1', wind = Math.min(1, t / 0.35), thrust = t < 0.35 ? 0 : ease((t - 0.35) / 0.3), back = t > 0.7 ? (t - 0.7) / 0.3 : 0;
      const ext = (thrust * (1 - back)), wd = wind * (1 - thrust);
      const sx = -1.45 * ext + 0.7 * wd, elb = -2.0 * wd - 0.1 * ext - 0.6 * (1 - ext - wd);
      if (right) { P.shRx = sx; P.elR = elb; P.shLx = -0.5; P.elL = -1.6; P.twist = -0.6 * ext + 0.25 * wd; }
      else { P.shLx = sx; P.elL = elb; P.shRx = -0.5; P.elR = -1.6; P.twist = 0.6 * ext - 0.25 * wd; }
      P.lean = 0.15 + 0.15 * ext; P.hipL = -0.35; P.hipR = 0.35; P.knL = 0.35; P.knR = 0.25; break; }
    case 'kick': { // chute alto com a perna direita, braços para equilíbrio
      const up = t < 0.4 ? ease(t / 0.4) : t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
      const ext = t < 0.4 ? 0 : t < 0.7 ? ease((t - 0.4) / 0.3) : 1 - (t - 0.7) / 0.3;
      P.hipR = -1.7 * up; P.knR = 1.9 * up - 1.7 * ext; P.hipL = 0.15; P.knL = 0.2;
      P.shLx = -0.4; P.shRx = 0.6; P.shLz = 1.0; P.shRz = -1.0; P.elL = -0.6; P.elR = -0.6; P.lean = -0.25 * up; P.twist = 0.4 * up; break; }
    case 'cast': { // selos de mão e lançamento
      const sealing = t < 0.55, thr = t >= 0.55 ? ease((t - 0.55) / 0.2) : 0;
      P.shLx = sealing ? -1.1 : -1.5; P.shRx = sealing ? -1.1 : -1.5; P.elL = sealing ? -2.2 : -0.2 * thr; P.elR = sealing ? -2.2 : -0.2 * thr;
      P.shLz = sealing ? -0.5 : 0.15; P.shRz = sealing ? 0.5 : -0.15; P.lean = sealing ? -0.05 : 0.2 * thr; P.hipL = -0.3; P.hipR = 0.3; P.knL = 0.3; P.knR = 0.2; P.headX = sealing ? 0.1 : 0; break; }
    case 'dash': { P.lean = 0.5; P.shLx = 0.7; P.shRx = 0.7; P.elL = -0.3; P.elR = -0.3; P.hipL = -0.9; P.hipR = 0.5; P.knL = 0.9; P.knR = 0.4; break; }
    case 'fear': { P.shLx = -1.2; P.shRx = -1.2; P.shLz = 0.9; P.shRz = -0.9; P.elL = -0.4; P.elR = -0.4; break; }
    case 'djump': P.flip = ease(Math.min(1, t)) * Math.PI * 2; P.hipL = -1.2; P.hipR = -1.2; P.knL = 1.8; P.knR = 1.8; P.shLx = -1.0; P.shRx = -1.0; P.elL = -1.8; P.elR = -1.8; break;
  }
  if (st.hurt > 0) { P.lean = -0.3; P.shLx = 0.8; P.shRx = 0.8; }
  // aplica com suavização
  const k = Math.min(1, dt * (st.act ? 28 : 14));
  const set = (o, key, v) => { o.rotation[key] = lerp(o.rotation[key], v, k); };
  set(J.shL, 'x', P.shLx); set(J.shR, 'x', P.shRx); set(J.shL, 'z', P.shLz); set(J.shR, 'z', P.shRz);
  set(J.elL, 'x', P.elL); set(J.elR, 'x', P.elR);
  set(J.hipL, 'x', P.hipL); set(J.hipR, 'x', P.hipR); set(J.kneeL, 'x', P.knL); set(J.kneeR, 'x', P.knR);
  set(J.spine, 'x', P.lean); set(J.spine, 'y', P.twist); set(J.head, 'x', P.headX - P.lean * 0.6);
  J.hips.position.y = lerp(J.hips.position.y, J.hipY + P.bodyY, k);
  J.hips.rotation.x = st.act === 'djump' ? P.flip : lerp(J.hips.rotation.x, 0, Math.min(1, dt * 20));
  if (st.act === 'dash' && (st.dashX || st.dashZ)) { J.hips.rotation.z = lerp(J.hips.rotation.z, -st.dashX * 0.35, k); } else J.hips.rotation.z = lerp(J.hips.rotation.z, 0, k);
  if (st.dead) { J.root.rotation.x = lerp(J.root.rotation.x, -Math.PI / 2, Math.min(1, dt * 6)); J.root.position.y = 0.12; } else { J.root.rotation.x = lerp(J.root.rotation.x, 0, Math.min(1, dt * 10)); }
  // cabelo: inércia + vento
  const lv = st.localVel || [0, 0];
  a.lag.x = lerp(a.lag.x, lv[0], Math.min(1, dt * 5)); a.lag.z = lerp(a.lag.z, lv[1], Math.min(1, dt * 5));
  for (const L of J.locks) {
    const w = Math.sin(a.t * 2.3 + L.phase) * 0.06 * L.sway, w2 = Math.cos(a.t * 1.7 + L.phase * 1.3) * 0.05 * L.sway;
    const vy = st.vy || 0;
    const k2 = 0.05 * L.sway * (1 + L.len * 2) * L.up;
    L.pivot.rotation.x = a.lag.z * k2 + w - vy * 0.012 * L.sway * L.up;
    L.pivot.rotation.z = -a.lag.x * k2 + w2;
  }
  if (J.coat) J.coat.rotation.x = lerp(J.coat.rotation.x, run * 0.35, k);
  if (J.tails) { J.tails.visible = !!st.cloak; J.tails.children.forEach((c, i) => { c.rotation.y = Math.sin(a.t * 2 + i) * 0.25; c.rotation.x = Math.sin(a.t * 1.6 + i * 0.7) * 0.12; }); }
  if (J.veins) J.veins.visible = !!st.byakugan;
}
