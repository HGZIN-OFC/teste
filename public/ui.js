// Menus: escolher/criar mundo → escolher/criar personagem → entrar.
import * as THREE from 'three';
import { CLANS, ELEMENTS, RANKS, levelFromXp } from './shared.js';
import { HAIR_STYLES, OUTFITS, EYE_STYLES, PUPIL_STYLES, BAND_OPTS, defaultLook, buildNinja, animateNinja } from './ninja.js';
import { loadChars, saveChar, deleteChar, loadWorlds, saveWorld, deleteWorld, genCode, newCharacter, sticker } from './store.js';

const $screens = () => document.getElementById('screens');
const h = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; };
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let enterFn = null, activePreview = null;
export function initUI({ enter }) { enterFn = enter; }
export function hideScreens() { killPreview(); $screens().innerHTML = ''; }
function killPreview() { if (activePreview) { activePreview.dispose(); activePreview = null; } }
function mount(el) { killPreview(); const s = $screens(); s.innerHTML = ''; s.appendChild(el); }

// ---------- preview 3D ----------
function disposeNinja(J) {
  J.root.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map && o.material.isMeshBasicMaterial) { o.material.map.dispose(); o.material.dispose(); } });
}
// vistas do preview (câmera em metros; o personagem fica de frente para a câmera com rot = 0)
const VIEWS = {
  corpo: { eye: [0, 1.2, 4.9], at: [0, 0.98, 0] },
  rosto: { eye: [0, 1.8, 1.55], at: [0, 1.74, 0] },
  costas: { eye: [0, 1.2, -4.9], at: [0, 0.98, 0] },
};
function createPreview(box, { interactive = false } = {}) {
  const canvas = document.createElement('canvas'); box.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  scene.add(new THREE.HemisphereLight(0xfff6e8, 0x9a7a55, 1.25));
  const key = new THREE.DirectionalLight(0xffffff, 2.0); key.position.set(2, 4, 3); scene.add(key);
  const rim = new THREE.DirectionalLight(0xa9c8ff, 0.9); rim.position.set(-3, 2.5, -3); scene.add(rim);
  const eye = [...VIEWS.corpo.eye], at = [...VIEWS.corpo.at];
  let goal = VIEWS.corpo, zoom = 1;
  let cur = null, rot = 0.4, goalRot = null, raf = 0, last = performance.now(), dragging = false, lx = 0, spin = true;
  const resize = () => { const w = box.clientWidth || 300, hh = box.clientHeight || 400; renderer.setSize(w, hh, false); cam.aspect = w / hh; cam.updateProjectionMatrix(); };
  const ro = new ResizeObserver(resize); ro.observe(box); resize();
  canvas.style.pointerEvents = 'auto'; canvas.style.cursor = 'grab'; canvas.style.touchAction = 'none';
  canvas.onpointerdown = (e) => { dragging = true; spin = false; goalRot = null; lx = e.clientX; canvas.setPointerCapture(e.pointerId); };
  canvas.onpointermove = (e) => { if (dragging) { rot += (e.clientX - lx) * 0.012; lx = e.clientX; } };
  canvas.onpointerup = canvas.onpointercancel = () => { dragging = false; };
  if (interactive) canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoom = Math.min(1.5, Math.max(0.6, zoom * (1 + e.deltaY * 0.001))); }, { passive: false });
  const loop = () => {
    raf = requestAnimationFrame(loop); const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (spin && !dragging) rot += dt * 0.5;
    if (goalRot !== null) { const d = Math.atan2(Math.sin(goalRot - rot), Math.cos(goalRot - rot)); rot += d * Math.min(1, dt * 6); if (Math.abs(d) < 0.005) goalRot = null; }
    const k = Math.min(1, dt * 6), z = interactive ? zoom : 1;
    const ge = goal.eye, ga = goal.at;
    for (let i = 0; i < 3; i++) { const de = ga[i] + (ge[i] - ga[i]) * z; eye[i] += (de - eye[i]) * k; at[i] += (ga[i] - at[i]) * k; }
    cam.position.set(eye[0], eye[1], eye[2]); cam.lookAt(at[0], at[1], at[2]);
    if (cur) { cur.root.rotation.y = rot; animateNinja(cur, dt, { speed: 0, grounded: true }); }
    renderer.render(scene, cam);
  };
  loop();
  return {
    set(look, clan, tails) { if (cur) { scene.remove(cur.root); disposeNinja(cur); } cur = buildNinja(look, clan, tails); scene.add(cur.root); },
    view(name) { goal = VIEWS[name] || VIEWS.corpo; zoom = 1; goalRot = 0; spin = false; },
    toggleSpin() { spin = !spin; return spin; },
    dispose() { cancelAnimationFrame(raf); ro.disconnect(); if (cur) disposeNinja(cur); renderer.dispose(); canvas.remove(); },
  };
}

