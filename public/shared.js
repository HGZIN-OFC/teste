// Dados compartilhados entre cliente (navegador) e servidor (Node).
// Tudo aqui é puro (sem DOM, sem three.js).

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

// Mapa: Konoha. Unidades em metros. Vila em x,z ∈ [-70,70]; portão ao sul (z=+70).
export const WORLD = {
  villageHalf: 70,
  gateZ: 70,
  spawn: [0, 0.1, -34], // dentro da sala do Hokage
  hokage: { x: 0, z: -35, w: 22, d: 20 }, // pegada do prédio
  boardPos: [-6, 0, -41], // quadro de missões (dentro da sala)
  deskPos: [0, 0, -42], // mesa do Hokage (promoção)
  fieldCenter: [0, 0, 105], // campo fora do portão onde os bandidos aparecem
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

// Colisores (caixas) em XZ: [cx, cz, largura, profundidade]. Usados por cliente e servidor.
export function buildColliders() {
  const c = [];
  const H = WORLD.hokage;
  const t = 0.8; // espessura das paredes
  const x0 = H.x - H.w / 2, x1 = H.x + H.w / 2;
  const z0 = H.z - H.d / 2, z1 = H.z + H.d / 2; // z1 = fachada sul (porta)
  c.push([H.x, z0, H.w, t]); // fundo
  c.push([x0, H.z, t, H.d]); // oeste
  c.push([x1, H.z, t, H.d]); // leste
  const door = 4; // largura da porta
  c.push([x0 + (H.w / 2 - door / 2) / 2, z1, H.w / 2 - door / 2, t]);
  c.push([x1 - (H.w / 2 - door / 2) / 2, z1, H.w / 2 - door / 2, t]);
  // casas (decoração com colisão)
  for (const h of HOUSES) c.push([h.x, h.z, h.w, h.d]);
  // barraca de ramen (balcão)
  c.push([RAMEN.x, RAMEN.z, 4.5, 1.6]);
  // muro da vila com abertura no portão
  const hv = WORLD.villageHalf;
  c.push([0, -hv, hv * 2, 1.5]); // norte
  c.push([-hv, 0, 1.5, hv * 2]); // oeste
  c.push([hv, 0, 1.5, hv * 2]); // leste
  const gap = 12;
  c.push([-(hv + gap / 2) / 2, hv, hv - gap / 2, 1.5]);
  c.push([(hv + gap / 2) / 2, hv, hv - gap / 2, 1.5]);
  return c;
}

export const HOUSES = [
  { x: -30, z: -10, w: 10, d: 9, h: 6, color: 0xd9b48c },
  { x: -30, z: 12, w: 9, d: 9, h: 5, color: 0xc9a37a },
  { x: 30, z: -8, w: 10, d: 10, h: 6.5, color: 0xdfc29b },
  { x: 32, z: 14, w: 9, d: 8, h: 5, color: 0xcfa982 },
  { x: -46, z: 40, w: 9, d: 9, h: 5.5, color: 0xd2ab81 },
  { x: 46, z: 40, w: 10, d: 9, h: 6, color: 0xdcbb92 },
  { x: -46, z: -20, w: 8, d: 8, h: 5, color: 0xc7a078 },
  { x: 46, z: -22, w: 8, d: 9, h: 5.5, color: 0xd6b189 },
];
export const RAMEN = { x: 14, z: 6 };

// Resolve colisão círculo-vs-caixas. Retorna nova posição [x,z].
export function collide(x, z, r, colliders) {
  for (let i = 0; i < 3; i++) {
    for (const [cx, cz, w, d] of colliders) {
      const hx = w / 2 + r, hz = d / 2 + r;
      const dx = x - cx, dz = z - cz;
      if (Math.abs(dx) < hx && Math.abs(dz) < hz) {
        const px = hx - Math.abs(dx), pz = hz - Math.abs(dz);
        if (px < pz) x += dx >= 0 ? px : -px; else z += dz >= 0 ? pz : -pz;
      }
    }
  }
  return [x, z];
}

// Regra de rank: o jogador pode participar se ele mesmo tem rank suficiente
// OU se há um companheiro com rank suficiente no grupo. Nunca promove sozinho.
export function canJoinMission(playerRank, missionRank, otherRanks) {
  if (playerRank >= missionRank) return true;
  return otherRanks.some(r => r >= missionRank);
}
