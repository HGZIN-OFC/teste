// Tela de carregamento com porcentagem (usada no jogo e no mapa). Fica por cima de tudo até o mundo estar pronto.
export function showLoading(title = 'Carregando Konoha…') {
  const box = document.createElement('div');
  box.id = 'sw-loading';
  box.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:#0f1424;color:#fff;font-family:"Trebuchet MS",Arial,sans-serif;';
  const titleEl = document.createElement('div');
  titleEl.style.cssText = 'font:800 22px Impact,Arial,sans-serif;letter-spacing:1px';
  titleEl.textContent = title;
  const track = document.createElement('div');
  track.style.cssText = 'width:min(70vw,360px);height:16px;border:3px solid #fff;border-radius:10px;overflow:hidden;background:#1d2440';
  const bar = document.createElement('div');
  bar.style.cssText = 'height:100%;width:0%;background:#ffd23f;transition:width .2s';
  track.appendChild(bar);
  const pct = document.createElement('div');
  pct.style.cssText = 'font:700 16px Arial,sans-serif';
  pct.textContent = '0%';
  const msg = document.createElement('div');
  msg.style.cssText = 'font-size:13px;opacity:.75';
  msg.textContent = 'Preparando…';
  [titleEl, track, pct, msg].forEach((el) => box.appendChild(el));
  document.body.appendChild(box);
  return {
    set(p, text) {   // p entre 0 e 1
      const v = Math.max(0, Math.min(1, p));
      bar.style.width = (v * 100).toFixed(0) + '%'; pct.textContent = Math.floor(v * 100) + '%';
      if (text) msg.textContent = text;
    },
    error(text) { msg.textContent = text; msg.style.color = '#ff8a8a'; },
    done() { box.remove(); },
  };
}