// ---------- 1) mundos ----------
const SOLO_WORLD = () => loadWorlds().find(w => w.solo) || { code: 'SOLO', name: 'Modo solo', solo: true, created: Date.now(), last: Date.now() };
export function showWorlds() {
  const worlds = loadWorlds(), chars = loadChars(), soloOnly = !!window.__SW_SOLO_ONLY__;
  const el = h(`<div class="panel">
    <div><h1 class="title">Shinobi Wilds</h1><div class="subtitle">Exploração e sobrevivência ninja${soloOnly ? ' — versão solo' : ' em coop — até 4 jogadores por mundo'}</div></div>
    <div class="row">
      <div class="sticker y tilt-l"><h3>Modo solo</h3><div class="muted" style="color:#14142b">Sem servidor: tudo roda neste aparelho (sem coop).</div><div class="row" style="margin-top:6px"><button class="btn g" id="wsolo">Jogar solo</button></div></div>
      ${soloOnly ? '' : `<div class="sticker o tilt-r"><h3>Criar mundo (coop)</h3><div class="row"><input type="text" id="wn" maxlength="24" placeholder="Nome do mundo"><button class="btn" id="wc">Criar</button></div></div>
      <div class="sticker b tilt-l"><h3>Entrar com código</h3><div class="row"><input type="text" id="wcode" maxlength="16" placeholder="KNH-XXXX"><button class="btn" id="wj">Entrar</button></div><div id="werr" class="err"></div></div>`}
    </div>
    <div class="row"><a class="btn b" href="/mapa.html" style="text-decoration:none">Explorar o mapa (Konoha)</a></div>
    ${soloOnly ? '<div id="wg" class="hidden"></div>' : '<h2 class="subtitle">Seus mundos</h2><div class="grid" id="wg"></div>'}
    ${soloOnly ? '' : `<div class="muted" style="color:#fff">Servidor: ${esc(location.host)} — compartilhe o código do mundo com seus amigos (eles precisam abrir o mesmo endereço).</div>`}
  </div>`);
  el.querySelector('#wsolo').onclick = () => { const w = SOLO_WORLD(); saveWorld(w); showChars(w); };
  const g = el.querySelector('#wg');
  if (!worlds.length) g.appendChild(h('<div class="sticker">Nenhum mundo ainda. Crie um acima!</div>'));
  for (const w of worlds.sort((a, b) => (b.last || 0) - (a.last || 0))) {
    const last = chars.find(c => c.id === w.lastChar);
    const c = h(`<div class="sticker card">${sticker('scroll')}<h3>${esc(w.name)}</h3><div>Código: <span class="code">${esc(w.code)}</span></div>
      <div class="muted">${w.solo ? '(solo) ' : ''}${last ? 'Último personagem: ' + esc(last.name) : 'Sem personagem ainda'}</div>
      <div class="row" style="margin-top:8px"><button class="btn o sm" data-a="play">Escolher personagem</button>${last ? '<button class="btn g sm" data-a="direct">Entrar direto</button>' : ''}<button class="btn r sm" data-a="del">Remover</button></div></div>`);
    c.onclick = (e) => {
      const a = e.target.dataset.a; if (!a) return;
      if (a === 'del') { const b = e.target; if (b.dataset.arm) { deleteWorld(w.code); showWorlds(); } else { b.dataset.arm = '1'; b.textContent = 'Tem certeza?'; setTimeout(() => { b.dataset.arm = ''; b.textContent = 'Remover'; }, 3000); } }
      else if (a === 'play') showChars(w);
      else if (a === 'direct') enterFn(w, last);
    };
    g.appendChild(c);
  }
  if (!soloOnly) el.querySelector('#wc').onclick = () => { const name = el.querySelector('#wn').value.trim() || 'Mundo sem nome'; const w = { code: genCode(), name, created: Date.now(), last: Date.now() }; saveWorld(w); showChars(w); };
  const join = () => { const code = el.querySelector('#wcode').value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, ''); if (code.length < 4) { el.querySelector('#werr').textContent = 'Código inválido.'; return; }
    let w = loadWorlds().find(x => x.code === code); if (!w) { w = { code, name: 'Mundo ' + code, created: Date.now(), last: Date.now() }; saveWorld(w); } showChars(w); };
  if (!soloOnly) { el.querySelector('#wj').onclick = join; el.querySelector('#wcode').onkeydown = (e) => { if (e.key === 'Enter') join(); }; }
  mount(el);
}

