// Mini "three.js" só para PRÉ-VISUALIZAR personagens offline (sem internet) no Chromium headless.
// Implementa o subconjunto usado por public/ninja.js com geometria real e um renderizador WebGL simples.
export const RepeatWrapping = 1000, RedFormat = 1, NearestFilter = 1, LinearFilter = 2, BackSide = 1, DoubleSide = 2, FrontSide = 0, SRGBColorSpace = 'srgb';
export class Vector2 { constructor(x = 0, y = 0) { this.x = x; this.y = y; } }
export class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  setScalar(s) { return this.set(s, s, s); }
  copy(v) { return this.set(v.x, v.y, v.z); } clone() { return new Vector3(this.x, this.y, this.z); }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
  subVectors(a, b) { return this.set(a.x - b.x, a.y - b.y, a.z - b.z); }
  addVectors(a, b) { return this.set(a.x + b.x, a.y + b.y, a.z + b.z); }
  addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
  multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
  dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
  length() { return Math.hypot(this.x, this.y, this.z); } lengthSq() { return this.dot(this); }
  normalize() { const l = this.length() || 1; return this.multiplyScalar(1 / l); }
  crossVectors(a, b) { return this.set(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x); }
  cross(v) { return this.crossVectors(this.clone(), v); }
  lerp(v, t) { this.x += (v.x - this.x) * t; this.y += (v.y - this.y) * t; this.z += (v.z - this.z) * t; return this; }
  distanceTo(v) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); }
  applyAxisAngle(ax, a) { const c = Math.cos(a), s = Math.sin(a), k = ax, d = this.dot(k), cr = new Vector3().crossVectors(k, this);
    return this.set(this.x * c + cr.x * s + k.x * d * (1 - c), this.y * c + cr.y * s + k.y * d * (1 - c), this.z * c + cr.z * s + k.z * d * (1 - c)); }
}
export class Color {
  constructor(c = 0xffffff) { this.set(c); }
  set(c) { if (c instanceof Color) { this.r = c.r; this.g = c.g; this.b = c.b; return this; }
    if (typeof c === 'string') c = parseInt(c.replace('#', ''), 16);
    this.r = ((c >> 16) & 255) / 255; this.g = ((c >> 8) & 255) / 255; this.b = (c & 255) / 255; return this; }
  lerp(o, t) { this.r += (o.r - this.r) * t; this.g += (o.g - this.g) * t; this.b += (o.b - this.b) * t; return this; }
  multiplyScalar(s) { this.r *= s; this.g *= s; this.b *= s; return this; }
  clone() { const c = new Color(); c.r = this.r; c.g = this.g; c.b = this.b; return c; }
  getHex() { return (Math.round(this.r * 255) << 16) | (Math.round(this.g * 255) << 8) | Math.round(this.b * 255); }
  getHexString() { return this.getHex().toString(16).padStart(6, '0'); }
}
class Euler { constructor() { this.x = 0; this.y = 0; this.z = 0; } set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } }
// matrizes 4x4 coluna-maior
const mmul = (a, b) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; };
function compose(p, e, s) {
  const a = Math.cos(e.x), b = Math.sin(e.x), c = Math.cos(e.y), d = Math.sin(e.y), ee = Math.cos(e.z), f = Math.sin(e.z);
  // ordem XYZ (igual three.js)
  const ae = a * ee, af = a * f, be = b * ee, bf = b * f;
  const m = [c * ee, af + be * d, bf - ae * d, 0, -c * f, ae - bf * d, be + af * d, 0, d, -b * c, a * c, 0, 0, 0, 0, 1];
  for (let i = 0; i < 3; i++) { m[i] *= s.x; m[4 + i] *= s.y; m[8 + i] *= s.z; }
  m[12] = p.x; m[13] = p.y; m[14] = p.z; return new Float32Array(m);
}
export class Object3D {
  constructor() { this.position = new Vector3(); this.rotation = new Euler(); this.scale = new Vector3(1, 1, 1); this.children = []; this.parent = null; this.visible = true; this.userData = {}; this.matrix = new Float32Array(16); }
  add(...o) { for (const c of o) { if (c.parent) c.parent.remove(c); c.parent = this; this.children.push(c); } return this; }
  remove(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parent = null; return this; }
  traverse(f) { f(this); for (const c of this.children) c.traverse(f); }
  updateMatrix() { this.matrix = compose(this.position, this.rotation, this.scale); }
  lookAt() {}
}
export class Group extends Object3D {}
export class Mesh extends Object3D { constructor(g, m) { super(); this.geometry = g; this.material = m; this.isMesh = true; } }
export class InstancedMesh extends Mesh { constructor(g, m, n) { super(g, m); this.count = n; } setMatrixAt() {} }
class Mat { constructor(o = {}) { this.isMaterial = true; this.visible = true; this.color = new Color(0xffffff); this.side = 0; this.opacity = 1; this.transparent = false; this.depthWrite = true;
  for (const [k, v] of Object.entries(o)) { if (k === 'color') this.color = v instanceof Color ? v : new Color(v); else this[k] = v; } } clone() { return Object.assign(Object.create(Object.getPrototypeOf(this)), this); } }
