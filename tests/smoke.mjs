// Teste de fumaça do CLIENTE: executa menus, construção de mundo/ninjas e o laço do jogo com um stub de three.js/DOM,
// conectado ao servidor real. NÃO valida renderização (isso exige um navegador com WebGL).
// Uso: node --import ./tests/register.mjs tests/smoke.mjs
import { spawn } from 'child_process';
import { _dummy as dummy } from './three-stub.mjs';

const PORT = 3918, errors = [], results = [];
const ok = (n, c, x = '') => { results.push(`${c ? 'OK  ' : 'FALHA'} ${n}${x ? ' — ' + x : ''}`); if (!c) errors.push(n); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ----- DOM falso -----
const els = {}, L = {}, DL = {};
const el = (id) => (els[id] ??= dummy(id));
const canvas = el('game');
const document_ = {
  getElementById: (id) => el(id), createElement: () => dummy('el'), createComment: () => dummy('c'), body: dummy('body'), head: dummy('head'),
  pointerLockElement: null, exitPointerLock() { this.pointerLockElement = null; (DL.pointerlockchange || []).forEach(f => f()); },
  addEventListener: (t, f) => (DL[t] ||= []).push(f), removeEventListener: (t, f) => { DL[t] = (DL[t] || []).filter(x => x !== f); },
};
canvas.requestPointerLock = () => { document_.pointerLockElement = canvas; (DL.pointerlockchange || []).forEach(f => f()); return Promise.resolve(); };
globalThis.window = globalThis;
Object.assign(globalThis, {
  document: document_, innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
  location: { protocol: 'http:', host: 'localhost:' + PORT }, ResizeObserver: class { observe() {} disconnect() {} },
  addEventListener: (t, f) => (L[t] ||= []).push(f), removeEventListener: (t, f) => { L[t] = (L[t] || []).filter(x => x !== f); },
  confirm: () => true, setTimeout, clearTimeout,
});
const mem = {}; globalThis.localStorage = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); } };
let rafCb = null; globalThis.requestAnimationFrame = (f) => { rafCb = f; return 1; }; globalThis.cancelAnimationFrame = () => { rafCb = null; };
const fire = (t, ev) => (L[t] || []).slice().forEach(f => f({ preventDefault() {}, repeat: false, ...ev }));
const origErr = console.error; console.error = (...a) => { errors.push('console.error: ' + a.map(String).join(' ')); };
process.on('unhandledRejection', (e) => errors.push('unhandledRejection: ' + (e && e.stack || e)));

// ----- servidor + cliente auxiliar (Jōnin) -----
const sent = {}; const _send = WebSocket.prototype.send; WebSocket.prototype.send = function (d) { if (!this.__raw) { try { const m = JSON.parse(d); const k = m.t + (m.kind ? ':' + m.kind : ''); sent[k] = (sent[k] || 0) + 1; } catch {} } return _send.call(this, d); };
const srv = spawn(process.execPath, ['server.js', String(PORT)], { env: { ...process.env, SW_TEST: '1' }, stdio: ['ignore', 'ignore', 'inherit'] });
await sleep(700);
function raw(name, rank) {
  return new Promise((res) => { const ws = new WebSocket(`ws://localhost:${PORT}`); ws.__raw = true; const c = { ws, id: null, snap: null, mission: null, send: (o) => ws.send(JSON.stringify(o)) };
    ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.t === 'welcome') c.id = m.id; if (m.t === 'snap') c.snap = m; if (m.t === 'mission') c.mission = m.mission; };
    ws.onopen = () => { c.send({ t: 'join', code: 'SMOKE1', char: { name, clan: 'hyuga', rank, level: 9, look: {}, tails: 0, maxHp: 100 } }); res(c); }; });
}