// ---------- 2) personagens ----------
export function showChars(world) {
  const chars = loadChars(); let sel = chars.find(c => c.id === world.lastChar) || chars[0] || null;
  const el = h(`<div class="panel">
    <div class="row"><button class="btn sm" id="back">← Mundos</button><h2 class="subtitle" style="margin:0">Mundo: ${esc(world.name)} <span class="code">${esc(world.code)}</span></h2></div>
    <div class="creator"><div><div class="grid" id="cg" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))"></div>
      <div class="row" style="margin-top:12px"><button class="btn o" id="new">+ Criar novo personagem</button></div></div>
      <div class="preview" id="pv"><div class="sticker" id="info" style="position:absolute;left:10px;bottom:10px;right:10px;z-index:2"></div></div></div></div>`);
  const grid = el.querySelector('#cg'), info = el.querySelector('#info'), pv = el.querySelector('#pv');
  mount(el);
  const prev = createPreview(pv); activePreview = prev;
  const refresh = () => {
    grid.innerHTML = '';
    if (!chars.length) grid.appendChild(h('<div class="sticker">Você ainda não tem personagens. Crie o primeiro!</div>'));
    for (const c of chars) {
      const lv = levelFromXp(c.xp);
      const d = h(`<div class="sticker card ${sel && sel.id === c.id ? 'sel' : ''}">${sticker(c.clan)}<h3>${esc(c.name)}</h3><span class="badge">${CLANS[c.clan].name}${c.clan === 'uzumaki' ? ' · ' + c.tails + ' caudas' : ''}</span><span class="badge">${RANKS[c.rank]}</span><span class="badge">Nv ${lv}</span><div class="muted">${c.elements.map(e => ELEMENTS[e].name).join(' + ')}</div></div>`);
      d.onclick = () => { sel = c; refresh(); }; d.ondblclick = () => enterFn(world, c); grid.appendChild(d);
    }
    if (sel) { prev.set(sel.look, sel.clan, sel.tails); info.innerHTML = `<b>${esc(sel.name)}</b> — ${CLANS[sel.clan].name}, ${RANKS[sel.rank]}, nível ${levelFromXp(sel.xp)}<div class="row" style="margin-top:8px"><button class="btn g" id="go">Entrar no mundo</button><button class="btn r sm" id="del">Apagar</button></div>`;
      info.querySelector('#go').onclick = () => enterFn(world, sel);
      const dl = info.querySelector('#del'); dl.onclick = () => { if (dl.dataset.arm) { deleteChar(sel.id); showChars(world); } else { dl.dataset.arm = '1'; dl.textContent = 'Tem certeza?'; setTimeout(() => { dl.dataset.arm = ''; dl.textContent = 'Apagar'; }, 3000); } };
    } else info.innerHTML = 'Selecione ou crie um personagem.';
  };
  refresh();
  el.querySelector('#back').onclick = showWorlds;
  el.querySelector('#new').onclick = () => showCreator(world);
}