export class MeshToonMaterial extends Mat {} export class MeshBasicMaterial extends Mat { constructor(o) { super(o); this.unlit = true; } }
export class MeshStandardMaterial extends Mat {} export class MeshPhongMaterial extends Mat {} export class MeshLambertMaterial extends Mat {}
export class ShaderMaterial extends Mat { constructor(o) { super(o); this.isShader = true; } }
export class DataTexture { constructor(d) { this.data = d; } } export class CanvasTexture { constructor(c) { this.image = c; } }
export class Float32BufferAttribute { constructor(a, n) { this.array = Float32Array.from(a); this.itemSize = n; this.count = this.array.length / n; } }
export class BufferGeometry {
  constructor() { this.attributes = {}; this.index = null; }
  setAttribute(n, a) { this.attributes[n] = a; return this; }
  setIndex(i) { this.index = Array.isArray(i) ? i : Array.from(i); return this; }
  getAttribute(n) { return this.attributes[n]; }
  scale(x, y, z) { const p = this.attributes.position.array; for (let i = 0; i < p.length; i += 3) { p[i] *= x; p[i + 1] *= y; p[i + 2] *= z; } if (this.attributes.normal) this.computeVertexNormals(); return this; }
  translate(x, y, z) { const p = this.attributes.position.array; for (let i = 0; i < p.length; i += 3) { p[i] += x; p[i + 1] += y; p[i + 2] += z; } return this; }
  rotateX(a) { return this._rot((y, z) => [y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)], 1, 2); }
  rotateY(a) { return this._rot((z, x) => [z * Math.cos(a) - x * Math.sin(a), z * Math.sin(a) + x * Math.cos(a)], 2, 0); }
  rotateZ(a) { return this._rot((x, y) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)], 0, 1); }
  _rot(f, i0, i1) { const p = this.attributes.position.array; for (let i = 0; i < p.length; i += 3) { const [a, b] = f(p[i + i0], p[i + i1]); p[i + i0] = a; p[i + i1] = b; } this.computeVertexNormals(); return this; }
  computeVertexNormals() {
    const p = this.attributes.position.array, n = new Float32Array(p.length), idx = this.index || [...Array(p.length / 3).keys()];
    // agrupa vértices na mesma posição (costuras de UV) para normais lisas
    const key = (i) => `${p[i * 3].toFixed(5)},${p[i * 3 + 1].toFixed(5)},${p[i * 3 + 2].toFixed(5)}`, groups = new Map(), gid = [];
    for (let i = 0; i < p.length / 3; i++) { const k = key(i); if (!groups.has(k)) groups.set(k, groups.size); gid[i] = groups.get(k); }
    const acc = new Float32Array(groups.size * 3);
    for (let t = 0; t < idx.length; t += 3) { const a = idx[t], b = idx[t + 1], c = idx[t + 2];
      const ux = p[b * 3] - p[a * 3], uy = p[b * 3 + 1] - p[a * 3 + 1], uz = p[b * 3 + 2] - p[a * 3 + 2], vx = p[c * 3] - p[a * 3], vy = p[c * 3 + 1] - p[a * 3 + 1], vz = p[c * 3 + 2] - p[a * 3 + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const v of [a, b, c]) { const g = gid[v]; acc[g * 3] += nx; acc[g * 3 + 1] += ny; acc[g * 3 + 2] += nz; } }
    for (let i = 0; i < p.length / 3; i++) { const g = gid[i]; const x = acc[g * 3], y = acc[g * 3 + 1], z = acc[g * 3 + 2], l = Math.hypot(x, y, z) || 1; n[i * 3] = x / l; n[i * 3 + 1] = y / l; n[i * 3 + 2] = z / l; }
    this.attributes.normal = new Float32BufferAttribute(n, 3); return this;
  }
  clone() { const g = new BufferGeometry(); for (const [k, a] of Object.entries(this.attributes)) g.attributes[k] = new Float32BufferAttribute(a.array, a.itemSize); g.index = this.index && [...this.index]; return g; }
}
function grid(build, w, h) { const pos = [], uv = [], idx = []; for (let i = 0; i <= h; i++) for (let j = 0; j <= w; j++) { const [p, t] = build(j / w, i / h); pos.push(...p); uv.push(...t); }
  for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) { const a = i * (w + 1) + j, b = a + w + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g; }