try {
  const { showWorlds, showChars, showCreator, initUI } = await import('../public/ui.js');
  const { newCharacter, saveChar, saveWorld, loadChars, derive } = await import('../public/store.js');
  const { defaultLook } = await import('../public/ninja.js');
  const { startGame } = await import('../public/game.js');
  initUI({ enter: () => {} });
  const world = { code: 'SMOKE1', name: 'Mundo de teste', created: Date.now(), last: Date.now() };
  saveWorld(world);
  try { showWorlds(); showChars(world); showCreator(world); ok('menus (mundos, personagens, criação) executam sem erro', true); } catch (e) { ok('menus executam sem erro', false, e.stack); }

  const char = newCharacter({ name: 'Genin Teste', clan: 'uzumaki', tails: 3, elements: ['fogo', 'raio'], look: { ...defaultLook(), hair: 'longo', outfit: 'casaco', muscle: 0.9, fat: 0.5, height: 1.1 }, rank: 0 });
  saveChar(char);
  ok('personagem salvo com clã/bijuu/elementos', loadChars()[0].clan === 'uzumaki' && loadChars()[0].tails === 3 && loadChars()[0].elements.join() === 'fogo,raio');
  const D = derive(char); ok('atributos derivados (Uzumaki 3 caudas)', D.maxHp > 100 && D.fireDmg > 28, `maxHp=${D.maxHp}, fogo=${D.fireDmg.toFixed(1)}`);

  const jonin = await raw('Jonin Aux', 2);
  let exited = false;
  const game = await startGame({ world, char, onExit: () => { exited = true; } });
  await sleep(400);
  ok('cliente do jogo entrou no mundo (welcome)', !!jonin.snap && jonin.snap.pl.length === 2, `jogadores no servidor: ${jonin.snap?.pl.length}`);
  jonin.send({ t: 'mission_accept', mid: 'm_a' });
  await sleep(300);
  ok('Jōnin aceitou missão A com Genin do jogo no grupo', jonin.mission?.state === 'active', jonin.mission?.name);
  jonin.send({ t: 'dbg_freeze_enemies' }); // comando só do modo de teste: inimigos parados (alvos) para exercitar o combate do cliente

  let frameT = performance.now();
  const frames = async (n, ms = 16) => { for (let i = 0; i < n; i++) { frameT += ms; if (rafCb) { const f = rafCb; rafCb = null; f(frameT); } await sleep(ms); } };
  fire('mousedown', { button: 0, movementX: 0 }); // captura o ponteiro
  await frames(5);
  const key = (code, down = true) => fire(down ? 'keydown' : 'keyup', { code });
  await frames(200);                       // nasce na praça de Konoha                       // sai da sala e anda pela vila
  const me = () => jonin.snap?.pl.find(p => p.id !== jonin.id);
  const z1 = me()?.p[2]; ok('personagem nasce na praça de Konoha', Math.abs(z1 - -1295) < 3, `z=${z1?.toFixed(1)}`);
  key('Space'); await frames(6); key('Space', false); key('Space'); await frames(6); key('Space', false); // pulo duplo
  key('KeyC'); await frames(20);          // dash
  key('KeyS', false); key('ShiftLeft', false); await frames(60);
  const p2 = me()?.p; ok('chega ao campo de bandidos (~38 m da praça)', Math.hypot(p2[0] - 241, p2[2] + 1295) < 60, `pos=${p2?.map(v => v.toFixed(1))}`);
  key('KeyW', false); key('ShiftLeft', false);
  // caminha até o inimigo mais próximo (parado) girando a câmera com eventos de mouse, depois luta
  let yawT = 0;
  const nearest = () => { const m = me(); let best = null, bd = 1e9; for (const e of (jonin.snap?.en || [])) { const d = Math.hypot(e.p[0] - m.p[0], e.p[2] - m.p[2]); if (d < bd) { bd = d; best = e; } } return { e: best, d: bd, m }; };
  const face = (e, m) => { const want = Math.atan2(e.p[0] - m.p[0], e.p[2] - m.p[2]); const delta = ((want - yawT + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; fire('mousemove', { movementX: -delta / 0.0022, movementY: 0 }); yawT += delta; };
  for (let i = 0; i < 200; i++) { const n = nearest(); if (!n.e || n.d < 1.8) break; face(n.e, n.m); key('KeyW'); await frames(3); }
  key('KeyW', false);
  for (let i = 0; i < 6; i++) { const n = nearest(); if (n.e) face(n.e, n.m); fire('mousedown', { button: 0 }); await frames(30); fire('mousedown', { button: 2 }); await frames(45); key('KeyF'); await frames(50); }
  const en = jonin.snap?.en || [];
  console.log('mensagens enviadas pelo cliente do jogo:', JSON.stringify(sent));
  ok('cliente enviou socos/chutes/bolas de fogo', (sent['hit:punch'] || 0) + (sent['hit:kick'] || 0) > 0 && (sent.fire || 0) > 0, JSON.stringify(sent));
  ok('inimigos (parados) sofreram dano causado pelo jogador', en.length < 7 || en.some(e => e.hp < e.mhp), `inimigos=${en.length}, hps=${en.map(e => e.hp + '/' + e.mhp).join(' ')}`);

  // Jōnin termina a missão
  for (let g = 0; g < 80 && jonin.mission?.state === 'active'; g++) { const e = (jonin.snap?.en || [])[0]; if (!e) { await frames(5); continue; } jonin.send({ t: 'dbg_set_pos', p: [e.p[0] + 1, 0, e.p[2]] }); await frames(3); jonin.send({ t: 'hit', id: e.id, kind: 'punch', dmg: 150 }); await frames(8); }
  await frames(40);
  ok('missão compartilhada concluída', jonin.mission?.state === 'done', jonin.mission?.state);
  ok('Genin do jogo recebeu XP individual (400) e continua Genin', char.xp === 400 && char.rank === 0, `xp=${char.xp}, rank=${char.rank}`);
  ok('XP salvo no personagem persistido', loadChars()[0].xp === 400);

  // painéis
  const api = null;
  key('KeyK'); await frames(3);
  ok('nenhuma exceção no laço do jogo', errors.filter(e => e.startsWith('console.error')).length === 0, errors.filter(e => e.startsWith('console.error')).slice(0, 3).join(' | ').slice(0, 400));
  game.dispose(); jonin.ws.close();
} catch (e) { ok('execução do smoke test', false, e.stack); }

console.log(results.join('\n'));
const real = errors.filter(e => !results.some(r => r.includes(e)));
if (real.length) console.log('\nErros capturados:\n' + real.slice(0, 8).join('\n'));
console.log(errors.length ? '\nSmoke test: FALHAS' : '\nSmoke test: ok');
srv.kill(); process.exit(errors.length ? 1 : 0);
