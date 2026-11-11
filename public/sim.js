// Simulação do mundo (salas, missões, inimigos, combate). Roda no servidor Node (multiplayer) e no navegador (modo solo).
import { MAX_PLAYERS, WORLD, MISSIONS, ENEMY_TYPES, canJoinMission, RANKS } from './shared.js';

// conn = { send(obj), player: null }
// terrain: createTerrain() já com as regiões carregadas (ver terrain.js / terrain-node.js)
export function createSim({ terrain, testMode = false, log = () => {} } = {}) {
  if (!terrain) throw new Error('createSim precisa do terreno (terrain)');
  const TEST_MODE = testMode;
  const spawnPos = () => { const x = WORLD.spawn[0], z = WORLD.spawn[2]; return [x, terrain.groundAt(x, z, 0), z]; };
// ---------- Salas (mundos) ----------
const rooms = new Map();
let uid = 1;

function newRoom(code) {
  return { code, players: new Map(), enemies: new Map(), enemyId: 1, mission: null, fz: [], fb: [], t: 0, doneAt: 0 };
}
const sendTo = (p, o) => p.conn.send(o);
const bcast = (room, o, except) => { for (const p of room.players.values()) if (p !== except) sendTo(p, o); };
const pub = (p) => ({ id: p.id, name: p.name, clan: p.char.clan, rank: p.char.rank, level: p.char.level, look: p.char.look, tails: p.char.tails });

function onMessage(conn, text) {
  let m = text; if (typeof text === 'string') { try { m = JSON.parse(text); } catch { return; } }
  if (!m || typeof m.t !== 'string') return;
  if (m.t === 'join') return handleJoin(conn, m);
  const p = conn.player; if (!p) return;
  const room = p.room;
  switch (m.t) {
    case 'state': {
      if (!Array.isArray(m.p) || m.p.length !== 3 || !m.p.every(Number.isFinite)) return;
      p.pos = m.p; p.cl = !!m.cl; p.ry = +m.ry || 0; p.an = String(m.an || 'idle').slice(0, 16);
      if (Number.isFinite(m.maxHp) && m.maxHp > 0 && m.maxHp < 500) p.maxHp = m.maxHp;
      break;
    }
    case 'fire': { // projétil de jogador: simulado no cliente; servidor só retransmite o efeito
      if (p.dead || !Array.isArray(m.p) || !Array.isArray(m.d)) return;
      bcast(room, { t: 'fx', k: 'fire', id: p.id, p: m.p, d: m.d, big: !!m.big }, p);
      break;
    }
    case 'fireground': { // fogo no chão deixado por jogador: NÃO fere aliados
      if (p.dead || !Array.isArray(m.p) || !m.p.every(Number.isFinite)) return;
      if (room.t - p.lastZone < 0.5) return; p.lastZone = room.t;
      room.fz.push({ p: [m.p[0], 0, m.p[2]], until: room.t + 4, owner: { kind: 'player', id: p.id }, r: 2.4 });
      break;
    }
    case 'heal': { // ramen: cura limitada por tempo (recarga de 20s)
      if (p.dead || room.t - (p.lastHeal ?? -99) < 20) return; p.lastHeal = room.t;
      p.hp = Math.min(p.maxHp, p.hp + 40); break;
    }
    case 'rank': { // promoção pedida ao Hokage (o cliente valida nível; servidor só aceita +1 por vez)
      const r = m.rank | 0; if (r === p.char.rank + 1 && r <= 2) p.char.rank = r; break;
    }
    case 'hit': return handleHit(room, p, m);
    case 'ability': return handleAbility(room, p, m);
    case 'mission_accept': return acceptMission(room, p, m.mid);
    case 'mission_abandon': if (room.mission) { room.mission.failed = true; endMission(room, false, 'Missão abandonada.'); } break;
    case 'dbg_enemy_zone': // só em modo de teste: prova que queimadura de inimigo ainda funciona
      if (TEST_MODE && Array.isArray(m.p)) room.fz.push({ p: [m.p[0], 0, m.p[2]], until: room.t + 4, owner: { kind: 'enemy' }, r: 2.4 });
      break;
    case 'dbg_freeze_enemies': // só em modo de teste: inimigos viram alvos parados
      if (TEST_MODE) for (const e of room.enemies.values()) e.stun = 1e9;
      break;
    case 'dbg_set_pos':
      if (TEST_MODE && Array.isArray(m.p)) { p.pos = m.p; }
      break;
  }
}

function handleJoin(conn, m) {
  if (conn.player) return;
  const code = String(m.code || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16);
  const c = m.char;
  if (!code || !c || typeof c !== 'object') return conn.send({ t: 'error', msg: 'Dados de entrada inválidos.' });
  let room = rooms.get(code);
  if (!room) { room = newRoom(code); rooms.set(code, room); }
  if (room.players.size >= MAX_PLAYERS) return conn.send({ t: 'error', msg: 'Mundo cheio (máximo de 4 jogadores).' });
  const rank = Math.max(0, Math.min(2, c.rank | 0));
  const p = {
    id: uid++, conn, room, name: String(c.name || 'Ninja').slice(0, 16),
    char: { clan: String(c.clan || 'uchiha'), rank, level: Math.max(1, Math.min(20, c.level | 0 || 1)), look: c.look || {}, tails: c.tails | 0 },
    pos: spawnPos(), ry: 0, an: 'idle', hp: 100, maxHp: Math.min(499, Math.max(50, +c.maxHp || 100)),
    dead: false, respawnAt: 0, invuln: 0, burn: null, lastHit: 0, lastAbility: -99, lastZone: -99, ffBlocked: 0,
  };
  p.hp = p.maxHp;
  conn.player = p; room.players.set(p.id, p);
  sendTo(p, {
    t: 'welcome', id: p.id, code, mission: missionPub(room), maxPlayers: MAX_PLAYERS,
    players: [...room.players.values()].filter(q => q !== p).map(pub),
  });
  bcast(room, { t: 'joined', player: pub(p) }, p);
  log(`[${code}] ${p.name} (${RANKS[rank]}) entrou — ${room.players.size}/${MAX_PLAYERS}`);
}

function onClose(conn) {
  const p = conn.player; if (!p) return;
  conn.player = null;
  const room = p.room; room.players.delete(p.id);
  bcast(room, { t: 'left', id: p.id });
  log(`[${room.code}] ${p.name} saiu — ${room.players.size}/${MAX_PLAYERS}`);
  if (room.mission && room.mission.participants) {
    room.mission.participants.delete(p.id);
    const ranks = [...room.players.values()].map(q => q.char.rank);
    if (room.mission.active && (ranks.length === 0 || Math.max(...ranks) < room.mission.def.rank)) {
      endMission(room, false, 'Sem ninja qualificado no grupo. Missão cancelada.');
    }
  }
  if (room.players.size === 0) rooms.delete(room.code);
}

// ---------- Missões ----------
function missionPub(room) {
  const m = room.mission; if (!m) return null;
  return { id: m.def.id, name: m.def.name, desc: m.def.desc, rank: m.def.rank, need: m.need, kills: m.kills, state: m.active ? 'active' : m.state, xp: m.def.xp };
}
function acceptMission(room, p, mid) {
  const def = MISSIONS[mid];
  if (!def) return;
  if (room.mission && room.mission.active) return sendTo(p, { t: 'notice', msg: 'Já existe uma missão ativa neste mundo.' });
  const others = [...room.players.values()].filter(q => q !== p).map(q => q.char.rank);
  if (!canJoinMission(p.char.rank, def.rank, others)) {
    return sendTo(p, { t: 'notice', msg: `Missão de ${RANKS[def.rank]}: precisa de um ${RANKS[def.rank]} (ou superior) no grupo.` });
  }
  room.mission = { def, active: true, state: 'active', kills: 0, need: 0, participants: new Set([...room.players.keys()]), leaderRank: Math.max(p.char.rank, ...others, 0) };
  room.enemies.clear(); room.fb = [];
  for (const [type, n] of def.spawn) for (let i = 0; i < n; i++) spawnEnemy(room, type, i);
  room.mission.need = room.enemies.size;
  bcast(room, { t: 'mission', mission: missionPub(room) });
  bcast(room, { t: 'notice', msg: `Missão aceita por ${p.name}: ${def.name}` });
}
function spawnEnemy(room, type, i) {
  const c = WORLD.fieldCenter; const ang = Math.random() * Math.PI * 2; const rad = 3 + Math.random() * 5;   // bandidos nascem agrupados no campo (3 a 8 m do centro)
  const id = room.enemyId++; const T = ENEMY_TYPES[type];
  const ex = c[0] + Math.cos(ang) * rad, ez = c[2] + Math.sin(ang) * rad;
  room.enemies.set(id, { id, type, p: [ex, terrain.groundAt(ex, ez, 0), ez], ry: 0, hp: T.hp, maxHp: T.hp, cd: 1 + Math.random(), stun: 0, burn: null, hurtBy: new Set() });
}
function endMission(room, success, msg) {
  const m = room.mission; if (!m) return;
  m.active = false; m.state = success ? 'done' : 'failed';
  if (success) {
    for (const id of m.participants) {
      const p = room.players.get(id); if (!p) continue;
      // XP individual: cada personagem recebe a sua; o rank NÃO muda aqui.
      sendTo(p, { t: 'reward', xp: m.def.xp, mission: m.def.name, rankKept: p.char.rank, underRanked: p.char.rank < m.def.rank });
    }
  }
  room.enemies.clear(); room.fb = [];
  bcast(room, { t: 'mission', mission: missionPub(room) });
  if (msg) bcast(room, { t: 'notice', msg });
  room.doneAt = room.t;
}

// ---------- Combate ----------
const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
function handleHit(room, p, m) {
  // Qualquer tentativa de ferir outro jogador é descartada (fogo amigo desativado).
  if (m.pid != null || m.target === 'player' || m.kind === 'pvp') {
    p.ffBlocked++; return sendTo(p, { t: 'notice', code: 'ff_blocked', msg: 'Fogo amigo desativado.' });
  }
  if (p.dead) return;
  const e = room.enemies.get(m.id); if (!e || e.hp <= 0) return;
  const kind = m.kind === 'fire' ? 'fire' : m.kind === 'kick' ? 'kick' : 'punch';
  const reach = kind === 'fire' ? 45 : 6;
  if (dist2(p.pos, e.p) > reach) return;
  const now = room.t;
  if (kind !== 'fire' && now - p.lastHit < 0.12) return;
  if (kind !== 'fire') p.lastHit = now;
  const dmg = Math.max(1, Math.min(150, +m.dmg || 1));
  e.hp -= dmg; e.hurtBy.add(p.id);
  if (kind === 'fire') {
    e.burn = { until: now + (+m.burn || 3), dps: +m.burnDps || 3, src: { kind: 'player', id: p.id }, next: now + 1 };
    room.fz.push({ p: [e.p[0], 0, e.p[2]], until: now + 3, owner: { kind: 'player', id: p.id }, r: 2 });
  }
  if (m.stun) e.stun = Math.max(e.stun, Math.min(2, +m.stun));
  bcast(room, { t: 'fx', k: 'hit', p: e.p, kind, dmg });
  checkEnemyDeath(room, e);
}
function handleAbility(room, p, m) {
  if (p.dead || m.k !== 'fear') return;
  if (room.t - p.lastAbility < 3.5) return; p.lastAbility = room.t;
  const r = Math.min(12, +m.r || 8), dur = Math.min(5, +m.dur || 3);
  for (const e of room.enemies.values()) if (dist2(p.pos, e.p) <= r) e.stun = Math.max(e.stun, dur);
  bcast(room, { t: 'fx', k: 'fear', p: p.pos, r });
}
function checkEnemyDeath(room, e) {
  if (e.hp > 0 || !room.enemies.has(e.id)) return;
  room.enemies.delete(e.id);
  bcast(room, { t: 'fx', k: 'death', p: e.p, type: e.type });
  const mis = room.mission;
  if (mis && mis.active) {
    mis.kills++;
    if (room.enemies.size === 0) { mis.kills = mis.need; endMission(room, true, 'Missão concluída!'); }
    else bcast(room, { t: 'mission', mission: missionPub(room) });
  }
}

// Único caminho para ferir jogadores. Fonte "player" é SEMPRE recusada.
function damagePlayer(room, p, amount, src) {
  if (!src || src.kind === 'player') return false;
  if (p.dead || p.invuln > room.t) return false;
  p.hp -= amount;
  sendTo(p, { t: 'hurt', dmg: amount });
  if (p.hp <= 0) { p.hp = 0; p.dead = true; p.respawnAt = room.t + 4; p.burn = null; bcast(room, { t: 'fx', k: 'playerdown', id: p.id }); }
  return true;
}
function burnPlayer(room, p, src, secs, dps) {
  if (!src || src.kind === 'player') return false; // queimadura causada por aliado: ignorada
  p.burn = { until: room.t + secs, dps, src, next: room.t + 1 };
  return true;
}

// ---------- Simulação ----------
const DT = 0.05;
function tick() {
  for (const room of rooms.values()) {
    room.t += DT;
    const t = room.t;
    const alive = [...room.players.values()].filter(p => !p.dead);
    // jogadores: respawn, regeneração, queimadura
    for (const p of room.players.values()) {
      if (p.dead && t >= p.respawnAt) { p.dead = false; p.hp = p.maxHp; p.pos = spawnPos(); p.invuln = t + 2.5; bcast(room, { t: 'fx', k: 'respawn', id: p.id }); }
      if (!p.dead && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + 0.6 * DT);
      if (p.burn) {
        if (p.burn.src.kind === 'player') p.burn = null; // defesa extra
        else if (t >= p.burn.until) p.burn = null;
        else if (t >= p.burn.next) { p.burn.next += 1; damagePlayer(room, p, p.burn.dps, p.burn.src); }
      }
    }
    // zonas de fogo
    room.fz = room.fz.filter(z => z.until > t);
    for (const z of room.fz) {
      for (const p of alive) {
        if (dist2(p.pos, z.p) < z.r && p.pos[1] < 3) {
          if (z.owner.kind === 'player') { /* fogo amigo desativado: aliados ignoram */ continue; }
          if (!p.burn) burnPlayer(room, p, z.owner, 3, 2);
        }
      }
      for (const e of room.enemies.values()) {
        if (z.owner.kind === 'player' && dist2(e.p, z.p) < z.r && !e.burn) e.burn = { until: t + 2, dps: 2, src: z.owner, next: t + 1 };
      }
    }
    // inimigos
    for (const e of [...room.enemies.values()]) {
      const T = ENEMY_TYPES[e.type];
      if (e.burn) {
        if (t >= e.burn.until) e.burn = null;
        else if (t >= e.burn.next) { e.burn.next += 1; e.hp -= e.burn.dps; e.hurtBy.add(e.burn.src.id); if (e.hp <= 0) { checkEnemyDeath(room, e); continue; } }
      }
      if (e.stun > 0) { e.stun -= DT; continue; }
      let tgt = null, bd = 38;
      for (const p of alive) { const d = dist2(p.pos, e.p); if (d < bd) { bd = d; tgt = p; } }
      e.cd -= DT;
      if (!tgt) continue;
      const dx = tgt.pos[0] - e.p[0], dz = tgt.pos[2] - e.p[2], d = Math.hypot(dx, dz) || 1;
      e.ry = Math.atan2(dx, dz);
      const keep = e.type === 'firebandit' ? 12 : T.range * 0.8;
      if (d > keep) {
        const sp = T.speed * DT;
        // anda na direção do alvo; se bater numa estrutura, desliza pelo eixo livre
        const tx = e.p[0] + dx / d * sp, tz = e.p[2] + dz / d * sp;
        if (!terrain.blockedAt(tx, e.p[1], tz)) { e.p[0] = tx; e.p[2] = tz; }
        else if (!terrain.blockedAt(tx, e.p[1], e.p[2])) e.p[0] = tx;
        else if (!terrain.blockedAt(e.p[0], e.p[1], tz)) e.p[2] = tz;
        e.p[1] = terrain.groundAt(e.p[0], e.p[2], e.p[1]);
      }
      if (e.type === 'firebandit') {
        if (d < T.range && e.cd <= 0) {
          e.cd = T.cd;
          const dir = [dx / d, 0, dz / d];
          room.fb.push({ id: room.enemyId++, p: [e.p[0], e.p[1] + 1.4, e.p[2]], v: [dir[0] * 14, 0, dir[2] * 14], ttl: 3 });
        }
      } else if (d < T.range + 0.3 && e.cd <= 0) {
        e.cd = T.cd;
        damagePlayer(room, tgt, T.dmg, { kind: 'enemy', id: e.id });
        bcast(room, { t: 'fx', k: 'swing', p: e.p });
      }
    }
    // bolas de fogo inimigas
    room.fb = room.fb.filter(b => {
      b.p[0] += b.v[0] * DT; b.p[2] += b.v[2] * DT; b.ttl -= DT;
      for (const p of alive) {
        if (Math.hypot(p.pos[0] - b.p[0], p.pos[2] - b.p[2]) < 1.2 && Math.abs((p.pos[1] + 1) - b.p[1]) < 1.8) {
          damagePlayer(room, p, 9, { kind: 'enemy' }); burnPlayer(room, p, { kind: 'enemy' }, 3, 2);
          room.fz.push({ p: [b.p[0], 0, b.p[2]], until: t + 3, owner: { kind: 'enemy' }, r: 1.8 });
          return false;
        }
      }
      return b.ttl > 0;
    });
    // limpa missão concluída depois de um tempo
    if (room.mission && !room.mission.active && t - room.doneAt > 8) { room.mission = null; bcast(room, { t: 'mission', mission: null }); }
    // snapshot (20 Hz)
    const snap = {
      t: 'snap',
      pl: [...room.players.values()].map(p => ({ id: p.id, p: p.pos, ry: p.ry, an: p.an, hp: Math.round(p.hp), mhp: p.maxHp, dead: p.dead, burn: !!p.burn, cl: !!p.cl })),
      en: [...room.enemies.values()].map(e => ({ id: e.id, ty: e.type, p: e.p.map(v => +v.toFixed(2)), ry: +e.ry.toFixed(2), hp: Math.round(e.hp), mhp: e.maxHp, st: e.stun > 0, bn: !!e.burn })),
      fb: room.fb.map(b => ({ id: b.id, p: b.p.map(v => +v.toFixed(2)) })),
      fz: room.fz.map(z => ({ p: z.p, r: z.r, own: z.owner.kind })),
    };
    for (const p of room.players.values()) sendTo(p, snap);
  }
}
  return { onMessage, onClose, tick, rooms, DT };
}
