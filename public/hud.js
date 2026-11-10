// HUD e painéis (pausa/configurações, habilidades, quadro de missões, promoção).
import { SKILLS, MISSIONS, RANKS, canJoinMission, canPromote, PROMOTION, levelFromXp, xpForLevel } from './shared.js';
import { sticker, skillPoints, saveChar, saveSettings } from './store.js';

const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const keyName = (c) => c.replace('Key', '').replace('Digit', '').replace('Arrow', '↑').replace('Space', 'Espaço').replace('ShiftLeft', 'Shift').replace('ControlLeft', 'Ctrl');
export const ACTIONS = [['forward', 'Frente'], ['back', 'Trás'], ['left', 'Esquerda'], ['right', 'Direita'], ['jump', 'Pular / pulo duplo'], ['run', 'Correr (segurar)'], ['dash', 'Dash (+ direção)'], ['fire', 'Bola de fogo'], ['fear', 'Tsukuyomi (Genjutsu)'], ['interact', 'Interagir'], ['cloak', 'Manto de chakra (Uzumaki)'], ['byakugan', 'Byakugan (Hyuga)'], ['skills', 'Árvore de habilidades']];

export function createHud(api) {
  const hud = document.getElementById('hud'), pause = document.getElementById('pause'), toasts = document.getElementById('toasts');
  hud.classList.remove('hidden');
  hud.innerHTML = `<div class="vignette" id="vg"></div>
   <div class="party" id="party"></div>
   <div class="mission sticker y tilt-r" id="mis"></div>
   <div class="cross"></div>
   <div class="prompt sticker o hidden" id="prompt"></div>
   <div class="who" id="who"></div>
   <div class="bars">
     <div class="bar hp"><i id="hpI"></i><span id="hpT"></span></div>
     <div class="bar ck"><i id="ckI"></i><span id="ckT"></span></div>
     <div class="bar st"><i id="stI"></i><span id="stT"></span></div>
   </div>
   <div class="keys" id="keys"></div>
   <div id="dead" class="sticker r hidden" style="position:absolute;left:50%;top:38%;transform:translateX(-50%) rotate(-2deg);font-size:28px;text-align:center"><h2 style="margin:0">Derrotado!</h2><div style="font-size:14px">Você volta à sala do Hokage em instantes…</div></div>`;
  const $ = (id) => hud.querySelector('#' + id);
  let modal = null;
  const fmt = (n) => Math.max(0, Math.round(n));

  const H = {
    get modalOpen() { return !!modal; },
    setBars(b) {
      $('hpI').style.width = (100 * b.hp / b.mhp) + '%'; $('hpT').textContent = `HP ${fmt(b.hp)}/${b.mhp}`;
      $('ckI').style.width = (100 * b.ck / b.mck) + '%'; $('ckT').textContent = `CHAKRA ${fmt(b.ck)}/${b.mck}`;
      $('stI').style.width = (100 * b.st / b.mst) + '%'; $('stT').textContent = `STAMINA ${fmt(b.st)}/${b.mst}`;
    },
    setWho(c) { const lv = levelFromXp(c.xp); $('who').textContent = `${c.name} · ${RANKS[c.rank]} · Nv ${lv}  (XP ${c.xp}/${lv >= 20 ? '—' : xpForLevel(lv + 1)})`; },
    setParty(list) {
      $('party').innerHTML = list.map(p => `<div class="sticker ${p.me ? 'y' : ''}">${esc(p.name)} <span class="badge">${RANKS[p.rank]}</span>${p.dead ? ' 💀' : ''}<div class="mini"><i style="width:${100 * p.hp / p.mhp}%"></i></div></div>`).join('');
    },
    setMission(m) {
      const el = $('mis');
      if (!m) { el.innerHTML = `<h3>Sem missão ativa</h3><div>Use o quadro de missões na sala do Hokage.</div>`; return; }
      const done = m.state === 'done', failed = m.state === 'failed';
      el.innerHTML = `<h3>${sticker('scroll', 22).replace('class="stk"', 'style="vertical-align:middle"')} ${esc(m.name)}</h3><span class="badge">Rank ${RANKS[m.rank]}</span>
       <div>${esc(m.desc)}</div><div style="margin-top:4px"><b>${done ? 'CONCLUÍDA!' : failed ? 'Cancelada' : `Inimigos: ${m.kills}/${m.need}`}</b></div>`;
    },
    setPrompt(t) { const p = $('prompt'); if (!t) p.classList.add('hidden'); else { p.classList.remove('hidden'); p.textContent = t; } },
    setDead(v) { $('dead').classList.toggle('hidden', !v); },
    hurt() { const v = $('vg'); v.classList.add('hurt'); setTimeout(() => v.classList.remove('hurt'), 180); },
    setKeys(keys) {
      $('keys').innerHTML = `WASD mover · ${keyName(keys.run)} correr · ${keyName(keys.jump)} pular (2x) · ${keyName(keys.dash)}+dir dash<br>Mouse: esq. soco · dir. chute · ${keyName(keys.fire)} bola de fogo · ${keyName(keys.fear)} ilusão<br>${keyName(keys.interact)} interagir · ${keyName(keys.skills)} habilidades · Esc menu`;
    },
    toast(html, cls = 'y', ms = 3600) {
      const t = document.createElement('div'); t.className = `sticker toast ${cls}`; t.innerHTML = html; toasts.appendChild(t); setTimeout(() => t.remove(), ms);
    },
    closeModal() { modal = null; pause.classList.add('hidden'); pause.innerHTML = ''; api.onModalClosed && api.onModalClosed(); },
    // ---------- Pausa + configurações ----------
    openPause(tab = 'audio') {
      modal = 'pause'; pause.classList.remove('hidden');
      const S = api.settings;
      const slider = (label, key, min, max, step, fmtv = v => Math.round(v * 100) + '%') => `<div class="srow"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${S[key]}" data-s="${key}"><span data-v="${key}">${fmtv(S[key])}</span></div>`;
      let body = '';
      if (tab === 'audio') body = slider('Volume geral', 'master', 0, 1, 0.01) + slider('Efeitos', 'sfx', 0, 1, 0.01) + slider('Música', 'music', 0, 1, 0.01);
      else if (tab === 'gfx') body = `<div class="seg" id="q">${[['baixa', 'Baixa'], ['media', 'Média'], ['alta', 'Alta']].map(([k, n]) => `<button class="btn sm ${S.quality === k ? 'on' : ''}" data-q="${k}">${n}</button>`).join('')}</div>
         <div class="muted">Baixa: sem sombras nem contorno, resolução reduzida. Média: sombras e contorno. Alta: sombras nítidas, resolução nativa e distância de visão maior.</div>`;
      else if (tab === 'keys') body = `<div class="muted">Clique numa tecla e pressione a nova. (Mouse: esquerdo = soco, direito = chute.)</div>` + ACTIONS.map(([k, n]) => `<div class="keyrow"><span>${n}</span><button class="btn sm" data-k="${k}">${keyName(S.keys[k])}</button></div>`).join('') + `<button class="btn r sm" id="kreset">Restaurar padrão</button>`;
      else body = slider('Sensibilidade do mouse', 'sens', 0.2, 3, 0.05, v => v.toFixed(2) + '×') + slider('Campo de visão (FOV)', 'fov', 50, 110, 1, v => Math.round(v) + '°');
      pause.innerHTML = `<div class="panel sticker"><h2>Pausa</h2><div class="tabs">${[['audio', 'Áudio'], ['gfx', 'Gráficos'], ['keys', 'Teclas'], ['aim', 'Mira / FOV']].map(([k, n]) => `<button class="btn sm ${tab === k ? 'on' : ''}" data-tab="${k}">${n}</button>`).join('')}</div>
        <div style="display:flex;flex-direction:column;gap:8px">${body}</div>
        <div class="row"><button class="btn g" id="resume">Continuar</button><button class="btn r" id="exit">Sair para o menu</button></div></div>`;
      pause.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => H.openPause(b.dataset.tab));
      pause.querySelectorAll('[data-s]').forEach(inp => inp.oninput = () => { const k = inp.dataset.s; S[k] = +inp.value; const v = pause.querySelector(`[data-v="${k}"]`); v.textContent = k === 'sens' ? S[k].toFixed(2) + '×' : k === 'fov' ? Math.round(S[k]) + '°' : Math.round(S[k] * 100) + '%'; saveSettings(S); api.applySettings(); });
      pause.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { S.quality = b.dataset.q; saveSettings(S); api.applySettings(); H.openPause('gfx'); });
      pause.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
        b.textContent = 'pressione…';
        const fn = (e) => { e.preventDefault(); e.stopPropagation(); window.removeEventListener('keydown', fn, true); if (e.code !== 'Escape') { S.keys[b.dataset.k] = e.code; saveSettings(S); api.applySettings(); } H.openPause('keys'); };
        window.addEventListener('keydown', fn, true);
      });
      const kr = pause.querySelector('#kreset'); if (kr) kr.onclick = () => { api.resetKeys(); H.openPause('keys'); };
      pause.querySelector('#resume').onclick = () => { H.closeModal(); };
      pause.querySelector('#exit').onclick = () => { H.closeModal(); api.onExit(); };
    },
    // ---------- Árvore de habilidades ----------
    openSkills() {
      modal = 'skills'; pause.classList.remove('hidden');
      const c = api.char, pts = skillPoints(c);
      const trees = ['Ninjutsu', 'Genjutsu', 'Taijutsu'], KANJI = { Ninjutsu: '忍術', Genjutsu: '幻術', Taijutsu: '体術' }, TCOL = { Ninjutsu: '#ff8a1f', Genjutsu: '#9b5de5', Taijutsu: '#2ec27e' };
      pause.innerHTML = `<div class="panel sticker"><h2>Habilidades ${sticker('shuriken', 34).replace('class="stk"', 'style="vertical-align:middle"')}</h2><div>Pontos disponíveis: <b>${pts}</b> <span class="muted">(1 por nível; o progresso é só deste personagem)</span></div>
       <div class="skills">${trees.map(t => `<div><h3 style="color:${TCOL[t]};text-shadow:2px 2px 0 #14142b">${t} <span style="font-family:'Yu Gothic',sans-serif">${KANJI[t]}</span></h3>${Object.entries(SKILLS).filter(([, s]) => s.tree === t).map(([id, s]) => {
        const have = c.skills.includes(id), reqOk = !s.req || c.skills.includes(s.req), can = !have && reqOk && pts >= s.cost;
        return `<div class="sticker skill ${have ? 'have' : reqOk ? '' : 'lock'}"><b>${s.name}</b> <span class="badge">${s.cost} pt</span><div>${s.desc}</div>${s.req ? `<div class="muted">Requer: ${SKILLS[s.req].name}</div>` : ''}${have ? '<b>✔ Aprendida</b>' : `<button class="btn sm g" data-learn="${id}" ${can ? '' : 'disabled'}>Aprender</button>`}</div>`;
      }).join('')}</div>`).join('')}</div>
       <div class="row"><button class="btn" id="close">Fechar</button></div></div>`;
      pause.querySelectorAll('[data-learn]').forEach(b => b.onclick = () => { c.skills.push(b.dataset.learn); saveChar(c); api.onCharChanged(); H.openSkills(); });
      pause.querySelector('#close').onclick = () => H.closeModal();
    },
    // ---------- Quadro de missões ----------
    openBoard(state) {
      modal = 'board'; pause.classList.remove('hidden');
      const c = api.char, others = state.otherRanks, active = state.mission && state.mission.state === 'active';
      pause.innerHTML = `<div class="panel sticker"><h2>Quadro de missões</h2>
       <div class="muted">Regra de rank: você pode acompanhar uma missão de rank superior se houver no grupo alguém com o rank exigido (ou maior). Isso <b>não</b> promove ninguém automaticamente.</div>
       ${active ? `<div class="sticker y"><b>Missão ativa:</b> ${esc(state.mission.name)} (${state.mission.kills}/${state.mission.need}) <button class="btn r sm" id="abandon">Abandonar</button></div>` : ''}
       <div class="grid" style="grid-template-columns:1fr">${Object.values(MISSIONS).map(m => {
        const ok = canJoinMission(c.rank, m.rank, others), comp = ok && c.rank < m.rank;
        return `<div class="sticker o">${sticker(m.rank === 2 ? 'kunai' : 'scroll', 44)}<h3>${esc(m.name)} <span class="badge">${RANKS[m.rank]}</span> <span class="badge">${m.xp} XP</span></h3><div>${esc(m.desc)}</div>
         <div class="muted">${ok ? (comp ? 'Você participa como acompanhante de um ' + RANKS[m.rank] + ' do grupo (sem promoção).' : 'Disponível para o seu rank.') : 'Precisa de um ' + RANKS[m.rank] + ' (ou maior) no grupo.'}</div>
         <button class="btn sm g" data-m="${m.id}" ${ok && !active ? '' : 'disabled'}>Aceitar</button></div>`;
      }).join('')}</div><div class="row"><button class="btn" id="close">Fechar</button></div></div>`;
      pause.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { api.net.send({ t: 'mission_accept', mid: b.dataset.m }); H.closeModal(); });
      const ab = pause.querySelector('#abandon'); if (ab) ab.onclick = () => { api.net.send({ t: 'mission_abandon' }); H.closeModal(); };
      pause.querySelector('#close').onclick = () => H.closeModal();
    },
    // ---------- Promoção (só aqui; nunca automática) ----------
    openPromotion() {
      modal = 'promo'; pause.classList.remove('hidden');
      const c = api.char, lv = levelFromXp(c.xp), next = PROMOTION[c.rank + 1], can = canPromote(c.rank, lv);
      pause.innerHTML = `<div class="panel sticker"><h2>Hokage</h2>
       <div>Rank atual: <b>${RANKS[c.rank]}</b> · Nível ${lv}</div>
       <div>${next ? `Para virar <b>${RANKS[c.rank + 1]}</b> é preciso nível ${next.level}.` : 'Você já é Jōnin — o rank máximo deste protótipo.'}</div>
       <div class="muted">Concluir missões dá XP, mas a promoção só acontece quando você a solicita aqui.</div>
       <div class="row"><button class="btn g" id="go" ${can ? '' : 'disabled'}>Solicitar promoção</button><button class="btn" id="close">Fechar</button></div></div>`;
      pause.querySelector('#go').onclick = () => { c.rank++; saveChar(c); api.net.send({ t: 'rank', rank: c.rank }); api.onCharChanged(); H.toast(`🎉 Promovido a <b>${RANKS[c.rank]}</b>!`, 'o'); api.audio.play('win'); H.closeModal(); };
      pause.querySelector('#close').onclick = () => H.closeModal();
    },
  };
  H.setKeys(api.settings.keys);
  return H;
}
