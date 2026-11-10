// Persistência local (localStorage) de mundos e personagens + atributos derivados.
import { levelFromXp, SKILLS } from './shared.js';

const K_CHARS = 'sw_chars_v1', K_WORLDS = 'sw_worlds_v1', K_SET = 'sw_settings_v1';
const rd = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const wr = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* quota */ } };

export const loadChars = () => rd(K_CHARS, []);
export const saveChars = (a) => wr(K_CHARS, a);
export function saveChar(c) { const a = loadChars(); const i = a.findIndex(x => x.id === c.id); if (i >= 0) a[i] = c; else a.push(c); saveChars(a); }
export function deleteChar(id) { saveChars(loadChars().filter(c => c.id !== id)); }
export const loadWorlds = () => rd(K_WORLDS, []);
export const saveWorlds = (a) => wr(K_WORLDS, a);
export function saveWorld(w) { const a = loadWorlds(); const i = a.findIndex(x => x.code === w.code); if (i >= 0) a[i] = { ...a[i], ...w }; else a.push(w); saveWorlds(a); }
export function deleteWorld(code) { saveWorlds(loadWorlds().filter(w => w.code !== code)); }

export const DEFAULT_SETTINGS = {
  master: 0.7, sfx: 0.8, music: 0.4, quality: 'media', sens: 1.0, fov: 70,
  keys: { forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', run: 'ShiftLeft', dash: 'KeyC', fire: 'KeyF', fear: 'KeyR', interact: 'KeyE', cloak: 'KeyQ', byakugan: 'KeyV', skills: 'KeyK' },
};
export function loadSettings() { const s = rd(K_SET, {}); return { ...DEFAULT_SETTINGS, ...s, keys: { ...DEFAULT_SETTINGS.keys, ...(s.keys || {}) } }; }
export const saveSettings = (s) => wr(K_SET, s);

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function genCode() { let s = 'KNH-'; for (let i = 0; i < 4; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]; return s; }
export const uid = () => Math.random().toString(36).slice(2, 10);

export function newCharacter({ name, clan, tails, elements, look, rank }) {
  return { id: uid(), name, clan, tails: clan === 'uzumaki' ? tails : 0, elements, look, rank: rank | 0, xp: 0, skills: [], created: Date.now() };
}

export function spentPoints(c) { return (c.skills || []).reduce((s, k) => s + (SKILLS[k]?.cost || 0), 0); }
export function skillPoints(c) { return Math.max(0, levelFromXp(c.xp) - 1 - spentPoints(c)); }

// Todos os números de gameplay derivados do personagem (clã, elementos, nível, habilidades)
export function derive(c) {
  const lv = levelFromXp(c.xp), has = (k) => (c.skills || []).includes(k), el = (k) => (c.elements || []).includes(k);
  const uch = c.clan === 'uchiha', hyu = c.clan === 'hyuga', uzu = c.clan === 'uzumaki', tl = c.tails || 0;
  const lvm = 1 + 0.05 * (lv - 1);
  return {
    level: lv,
    maxHp: Math.round(100 + (lv - 1) * 6 + (uzu ? 25 + tl * 4 : 0)),
    maxChakra: 100 + (lv - 1) * 4 + (has('nin_chakra') ? 25 : 0),
    maxStam: 100 + (has('tai_stam') ? 30 : 0),
    chakraRegen: 6 * (el('agua') ? 1.3 : 1) * (has('gen_focus') ? 1.4 : 1) * (uzu ? 1.25 + tl * 0.03 : 1),
    fireDmg: 28 * lvm * (uch ? 1.25 : 1) * (el('fogo') ? 1.25 : 1) * (has('nin_fire2') ? 1.4 : 1),
    fireBig: has('nin_fire2'),
    fireCost: Math.round(25 * (uch ? 0.8 : 1)),
    burnSecs: has('nin_burn') ? 5 : 3, burnDps: (has('nin_burn') ? 5 : 3) * (el('fogo') ? 1.25 : 1),
    punchDmg: 10 * lvm * (has('tai_punch') ? 1.25 : 1) * (hyu ? 1.2 : 1),
    kickDmg: 16 * lvm * (has('tai_kick') ? 1.3 : 1) * (hyu ? 1.1 : 1),
    stunChance: el('raio') ? 0.25 : 0,
    taken: el('terra') ? 0.88 : 1,
    dashCost: Math.round(20 * (el('vento') ? 0.75 : 1) * (has('tai_dash') ? 0.65 : 1)),
    jumpCost: Math.round(18 * (has('tai_dash') ? 0.65 : 1)),
    fearR: has('gen_fear2') ? 12 : 8, fearDur: has('gen_fear2') ? 5 : 3, hasFear: has('gen_fear'),
    cloakBonus: uzu ? 1 + 0.05 * tl : 1,
  };
}

// Stickers originais (SVG desenhado aqui; sem arte oficial)
export function sticker(name, size = 54) {
  const S = {
    shuriken: '<polygon points="32,2 38,26 62,32 38,38 32,62 26,38 2,32 26,26" fill="#cfd6e4" stroke="#14142b" stroke-width="3" stroke-linejoin="round"/><circle cx="32" cy="32" r="6" fill="#14142b"/>',
    swirl: '<circle cx="32" cy="32" r="28" fill="#ff8a1f" stroke="#fff" stroke-width="4"/><path d="M32 32 m0 0 a4 4 0 0 1 8 0 a9 9 0 0 1 -18 0 a14 14 0 0 1 28 0 a19 19 0 0 1 -38 0" fill="none" stroke="#14142b" stroke-width="4" stroke-linecap="round"/>',
    flame: '<path d="M32 4 C40 18 52 24 50 40 C48 54 38 60 32 60 C24 60 14 54 14 42 C14 34 20 30 22 22 C26 28 28 30 30 30 C28 22 28 12 32 4Z" fill="#ff5a1f" stroke="#14142b" stroke-width="3"/><path d="M32 30 C36 38 42 40 40 48 C38 55 34 56 32 56 C28 56 24 52 25 46 C26 40 30 38 32 30Z" fill="#ffd23f"/>',
    scroll: '<rect x="12" y="8" width="40" height="48" rx="4" fill="#fdf6e3" stroke="#14142b" stroke-width="3"/><rect x="8" y="4" width="48" height="9" rx="4" fill="#c03a2b" stroke="#14142b" stroke-width="3"/><rect x="8" y="51" width="48" height="9" rx="4" fill="#c03a2b" stroke="#14142b" stroke-width="3"/><path d="M20 24h24M20 32h24M20 40h16" stroke="#14142b" stroke-width="3" stroke-linecap="round"/>',
    ramen: '<path d="M6 30h52c0 16-10 26-26 26S6 46 6 30Z" fill="#fdf6e3" stroke="#14142b" stroke-width="3"/><path d="M12 30c4-8 8-8 12 0s8 8 12 0 8-8 12 0" fill="none" stroke="#ffd23f" stroke-width="4"/><circle cx="24" cy="24" r="6" fill="#fff" stroke="#14142b" stroke-width="2"/><path d="M40 8l-12 20M46 10l-12 20" stroke="#8a5a2b" stroke-width="3" stroke-linecap="round"/>',
    kunai: '<path d="M32 2 L40 22 L34 26 L34 44 L30 44 L30 26 L24 22Z" fill="#cfd6e4" stroke="#14142b" stroke-width="3" stroke-linejoin="round"/><rect x="29" y="44" width="6" height="12" fill="#2b3a67" stroke="#14142b" stroke-width="2"/><circle cx="32" cy="60" r="3.5" fill="none" stroke="#14142b" stroke-width="3"/>',
    uchiha: '<circle cx="32" cy="32" r="28" fill="#c8281e" stroke="#fff" stroke-width="4"/><path d="M20 58 L32 22 L44 58Z" fill="#f4f0e6"/>',
    hyuga: '<circle cx="32" cy="32" r="28" fill="#e8e4f6" stroke="#fff" stroke-width="4"/><circle cx="32" cy="32" r="18" fill="none" stroke="#6a60b8" stroke-width="5"/><path d="M32 14v36M14 32h36" stroke="#6a60b8" stroke-width="4"/>',
    uzumaki: '<circle cx="32" cy="32" r="28" fill="#ff8a1f" stroke="#fff" stroke-width="4"/><path d="M32 32 m0 0 a4 4 0 0 1 8 0 a9 9 0 0 1 -18 0 a14 14 0 0 1 28 0 a19 19 0 0 1 -38 0" fill="none" stroke="#c8281e" stroke-width="4" stroke-linecap="round"/>',
  };
  return `<svg class="stk" width="${size}" height="${size}" viewBox="0 0 64 64">${S[name] || S.shuriken}</svg>`;
}