export class SphereGeometry extends BufferGeometry { constructor(r = 1, ws = 32, hs = 16, ps = 0, pl = Math.PI * 2, ts = 0, tl = Math.PI) { super();
  Object.assign(this, grid((u, v) => { const ph = ps + u * pl, th = ts + v * tl; return [[-r * Math.cos(ph) * Math.sin(th), r * Math.cos(th), r * Math.sin(ph) * Math.sin(th)], [u, 1 - v]]; }, ws, hs)); } }
export class CylinderGeometry extends BufferGeometry { constructor(rt = 1, rb = 1, h = 1, rs = 32, hs = 1, open = false) { super();
  const side = grid((u, v) => { const r = rt + (rb - rt) * v, th = u * Math.PI * 2; return [[r * Math.sin(th), h / 2 - v * h, r * Math.cos(th)], [u, 1 - v]]; }, rs, Math.max(1, hs));
  if (!open) { const p = [...side.attributes.position.array], uv = [...side.attributes.uv.array], idx = [...side.index];
    for (const [y, r, flip] of [[h / 2, rt, false], [-h / 2, rb, true]]) { if (r <= 0) continue; const c = p.length / 3; p.push(0, y, 0); uv.push(0.5, 0.5);
      for (let j = 0; j <= rs; j++) { const th = j / rs * Math.PI * 2; p.push(r * Math.sin(th), y, r * Math.cos(th)); uv.push(0, 0); }
      for (let j = 0; j < rs; j++) flip ? idx.push(c, c + 2 + j, c + 1 + j) : idx.push(c, c + 1 + j, c + 2 + j); }
    side.setAttribute('position', new Float32BufferAttribute(p, 3)); side.setAttribute('uv', new Float32BufferAttribute(uv, 2)); side.setIndex(idx); side.computeVertexNormals(); }
  Object.assign(this, side); } }
export class CapsuleGeometry extends BufferGeometry { constructor(r = 1, len = 1, cs = 4, rs = 8) { super();
  const prof = []; for (let i = 0; i <= cs; i++) { const a = -Math.PI / 2 + (i / cs) * Math.PI / 2; prof.push([Math.cos(a) * r, -len / 2 + Math.sin(a) * r]); }
  for (let i = 0; i <= cs; i++) { const a = (i / cs) * Math.PI / 2; prof.push([Math.cos(a) * r, len / 2 + Math.sin(a) * r]); }
  Object.assign(this, new LatheGeometry(prof.map(([x, y]) => new Vector2(x, y)), rs)); } }