// ---------- 3) criação ----------
export function showCreator(world) {
  const st = { name: '', clan: 'uchiha', tails: 1, elements: [], rank: 0, look: defaultLook() };
  const L = st.look;
  const el = h(`<div class="panel"><div class="row"><button class="btn sm" id="back">← Voltar</button><h2 class="subtitle" style="margin:0">Criar personagem</h2></div>
   <div class="creator"><div class="sticker" style="display:flex;flex-direction:column;gap:10px" id="form"></div><div class="preview" id="pv"></div></div></div>`);
  const form = el.querySelector('#form'), pv = el.querySelector('#pv');
  const opt = (arr, v) => arr.map(([id, n]) => `<option value="${id}" ${id === v ? 'selected' : ''}>${n}</option>`).join('');
  const sw = (label, key, val) => `<label class="f">${label}<input type="color" data-look="${key}" value="${val}"></label>`;
  form.innerHTML = `
   <section class="cr-sec"><h3>1 · Identidade</h3>
    <label class="f">Nome<input type="text" id="nm" maxlength="14" placeholder="Seu ninja"></label>
    <div><b>Clã</b><div class="seg" id="clans">${Object.entries(CLANS).map(([k, v]) => `<button class="btn sm" data-clan="${k}">${v.name}</button>`).join('')}</div><div class="muted" id="clandesc"></div></div>
    <label class="f" id="tailw">Bijuu (Uzumaki): caudas<select id="tails">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<option>${n}</option>`).join('')}</select></label>
    <div><b>Elementos (escolha 2)</b><div class="seg" id="els">${Object.entries(ELEMENTS).map(([k, v]) => `<button class="btn sm" data-el="${k}" title="${v.desc}">${v.name}</button>`).join('')}</div><div class="muted" id="eldesc"></div></div>
   </section>
   <section class="cr-sec"><h3>2 · Rosto</h3>
    <div class="opts">
     <label class="f">Olhos<select data-look="eyes">${opt(EYE_STYLES, L.eyes)}</select></label>
     <label class="f">Pupilas<select data-look="pupil">${opt(PUPIL_STYLES, L.pupil)}</select></label>
    </div>
    <div class="row">${sw('Pele', 'skin', L.skin)}${sw('Olhos', 'eyeColor', L.eyeColor)}${sw('Pupila', 'pupilColor', L.pupilColor)}</div>
   </section>
   <section class="cr-sec"><h3>3 · Cabelo e testeira</h3>
    <div class="opts">
     <label class="f">Cabelo<select data-look="hair">${opt(HAIR_STYLES, L.hair)}</select></label>
     <label class="f">Testeira<select data-look="band">${opt(BAND_OPTS, L.band)}</select></label>
    </div>
    <div class="row">${sw('Cor do cabelo', 'hairColor', L.hairColor)}${sw('Faixa/testeira', 'accent', L.accent)}</div>
   </section>
   <section class="cr-sec"><h3>4 · Roupas</h3>
    <label class="f">Roupa<select data-look="outfit">${opt(OUTFITS, L.outfit)}</select></label>
    <div class="row">${sw('Roupa A', 'outfitA', L.outfitA)}${sw('Roupa B', 'outfitB', L.outfitB)}</div>
   </section>
   <section class="cr-sec"><h3>5 · Corpo</h3>
    <label class="f">Altura <input type="range" min="0.88" max="1.12" step="0.01" value="${L.height}" data-look="height"></label>
    <label class="f">Musculatura <input type="range" min="0" max="1" step="0.01" value="${L.muscle}" data-look="muscle"></label>
    <label class="f">Gordura corporal <input type="range" min="0" max="1" step="0.01" value="${L.fat}" data-look="fat"></label>
   </section>
   <section class="cr-sec"><h3>6 · Começo</h3>
    <label class="f">Rank inicial (modo de teste — normalmente começa Genin)<select id="rk">${RANKS.map((r, i) => `<option value="${i}">${r}</option>`).join('')}</select></label>
   </section>
   <div class="err" id="er"></div>
   <div class="row"><button class="btn g" id="save">Criar e entrar</button></div>`;
  mount(el);
  pv.insertAdjacentHTML('beforeend', '<div class="pvbar"><button class="btn sm" data-view="corpo">Corpo</button><button class="btn sm" data-view="rosto">Rosto</button><button class="btn sm" data-view="costas">Costas</button><button class="btn sm" data-view="girar">Girar</button></div>');
  const prev = createPreview(pv, { interactive: true }); activePreview = prev;
  pv.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { if (b.dataset.view === 'girar') prev.toggleSpin(); else prev.view(b.dataset.view); });
  let tmr = 0; const upd = () => { clearTimeout(tmr); tmr = setTimeout(() => prev.set(st.look, st.clan, st.tails), 60); };
  const validate = () => { const er = form.querySelector('#er'); const msgs = []; if (!st.name.trim()) msgs.push('Dê um nome ao personagem.'); if (st.elements.length !== 2) msgs.push('Escolha exatamente 2 elementos.'); er.textContent = msgs.join(' '); form.querySelector('#save').disabled = msgs.length > 0; };
  const sync = () => {
    form.querySelectorAll('[data-clan]').forEach(b => b.classList.toggle('on', b.dataset.clan === st.clan));
    form.querySelectorAll('[data-el]').forEach(b => b.classList.toggle('on', st.elements.includes(b.dataset.el)));
    form.querySelector('#clandesc').textContent = CLANS[st.clan].desc; form.querySelector('#tailw').style.display = st.clan === 'uzumaki' ? '' : 'none';
    form.querySelector('#eldesc').textContent = st.elements.map(e => ELEMENTS[e].name + ': ' + ELEMENTS[e].desc).join(' · '); validate();
  };
  form.querySelector('#nm').oninput = (e) => { st.name = e.target.value; validate(); };
  form.querySelectorAll('[data-clan]').forEach(b => b.onclick = () => { st.clan = b.dataset.clan; sync(); upd(); });
  form.querySelectorAll('[data-el]').forEach(b => b.onclick = () => { const k = b.dataset.el, i = st.elements.indexOf(k); if (i >= 0) st.elements.splice(i, 1); else if (st.elements.length < 2) st.elements.push(k); sync(); });
  form.querySelector('#tails').onchange = (e) => { st.tails = +e.target.value; upd(); };
  form.querySelector('#rk').onchange = (e) => { st.rank = +e.target.value; };
  form.querySelectorAll('[data-look]').forEach(inp => { const f = () => { const k = inp.dataset.look; L[k] = inp.type === 'range' ? +inp.value : inp.value; upd(); }; inp.oninput = f; inp.onchange = f; });
  form.querySelector('#save').onclick = () => {
    const c = newCharacter({ name: st.name.trim(), clan: st.clan, tails: st.tails, elements: st.elements.slice(), look: { ...L }, rank: st.rank });
    saveChar(c); enterFn(world, c);
  };
  el.querySelector('#back').onclick = () => showChars(world);
  sync(); prev.set(L, st.clan, st.tails);
}
