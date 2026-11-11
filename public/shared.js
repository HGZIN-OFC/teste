// Dados compartilhados entre cliente (navegador) e servidor (Node).
// Tudo aqui é puro (sem DOM, sem three.js).

import { ARENA_BOUNDS } from './terrain.js';

export const MAX_PLAYERS = 4;

export const RANKS = ['Genin', 'Chūnin', 'Jōnin'];

export const CLANS = {
  uchiha: { name: 'Uchiha', desc: 'Sharingan: bola de fogo +25% de dano e menos custo de chakra.' },
  hyuga: { name: 'Hyuga', desc: 'Byakugan (tecla V): enxerga inimigos através de paredes. Socos +20%.' },
  uzumaki: { name: 'Uzumaki', desc: 'Vitalidade: +HP e regeneração de chakra. Escolha uma bijuu de 1 a 9 caudas.' },
};

export const ELEMENTS = {
  fogo: { name: 'Fogo', desc: 'Bola de fogo +25% de dano.' },
  raio: { name: 'Raio', desc: 'Socos e chutes têm chance de atordoar o alvo.' },
  vento: { name: 'Vento', desc: 'Dash custa 25% menos stamina.' },
  terra: { name: 'Terra', desc: 'Recebe 12% menos dano.' },
  agua: { name: 'Água', desc: 'Chakra regenera 30% mais rápido.' },
};

// Níveis: XP total para chegar ao nível L = 50 * L * (L-1)
export const MAX_LEVEL = 20;
export function xpForLevel(l) { return 50 * l * (l - 1); }
export function levelFromXp(xp) {
  let l = 1;
  while (l < MAX_LEVEL && xp >= xpForLevel(l + 1)) l++;
  return l;
}
// Promoção só acontece pedindo ao Hokage (nunca automática).
export const PROMOTION = [null, { level: 4 }, { level: 8 }]; // para chegar ao rank índice 1 e 2
export function canPromote(rank, level) {
  const req = PROMOTION[rank + 1];
  return !!req && level >= req.level;
}

// Árvore de habilidades inicial. Cada nó tem efeito real no jogo (ver game.js).
export const SKILLS = {
  // nomes inspirados no Naruto Shippuden (ids mantidos para não quebrar saves)
  nin_chakra: { tree: 'Ninjutsu', name: 'Kage Bunshin no Jutsu', cost: 1, req: null, desc: 'Reservas de chakra ampliadas: +25 de chakra máximo.' },
  nin_fire2: { tree: 'Ninjutsu', name: 'Goukakyuu no Jutsu', cost: 2, req: 'nin_chakra', desc: 'Bola de fogo "Grande Bola de Fogo": +40% de dano e maior.' },
  nin_burn: { tree: 'Ninjutsu', name: 'Katon: Chamas Persistentes', cost: 2, req: 'nin_fire2', desc: 'Queimadura dura mais e causa mais dano.' },
  gen_fear: { tree: 'Genjutsu', name: 'Tsukuyomi (tecla R)', cost: 1, req: null, desc: 'Prende o inimigo em ilusão por 3s, em 8m. Custa 30 de chakra.' },
  gen_fear2: { tree: 'Genjutsu', name: 'Tsukuyomi Expandido', cost: 2, req: 'gen_fear', desc: 'Alcance 12m e duração 5s.' },
  gen_focus: { tree: 'Genjutsu', name: 'Kai: Concentração', cost: 2, req: 'gen_fear', desc: 'Dissolve a mente e recupera chakra: regeneração +40%.' },
  tai_punch: { tree: 'Taijutsu', name: 'Punho de Tsunade', cost: 1, req: null, desc: 'Socos com força de Tsunade: +25% de dano.' },
  tai_kick: { tree: 'Taijutsu', name: 'Konoha Senpū', cost: 2, req: 'tai_punch', desc: 'Chute giratório "Vento de Konoha": +30% de dano.' },
  tai_dash: { tree: 'Taijutsu', name: 'Shunshin no Jutsu', cost: 1, req: null, desc: 'Passo instantâneo: dash e pulo duplo gastam 35% menos stamina.' },
  tai_stam: { tree: 'Taijutsu', name: 'Hachimon: Primeiro Portão', cost: 2, req: 'tai_dash', desc: 'Abre o primeiro portão interno: +30 de stamina máxima.' },
};

// Mundo: Konoha do mapa Naruto (1 bloco = 1 m). O terreno e as estruturas vêm de /mundo (ver terrain.js).
// spawn/fieldCenter são x,z; a altura (y) é sempre calculada pelo terreno.
export const WORLD = {
  spawn: [201, 0, -1295],          // praça no centro da vila (mapa .glb novo)
  fieldCenter: [241, 0, -1295],    // campo aberto a ~40 m da praça (onde os bandidos aparecem)
  arena: ARENA_BOUNDS,             // limites do mundo jogável (3 x 3 regiões)
};

export const MISSIONS = {
  m_d: {
    id: 'm_d', rank: 0, name: 'Patrulha do Portão', xp: 80,
    desc: 'Bandidos rondam o portão sul. Derrote 4 deles.',
    spawn: [['bandit', 4]],
  },
  m_b: {
    id: 'm_b', rank: 1, name: 'Emboscada na Estrada', xp: 180,
    desc: 'Bandidos e atiradores de fogo. Derrote 6 inimigos.',
    spawn: [['bandit', 4], ['firebandit', 2]],
  },
  m_a: {
    id: 'm_a', rank: 2, name: 'Caça ao Chefe Bandido', xp: 400,
    desc: 'Missão de Jōnin. Elimine o chefe e seu bando.',
    spawn: [['bandit', 4], ['firebandit', 2], ['boss', 1]],
  },
};

export const ENEMY_TYPES = {
  bandit: { name: 'Bandido', hp: 60, speed: 4.2, dmg: 8, range: 2.2, cd: 1.1, scale: 1 },
  firebandit: { name: 'Bandido do Fogo', hp: 45, speed: 3.4, dmg: 0, range: 18, cd: 3.2, scale: 1 },
  boss: { name: 'Chefe Bandido', hp: 320, speed: 3.6, dmg: 16, range: 2.8, cd: 1.4, scale: 1.45 },
};

// Regra de rank: o jogador pode participar se ele mesmo tem rank suficiente
// OU se há um companheiro com rank suficiente no grupo. Nunca promove sozinho.
export function canJoinMission(playerRank, missionRank, otherRanks) {
  if (playerRank >= missionRank) return true;
  return otherRanks.some(r => r >= missionRank);
}