export class LatheGeometry extends BufferGeometry { constructor(pts, seg = 12, ps = 0, pl = Math.PI * 2) { super();
  Object.assign(this, grid((u, v) => { const k = Math.round(v * (pts.length - 1)), p = pts[k], ph = ps + u * pl; return [[p.x * Math.sin(ph), p.y, p.x * Math.cos(ph)], [u, v]]; }, seg, pts.length - 1)); } }
export class TorusGeometry extends BufferGeometry { constructor(R = 1, r = 0.4, rs = 12, ts = 48, arc = Math.PI * 2) { super();
  Object.assign(this, grid((u, v) => { const a = u * arc, b = v * Math.PI * 2; return [[(R + r * Math.cos(b)) * Math.cos(a), (R + r * Math.cos(b)) * Math.sin(a), r * Math.sin(b)], [u, v]]; }, ts, rs)); } }
export class CircleGeometry extends BufferGeometry { constructor(r = 1, s = 32) { super(); const p = [0, 0, 0], uv = [0.5, 0.5], idx = [];
  for (let j = 0; j <= s; j++) { const a = j / s * Math.PI * 2; p.push(r * Math.cos(a), r * Math.sin(a), 0); uv.push(0.5 + Math.cos(a) / 2, 0.5 + Math.sin(a) / 2); }
  for (let j = 1; j <= s; j++) idx.push(0, j, j + 1); this.setAttribute('position', new Float32BufferAttribute(p, 3)); this.setAttribute('uv', new Float32BufferAttribute(uv, 2)); this.setIndex(idx); this.computeVertexNormals(); } }
export class BoxGeometry extends BufferGeometry { constructor(w = 1, h = 1, d = 1) { super(); const p = [], idx = [], uv = [];
  const F = [[[1, 0, 0], [0, 0, -1], [0, 1, 0]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [[0, 1, 0], [1, 0, 0], [0, 0, -1]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]]];
  for (const [n, u, v] of F) { const c = p.length / 3; for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { p.push((n[0] + u[0] * a + v[0] * b) * w / 2, (n[1] + u[1] * a + v[1] * b) * h / 2, (n[2] + u[2] * a + v[2] * b) * d / 2); uv.push((a + 1) / 2, (b + 1) / 2); } idx.push(c, c + 1, c + 2, c, c + 2, c + 3); }
  this.setAttribute('position', new Float32BufferAttribute(p, 3)); this.setAttribute('uv', new Float32BufferAttribute(uv, 2)); this.setIndex(idx);
  const nn = []; for (const [n] of F) for (let k = 0; k < 4; k++) nn.push(...n); this.setAttribute('normal', new Float32BufferAttribute(nn, 3)); } }
export class ConeGeometry extends CylinderGeometry { constructor(r, h, s) { super(0, r, h, s); } }

