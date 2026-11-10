// Núcleo do jogo: controle do personagem, câmera, combate, rede e missão.
import * as THREE from 'three';
import { WORLD, buildColliders, collide, levelFromXp, RANKS } from './shared.js';
import { buildNinja, animateNinja, setOutlines } from './ninja.js';
import { buildKonoha } from './world.js';
import { derive, saveChar, saveWorld, loadSettings, saveSettings, DEFAULT_SETTINGS } from './store.js';
import { Net } from './net.js';
import { LocalNet } from './localnet.js';
import { Audio } from './audio.js';
import { createHud } from './hud.js';
import { createFx } from './fx.js';
import { createEntities } from './entities.js';
import { createTouch, isTouchDevice } from './touch.js';

let renderer = null;
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const AC = { punch1: { dur: 0.42, hit: 0.5 }, punch2: { dur: 0.42, hit: 0.5 }, kick: { dur: 0.62, hit: 0.5 }, cast: { dur: 0.6, hit: 0.72 }, fear: { dur: 0.5, hit: 0.3 }, dash: { dur: 0.22, hit: 9 } };
const ACTION_KEYS = ['jump', 'dash', 'fire', 'fear', 'interact', 'cloak', 'byakugan', 'skills'];

export async function startGame({ world, char, onExit }) {
  const settings = loadSettings();
  const canvas = document.getElementById('game');
  if (!renderer) { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x8fd3ff); scene.fog = new THREE.Fog(0xc8ebff, 90, 420);
  const camera = new THREE.PerspectiveCamera(settings.fov, innerWidth / innerHeight, 0.1, 800);
  const hemi = new THREE.HemisphereLight(0xdcefff, 0x8a7a5a, 1.2); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d0, 2.2); sun.castShadow = true; sun.shadow.camera.left = -45; sun.shadow.camera.right = 45; sun.shadow.camera.top = 45; sun.shadow.camera.bottom = -45; sun.shadow.camera.far = 220; sun.shadow.bias = -0.0004; sun.shadow.camera.updateProjectionMatrix(); scene.add(sun, sun.target);
  const konoha = buildKonoha(scene);
  const COLLIDERS = buildColliders();
  const fx = createFx(scene), ents = createEntities(scene);
  const audio = new Audio(settings), net = world.solo ? new LocalNet() : new Net();
  let D = derive(char), disposed = false, raf = 0, joined = false, myId = null, mission = null, lastSnap = null;

  // ----- jogador -----
  const J = buildNinja(char.look, char.clan, char.tails); scene.add(J.root);
  const P = { x: WORLD.spawn[0], y: 0, z: WORLD.spawn[2], vx: 0, vz: 0, vy: 0, yaw: 0, face: 0, pitch: 0.12, grounded: true, jumps: 0, stam: D.maxStam, ck: D.maxChakra, hp: D.maxHp, mhp: D.maxHp, act: null, actT: 0, hitDone: false, combo: 0, dashDir: [0, 1], djT: 0, lastSpend: -9, cloak: false, byak: false, dead: false, hurtT: 0, fireCd: 0, ramenAt: -99, shake: 0 };
  const keys = new Set(); let codeMap = {}; const isTouch = isTouchDevice(); let tc = { mx: 0, my: 0, run: false }, touchUI = null;
  let locked = false, time = 0, last = performance.now(), sendT = 0, partyT = 0;

  // ----- HUD / configurações -----
  const api = {
    settings, char, net, audio,
    applySettings, resetKeys() { settings.keys = { ...DEFAULT_SETTINGS.keys }; saveSettings(settings); applySettings(); },
    onExit: () => finish(),
    onModalClosed() { if (!disposed && !isTouch) lock(); },
    onCharChanged() { D = derive(char); P.mhp = D.maxHp; P.stam = Math.min(P.stam, D.maxStam); P.ck = Math.min(P.ck, D.maxChakra); H.setWho(char); },
  };
  const H = createHud(api);
  function applySettings() {
    const q = settings.quality, dpr = devicePixelRatio || 1;
    renderer.setPixelRatio(q === 'baixa' ? 0.7 : q === 'media' ? Math.min(1, dpr) : Math.min(2, dpr));
    renderer.setSize(innerWidth, innerHeight, false);
    const sh = q !== 'baixa'; if (renderer.shadowMap.enabled !== sh) { renderer.shadowMap.enabled = sh; scene.traverse(o => { if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.needsUpdate = true; }); } }); }
    const size = q === 'alta' ? 2048 : 1024; if (sun.shadow.mapSize.x !== size) { sun.shadow.mapSize.set(size, size); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    sun.castShadow = sh; setOutlines(q !== 'baixa'); scene.fog.far = q === 'alta' ? 520 : q === 'media' ? 420 : 300;
    camera.fov = settings.fov; camera.updateProjectionMatrix(); audio.apply(); H && H.setKeys && H.setKeys(settings.keys);
    codeMap = {}; for (const a of ACTION_KEYS) codeMap[settings.keys[a]] = a;
  }
  applySettings();

  // ----- entrada -----
  const down = (a) => keys.has(settings.keys[a]);
  const canControl = () => (locked || isTouch) && !H.modalOpen && !P.dead && joined;
  function lock() { try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch { /* precisa de clique */ } }
  const onKeyDown = (e) => {
    if (e.code === 'Escape') { if (H.modalOpen) { e.preventDefault(); H.closeModal(); } return; }
    if (e.repeat) return; keys.add(e.code);
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code) && locked) e.preventDefault();
    const a = codeMap[e.code]; if (!a || !canControl()) return;
    audio.init();
    if (a === 'jump') jump(); else if (a === 'dash') dash(); else if (a === 'fire') tryFire(); else if (a === 'fear') tryFear();
    else if (a === 'interact') interact(); else if (a === 'cloak') toggleCloak(); else if (a === 'byakugan') toggleByak();
    else if (a === 'skills') { H.openSkills(); document.exitPointerLock(); }
  };
  const onKeyUp = (e) => keys.delete(e.code);
  const onMouseDown = (e) => {
    if (isTouch) return; // no celular os botões de toque cuidam das ações
    audio.init();
    if (!locked && !H.modalOpen && !disposed) { lock(); return; }
    if (!canControl()) return;
    if (e.button === 0) tryMelee('punch'); else if (e.button === 2) tryMelee('kick');
  };
  const onMouseMove = (e) => { if (!locked) return; P.yaw -= e.movementX * 0.0022 * settings.sens; P.pitch = Math.max(-1.0, Math.min(1.1, P.pitch - e.movementY * 0.0022 * settings.sens)); };
  const onLockChange = () => { if (isTouch) return; locked = document.pointerLockElement === canvas; if (!locked && !H.modalOpen && !disposed && joined) { H.openPause(); } };
  const onResize = () => { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); };
  const onBlur = () => keys.clear(), onCtx = (e) => e.preventDefault();
  addEventListener('keydown', onKeyDown); addEventListener('keyup', onKeyUp); addEventListener('mousedown', onMouseDown); addEventListener('mousemove', onMouseMove);
  addEventListener('resize', onResize); addEventListener('blur', onBlur); addEventListener('contextmenu', onCtx); document.addEventListener('pointerlockchange', onLockChange);
  onResize();
  if (isTouch) {
    document.body.classList.add('touch-mode');
    const ctl = (f) => () => { if (canControl()) f(); };
    touchUI = createTouch({
      first: () => audio.init(),
      look: (dx, dy) => { if (!canControl()) return; P.yaw -= dx * 0.005 * settings.sens; P.pitch = Math.max(-1.0, Math.min(1.1, P.pitch - dy * 0.005 * settings.sens)); },
      jump: ctl(() => jump()), dash: ctl(() => dash()), punch: ctl(() => tryMelee('punch')), kick: ctl(() => tryMelee('kick')), fire: ctl(() => tryFire()),
      fear: ctl(() => tryFear()), interact: ctl(() => interact()), cloak: ctl(() => toggleCloak()), byak: ctl(() => toggleByak()),
      skills: () => { if (joined && !H.modalOpen) H.openSkills(); }, pause: () => { if (!H.modalOpen) H.openPause(); },
    });
    tc = touchUI.state; touchUI.setClan(char.clan, D.hasFear);
  }

  // ----- ações -----
  const spend = (n) => { P.stam -= n; P.lastSpend = time; };
  function jump() {
    if (P.act === 'dash') return;
    if (P.grounded) { P.vy = 11.5; P.grounded = false; P.jumps = 1; audio.play('jump'); }
    else if (P.jumps < 2 && P.stam >= D.jumpCost) { P.vy = 10.5; P.jumps = 2; spend(D.jumpCost); P.djT = 0.5; audio.play('djump'); fx.burst([P.x, P.y + 0.2, P.z], 0xffffff, 8, 3); }
    else if (P.jumps < 2) H.toast('Sem stamina para o pulo duplo!', 'r', 1200);
  }
  function inputDir() {
    const cl = (v) => Math.max(-1, Math.min(1, v)), ix = cl((down('right') ? 1 : 0) - (down('left') ? 1 : 0) + tc.mx), iz = cl((down('forward') ? 1 : 0) - (down('back') ? 1 : 0) + tc.my);
    const f = [Math.sin(P.yaw), Math.cos(P.yaw)], r = [-Math.cos(P.yaw), Math.sin(P.yaw)];
    let mx = f[0] * iz + r[0] * ix, mz = f[1] * iz + r[1] * ix; const l = Math.hypot(mx, mz); if (l > 0) { mx /= l; mz /= l; }
    return { ix, iz, mx, mz, l };
  }
  function dash() {
    if (P.act || P.stam < D.dashCost) { if (!P.act) H.toast('Sem stamina para o dash!', 'r', 1200); return; }
    const d = inputDir(); const dir = d.l > 0 ? [d.mx, d.mz] : [Math.sin(P.yaw), Math.cos(P.yaw)]; // sem direção: dash para frente
    P.dashDir = dir; spend(D.dashCost); startAct('dash'); audio.play('dash'); fx.burst([P.x, P.y + 1, P.z], 0xdddddd, 8, 3);
  }
  function startAct(n) { P.act = n; P.actT = 0; P.hitDone = false; }
  function tryMelee(kind) { if (P.act) return; if (kind === 'punch') { P.combo ^= 1; startAct(P.combo ? 'punch2' : 'punch1'); } else startAct('kick'); audio.play('swing'); }
  function tryFire() { if (P.act || P.fireCd > 0) return; if (P.ck < D.fireCost) { H.toast('Chakra insuficiente!', 'r', 1200); return; } P.ck -= D.fireCost; P.fireCd = 0.5; startAct('cast'); }
  function tryFear() { if (!D.hasFear) { H.toast('Aprenda "Tsukuyomi" na árvore de Genjutsu (K).', 'y', 2200); return; } if (P.act || P.ck < 30) { if (!P.act) H.toast('Chakra insuficiente!', 'r', 1200); return; } P.ck -= 30; startAct('fear'); }
  function toggleCloak() { if (char.clan !== 'uzumaki') { H.toast('Só Uzumaki pode usar o manto de chakra.', 'y', 1800); return; } P.cloak = !P.cloak && P.ck > 5; H.toast(P.cloak ? `Manto de ${char.tails} caudas ativo (+${Math.round((D.cloakBonus - 1) * 100)}% dano, +10% velocidade)` : 'Manto desativado', 'o', 1800); }
  function toggleByak() { if (char.clan !== 'hyuga') { H.toast('Só Hyuga possui o Byakugan.', 'y', 1800); return; } P.byak = !P.byak; H.toast(P.byak ? 'Byakugan ativo' : 'Byakugan desativado', 'b', 1500); }
  const mult = () => (P.cloak ? D.cloakBonus : 1);
  function melee(range, dmg, kind) {
    const fw = [Math.sin(P.yaw), Math.cos(P.yaw)]; let n = 0;
    for (const [id, v] of ents.enemies) {
      const dx = v.p.x - P.x, dz = v.p.z - P.z, d = Math.hypot(dx, dz); if (d > range + 0.5 * v.g.scale.x) continue;
      if (d > 1.3 && (dx * fw[0] + dz * fw[1]) / d < 0.15) continue;
      net.send({ t: 'hit', id, kind, dmg: Math.round(dmg * mult()), stun: Math.random() < D.stunChance ? 1.2 : 0 }); if (++n >= 2) break;
    }
    audio.play(kind === 'kick' ? 'kick' : 'punch'); if (n) P.shake = 0.15;
  }
  const tmpV = new THREE.Vector3(), tmpO = new THREE.Vector3();
  function aimPoint() {
    camera.getWorldDirection(tmpV); tmpO.copy(camera.position); let best = 70;
    for (const v of ents.enemies.values()) { const cx = v.p.x - tmpO.x, cy = v.p.y + 1.1 - tmpO.y, cz = v.p.z - tmpO.z, t = cx * tmpV.x + cy * tmpV.y + cz * tmpV.z; if (t < 2) continue; const dd = cx * cx + cy * cy + cz * cz - t * t; if (dd < (1.3 * v.g.scale.x) ** 2 && t < best) best = t; }
    if (tmpV.y < -0.02) { const t = -tmpO.y / tmpV.y; if (t > 0 && t < best) best = t; }
    return [tmpO.x + tmpV.x * best, tmpO.y + tmpV.y * best, tmpO.z + tmpV.z * best];
  }
  function spawnFire() {
    const fw = [Math.sin(P.yaw), Math.cos(P.yaw)], m = [P.x + fw[0] * 0.8, P.y + 1.35, P.z + fw[1] * 0.8], a = aimPoint();
    let d = [a[0] - m[0], a[1] - m[1], a[2] - m[2]]; const l = Math.hypot(...d) || 1; d = d.map(v => v / l); if (d[0] * fw[0] + d[2] * fw[1] < 0.2) d = [fw[0], 0, fw[1]];
    fx.fireball(m, d, D.fireBig, true); net.send({ t: 'fire', p: m, d, big: D.fireBig }); audio.play('fire');
  }
  function explode(pos) { fx.burst(pos, 0xff6a1a, 26, 8); fx.burst(pos, 0xffd23f, 12, 5); audio.play('boom'); net.send({ t: 'fireground', p: [pos.x, 0, pos.z] }); }
  function onBall(b) {
    const p = b.g.position, r = (b.big ? 1.1 : 0.8);
    for (const [id, v] of ents.enemies) {
      const d = Math.hypot(v.p.x - p.x, v.p.z - p.z); if (d < r + 0.7 * v.g.scale.x && p.y < v.p.y + 2.8 * v.g.scale.x) {
        net.send({ t: 'hit', id, kind: 'fire', dmg: Math.round(D.fireDmg * mult()), burn: D.burnSecs, burnDps: Math.round(D.burnDps * mult()) }); explode(p); return true;
      }
    }
    if (p.y < 0.3) { explode(p); return true; }
    if (p.y < 9) for (const [cx, cz, w, d] of COLLIDERS) if (Math.abs(p.x - cx) < w / 2 && Math.abs(p.z - cz) < d / 2) { explode(p); return true; }
    return false;
  }
  function doHit(n) {
    if (n === 'punch1' || n === 'punch2') melee(2.8, D.punchDmg, 'punch'); else if (n === 'kick') melee(3.3, D.kickDmg, 'kick');
    else if (n === 'cast') spawnFire();
    else if (n === 'fear') { net.send({ t: 'ability', k: 'fear', r: D.fearR, dur: D.fearDur }); fx.ring([P.x, 0, P.z], D.fearR); audio.play('fear'); }
  }

  // ----- interação -----
  let nearI = null;
  function interact() {
    if (!nearI) return;
    if (nearI.id === 'board') { H.openBoard({ mission, otherRanks: [...ents.remotes.values()].map(v => v.rank) }); document.exitPointerLock(); }
    else if (nearI.id === 'desk') { H.openPromotion(); document.exitPointerLock(); }
    else if (nearI.id === 'ramen') {
      if (time - P.ramenAt < 20) { H.toast(`O ramen ainda está sendo preparado (${Math.ceil(20 - (time - P.ramenAt))}s)`, 'y', 1500); return; }
      P.ramenAt = time; P.ck = D.maxChakra; P.stam = D.maxStam; net.send({ t: 'heal' }); audio.play('eat'); H.toast('🍜 Ramen delicioso! HP, chakra e stamina recuperados.', 'o');
    }
  }

  // ----- rede -----
  function party() {
    const list = [{ me: true, name: char.name, rank: char.rank, hp: P.hp, mhp: P.mhp, dead: P.dead }];
    for (const v of ents.remotes.values()) list.push({ name: v.name, rank: v.rank, hp: v.hp ?? 100, mhp: v.mhp ?? 100, dead: v.dead });
    H.setParty(list);
  }
  net.on('welcome', (m) => {
    myId = m.id; mission = m.mission; joined = true; m.players.forEach(p => ents.addRemote(p)); H.setMission(mission); party();
    saveWorld({ ...world, last: Date.now(), lastChar: char.id });
    H.toast(`Mundo <b>${esc(world.name)}</b> — código <span class="code">${esc(m.code)}</span>`, 'b', 6000);
    if (!isTouch) H.setPrompt('Clique na tela para capturar o mouse e jogar');
  });
  net.on('joined', (m) => { ents.addRemote(m.player); H.toast(`${esc(m.player.name)} entrou no mundo`, 'g'); party(); });
  net.on('left', (m) => { const v = ents.remotes.get(m.id); if (v) H.toast(`${esc(v.name)} saiu`, 'y'); ents.removeRemote(m.id); party(); });
  net.on('snap', (m) => {
    lastSnap = m; ents.onSnap(m, myId);
    const me = m.pl.find(p => p.id === myId); if (!me) return;
    if (P.dead && !me.dead) { P.x = WORLD.spawn[0]; P.z = WORLD.spawn[2]; P.y = 0; P.vx = P.vz = P.vy = 0; H.setDead(false); }
    if (!P.dead && me.dead) { H.setDead(true); P.act = null; }
    P.dead = me.dead; P.hp = me.hp; P.mhp = me.mhp;
  });
  net.on('mission', (m) => { const prev = mission; mission = m.mission; H.setMission(mission); if (mission && mission.state === 'done' && (!prev || prev.state !== 'done')) { audio.play('win'); H.toast('🏆 <b>Missão concluída!</b>', 'o', 4500); } });
  net.on('reward', (m) => {
    const before = levelFromXp(char.xp); char.xp += m.xp; const after = levelFromXp(char.xp); saveChar(char); api.onCharChanged();
    H.toast(`+${m.xp} XP (${esc(m.mission)})`, 'g', 4200);
    if (after > before) H.toast(`⬆ Nível ${after}! Pontos de habilidade: aperte <b>K</b>`, 'o', 5000);
    if (m.underRanked) H.toast(`Você acompanhou uma missão de rank superior. Seu rank continua <b>${RANKS[char.rank]}</b> — promoção só com o Hokage.`, 'b', 6500);
  });
  net.on('notice', (m) => H.toast(esc(m.msg), m.code === 'ff_blocked' ? 'r' : 'y', 2600));
  net.on('hurt', () => { H.hurt(); audio.play('hurt'); P.shake = 0.25; });
  net.on('error', (m) => { H.toast(esc(m.msg), 'r', 5000); setTimeout(() => finish(), 1800); });
  net.on('close', () => { if (!disposed) { H.toast('Conexão com o servidor perdida.', 'r', 4000); setTimeout(() => finish(), 1500); } });
  net.on('fx', (m) => {
    if (m.k === 'hit') { fx.pop([m.p[0], 1.9, m.p[2]], m.kind === 'fire' ? 'BOOM!' : m.kind === 'kick' ? 'WHAM!' : (Math.random() > 0.5 ? 'POW!' : 'BAM!'), m.kind === 'fire' ? '#ff6a1a' : m.kind === 'kick' ? '#1f4fff' : '#e63946'); fx.burst([m.p[0], 1.2, m.p[2]], 0xffffff, 6, 4); }
    else if (m.k === 'death') { fx.burst([m.p[0], 1, m.p[2]], 0x8a8a9a, 24, 7); fx.pop([m.p[0], 2.2, m.p[2]], 'K.O.!', '#2ec27e'); }
    else if (m.k === 'swing') { ents.swingAt(m.p); audio.play('swing'); }
    else if (m.k === 'fear') { fx.ring([m.p[0], 0, m.p[2]], m.r); }
    else if (m.k === 'fire') { const b = fx.fireball(m.p, m.d, m.big, false); b.life = 1.4; audio.play('fire'); }
  });
  try { await net.connect(); } catch (e) { H.toast(esc(e.message), 'r', 6000); setTimeout(() => finish(), 2500); return { dispose: () => finish(true) }; }
  net.send({ t: 'join', code: world.code, char: { name: char.name, clan: char.clan, rank: char.rank, level: levelFromXp(char.xp), look: char.look, tails: char.tails, maxHp: D.maxHp } });
  H.setWho(char); H.setMission(null); H.setBars({ hp: P.hp, mhp: P.mhp, ck: P.ck, mck: D.maxChakra, st: P.stam, mst: D.maxStam });

  // ----- câmera -----
  const tmpCam = new THREE.Vector3();
  function updateCamera(dt) {
    const hh = 1.6 * (char.look.height || 1), cp = Math.cos(P.pitch);
    const dx = Math.sin(P.yaw) * cp, dy = Math.sin(P.pitch), dz = Math.cos(P.yaw) * cp;
    const hx = P.x, hy = P.y + hh, hz = P.z; let dist = 4.3;
    const H0 = WORLD.hokage, inside = Math.abs(P.x - H0.x) < H0.w / 2 - 0.6 && P.z > H0.z - H0.d / 2 + 0.6 && P.z < H0.z + H0.d / 2 - 0.6;
    let t = 1; for (let i = 1; i <= 10; i++) { const s = i / 10, cx = hx - dx * dist * s, cy = hy - dy * dist * s + 0.5 * s, cz = hz - dz * dist * s; let bad = cy < 0.25 || (inside && cy > 4.6); if (!bad) for (const [bx, bz, w, d] of COLLIDERS) if (Math.abs(cx - bx) < w / 2 + 0.3 && Math.abs(cz - bz) < d / 2 + 0.3) { bad = true; break; } if (bad) { t = Math.max(0.12, (i - 1) / 10); break; } }
    dist *= t; tmpCam.set(hx - dx * dist, hy - dy * dist + 0.5 * t, hz - dz * dist);
    if (P.shake > 0) { P.shake -= dt; tmpCam.x += (Math.random() - 0.5) * P.shake * 0.4; tmpCam.y += (Math.random() - 0.5) * P.shake * 0.4; }
    camera.position.copy(tmpCam); camera.lookAt(hx + dx * 10, hy + dy * 10 + 0.5, hz + dz * 10);
    J.root.visible = dist > 0.9;
  }

  // ----- laço principal -----
  function step(dt) {
    time += dt;
    if (!joined) { updateCamera(dt); return; }
    const ctl = canControl(), inp = ctl ? inputDir() : { ix: 0, iz: 0, mx: 0, mz: 0, l: 0 };
    // recursos
    if (time - P.lastSpend > 0.8) P.stam = Math.min(D.maxStam, P.stam + 28 * dt);
    P.ck = Math.min(D.maxChakra, P.ck + D.chakraRegen * dt); P.fireCd -= dt;
    if (P.cloak) { P.ck -= 4 * dt; if (P.ck <= 0) { P.ck = 0; P.cloak = false; H.toast('Chakra esgotado: manto desativado', 'y', 1500); } }
    if (P.dead) { P.cloak = false; P.act = null; }
    // movimento
    const running = ctl && (down('run') || tc.run), sp0 = (running ? 10.5 : 5.2) * (P.cloak ? 1.1 : 1) * (inp.iz < 0 ? 0.85 : 1);
    const lock_ = P.act && P.act !== 'dash' ? (P.act === 'cast' || P.act === 'fear' ? 0.3 : 0.45) : 1;
    if (P.act === 'dash') { P.vx = P.dashDir[0] * 25; P.vz = P.dashDir[1] * 25; P.vy = Math.max(P.vy, 0); }
    else { const k = Math.min(1, dt * (P.grounded ? 14 : 4)); P.vx += (inp.mx * sp0 * lock_ - P.vx) * k; P.vz += (inp.mz * sp0 * lock_ - P.vz) * k; }
    P.vy -= 32 * dt; P.x += P.vx * dt; P.z += P.vz * dt; P.y += P.vy * dt;
    if (P.y <= 0) { P.y = 0; if (P.vy < 0) P.vy = 0; if (!P.grounded) { P.grounded = true; P.jumps = 0; } } else if (P.y > 0.05) P.grounded = false;
    [P.x, P.z] = collide(P.x, P.z, 0.45, COLLIDERS); P.x = Math.max(-170, Math.min(170, P.x)); P.z = Math.max(-80, Math.min(175, P.z));
    // ações
    if (P.act) { const a = AC[P.act]; P.actT += dt / a.dur; if (!P.hitDone && P.actT >= a.hit) { P.hitDone = true; doHit(P.act); } if (P.actT >= 1) { P.act = null; P.actT = 0; } }
    if (P.djT > 0) P.djT -= dt; P.hurtT -= dt;
    // modelo
    P.face += (((P.yaw - P.face + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 18);
    J.root.position.set(P.x, P.y, P.z); J.root.rotation.y = P.face;
    const sy = Math.sin(P.face), cy = Math.cos(P.face), speed = Math.hypot(P.vx, P.vz);
    const animAct = P.act || (P.djT > 0 ? 'djump' : null), animT = P.act ? P.actT : 1 - P.djT / 0.5;
    animateNinja(J, dt, { speed, grounded: P.grounded, vy: P.vy, act: animAct, actT: animT, dashX: P.act === 'dash' ? (P.dashDir[0] * cy - P.dashDir[1] * sy) : 0, dead: P.dead, hurt: P.hurtT, cloak: P.cloak, byakugan: P.byak,
      localVel: [P.vx * cy - P.vz * sy, P.vx * sy + P.vz * cy] });
    // mundo / entidades
    ents.update(dt, time, { byakugan: P.byak, playerPos: tmpV.set(P.x, P.y, P.z) }); fx.update(dt, onBall); konoha.update(time);
    sun.position.set(P.x + 35, 60, P.z + 25); sun.target.position.set(P.x, 0, P.z); sun.target.updateMatrixWorld();
    updateCamera(dt);
    // interação
    nearI = null; let bd = 1e9; for (const it of konoha.interactables) { const d = Math.hypot(P.x - it.pos[0], P.z - it.pos[2]); if (d < it.r && d < bd) { bd = d; nearI = it; } }
    H.setPrompt(!locked && !H.modalOpen && !isTouch ? 'Clique na tela para capturar o mouse' : (nearI && ctl ? (isTouch ? nearI.label.replace(/^E — /, '') : nearI.label) : null));
    if (touchUI) { touchUI.setInteract(!!(nearI && ctl)); touchUI.setFear(D.hasFear); }
    // rede (15 Hz)
    sendT += dt; if (sendT > 1 / 15) { sendT = 0; const an = P.act || (P.djT > 0 ? 'djump' : (!P.grounded ? 'air' : speed > 1 ? 'run' : 'idle')); net.send({ t: 'state', p: [+P.x.toFixed(2), +P.y.toFixed(2), +P.z.toFixed(2)], ry: +P.face.toFixed(3), an, maxHp: D.maxHp, cl: P.cloak }); }
    partyT += dt; if (partyT > 0.4) { partyT = 0; party(); }
    H.setBars({ hp: P.hp, mhp: P.mhp, ck: P.ck, mck: D.maxChakra, st: P.stam, mst: D.maxStam });
  }
  function frame(now) {
    if (disposed) return; raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    try { step(dt); } catch (e) { console.error(e); }
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);

  function finish(silent) {
    if (disposed) return; disposed = true; cancelAnimationFrame(raf); saveChar(char);
    removeEventListener('keydown', onKeyDown); removeEventListener('keyup', onKeyUp); removeEventListener('mousedown', onMouseDown); removeEventListener('mousemove', onMouseMove);
    removeEventListener('resize', onResize); removeEventListener('blur', onBlur); removeEventListener('contextmenu', onCtx); document.removeEventListener('pointerlockchange', onLockChange);
    try { document.exitPointerLock(); } catch { /* ok */ }
    net.close(); audio.dispose(); fx.clear(); ents.dispose(); if (touchUI) touchUI.dispose(); document.body.classList.remove('touch-mode');
    scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    document.getElementById('hud').classList.add('hidden'); const pz = document.getElementById('pause'); pz.classList.add('hidden'); pz.innerHTML = '';
    if (!silent) onExit();
  }
  return { dispose: () => finish(true) };
}