// ---------- renderizador ----------
export function render(canvas, scene, { eye = [0, 1.2, 3.2], target = [0, 1.0, 0], fov = 30, bg = [0.95, 0.75, 0.45] } = {}) {
  const gl = canvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: true });
  const vs = `attribute vec3 p; attribute vec3 n; attribute vec2 t; uniform mat4 M, VP; varying vec3 vn; varying vec2 vt; varying vec3 wp;
    void main(){ vec4 w = M*vec4(p,1.0); wp = w.xyz; vn = normalize(mat3(M)*n); vt = t; gl_Position = VP*w; }`;
  const fs = `precision mediump float; varying vec3 vn; varying vec2 vt; varying vec3 wp; uniform vec3 col; uniform float op, unlit, hasMap, flip; uniform sampler2D map; uniform vec3 eye;
    void main(){ vec3 V = normalize(eye-wp); vec3 N = normalize(vn); if (dot(N,V) < 0.0) N = -N; vec3 L = normalize(vec3(2.0,4.0,3.0));
      vec3 base = col; float a = op; if(hasMap>0.5){ vec4 tx = texture2D(map, vt); base *= tx.rgb; a *= tx.a; }
      float d = max(dot(N,L),0.0); float hemi = 0.5+0.5*N.y; vec3 H = normalize(L+V); float sp = pow(max(dot(N,H),0.0), 40.0)*0.25;
      float rim = pow(1.0-max(dot(N,V),0.0), 3.0)*0.15;
      vec3 c = unlit>0.5 ? base : base*(0.42+0.30*hemi+0.55*d) + vec3(sp+rim);
      if (a < 0.02) discard; gl_FragColor = vec4(c, a); }`;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr); gl.useProgram(pr);
  const U = (n) => gl.getUniformLocation(pr, n), A = (n) => gl.getAttribLocation(pr, n);
  // câmera
  const f = 1 / Math.tan(fov * Math.PI / 360), asp = canvas.width / canvas.height, nr = 0.05, fr = 50;
  const P = new Float32Array([f / asp, 0, 0, 0, 0, f, 0, 0, 0, 0, (fr + nr) / (nr - fr), -1, 0, 0, 2 * fr * nr / (nr - fr), 0]);
  const z = new Vector3(...eye).sub(new Vector3(...target)).normalize(), x = new Vector3().crossVectors(new Vector3(0, 1, 0), z).normalize(), y = new Vector3().crossVectors(z, x);
  const e = new Vector3(...eye);
  const Vw = new Float32Array([x.x, y.x, z.x, 0, x.y, y.y, z.y, 0, x.z, y.z, z.z, 0, -x.dot(e), -y.dot(e), -z.dot(e), 1]);
  gl.uniformMatrix4fv(U('VP'), false, mmul(P, Vw)); gl.uniform3fv(U('eye'), eye);
  gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(...bg, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  const items = [];
  const walk = (o, pm) => { if (!o.visible) return; o.updateMatrix(); const m = mmul(pm, o.matrix);
    if (o.isMesh && o.material && !o.material.isShader && o.material.visible !== false) items.push([o, m]); for (const c of o.children) walk(c, m); };
  walk(scene, new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]));
  items.sort((a, b) => (a[0].material.transparent ? 1 : 0) - (b[0].material.transparent ? 1 : 0));
  const texCache = new Map();
  for (const [o, m] of items) {
    const g = o.geometry, mat = o.material; if (!g.attributes.normal) g.computeVertexNormals();
    const idx = g.index || [...Array(g.attributes.position.count).keys()], P3 = g.attributes.position.array, N3 = g.attributes.normal.array, T2 = g.attributes.uv ? g.attributes.uv.array : null;
    const pa = new Float32Array(idx.length * 3), na = new Float32Array(idx.length * 3), ta = new Float32Array(idx.length * 2);
    idx.forEach((v, i) => { pa.set(P3.subarray(v * 3, v * 3 + 3), i * 3); na.set(N3.subarray(v * 3, v * 3 + 3), i * 3); if (T2) ta.set(T2.subarray(v * 2, v * 2 + 2), i * 2); });
    const buf = (arr, name, n) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW); const l = A(name); if (l < 0) return; gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, 0, 0); };
    buf(pa, 'p', 3); buf(na, 'n', 3); buf(ta, 't', 2);
    gl.uniformMatrix4fv(U('M'), false, m); gl.uniform3f(U('col'), mat.color.r, mat.color.g, mat.color.b); gl.uniform1f(U('op'), mat.opacity ?? 1); gl.uniform1f(U('unlit'), mat.unlit ? 1 : 0);
    if (mat.map && mat.map.image) { let tx = texCache.get(mat.map); if (!tx) { tx = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tx); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mat.map.image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); const wr = mat.map.wrapS === RepeatWrapping ? gl.REPEAT : gl.CLAMP_TO_EDGE; gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wr); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wr); texCache.set(mat.map, tx); }
      gl.bindTexture(gl.TEXTURE_2D, tx); gl.uniform1f(U('hasMap'), 1); } else gl.uniform1f(U('hasMap'), 0);
    gl.depthMask(mat.depthWrite !== false);
    if (mat.polygonOffset) { gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(mat.polygonOffsetFactor || -1, -4); } else gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.disable(gl.CULL_FACE); gl.uniform1f(U('flip'), 1); gl.drawArrays(gl.TRIANGLES, 0, idx.length);
  }
}
