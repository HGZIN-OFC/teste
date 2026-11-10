// Controles de toque para celular/tablet: joystick flutuante (esquerda), arrastar para olhar (direita) e botões de ação.
export const isTouchDevice = () => { try { return matchMedia('(pointer: coarse)').matches; } catch { return false; } };

// Converte o deslocamento do dedo em vetor de movimento (x: direita+, y: frente+)
export function joyVector(dx, dy, R) {
  const l = Math.hypot(dx, dy) || 0, k = l > R ? R / l : 1;
  return { x: (dx * k) / R, y: (-dy * k) / R, mag: Math.min(1, l / R) };
}

export function createTouch(h) {
  const root = document.createElement('div'); root.id = 'touch'; document.body.appendChild(root);
  const state = { mx: 0, my: 0, run: false };
  const div = (cls, parent = root) => { const e = document.createElement('div'); e.className = cls; parent.appendChild(e); return e; };
  const look = div('tz tlook'), joy = div('tz tjoy'), base = div('jbase'), knob = div('jknob', base);
  base.style.display = 'none';
  const R = 55; let lookId = null, lx = 0, ly = 0, joyId = null;

  look.addEventListener('pointerdown', (e) => { h.first(); if (lookId !== null) return; lookId = e.pointerId; lx = e.clientX; ly = e.clientY; if (look.setPointerCapture) look.setPointerCapture(e.pointerId); e.preventDefault(); });
  look.addEventListener('pointermove', (e) => { if (e.pointerId !== lookId) return; h.look(e.clientX - lx, e.clientY - ly); lx = e.clientX; ly = e.clientY; });
  const lookEnd = (e) => { if (e.pointerId === lookId) lookId = null; };
  look.addEventListener('pointerup', lookEnd); look.addEventListener('pointercancel', lookEnd);

  let ox = 0, oy = 0;
  joy.addEventListener('pointerdown', (e) => {
    h.first(); if (joyId !== null) return; joyId = e.pointerId; ox = e.clientX; oy = e.clientY;
    if (joy.setPointerCapture) joy.setPointerCapture(e.pointerId);
    base.style.display = 'block'; base.style.left = (ox - 65) + 'px'; base.style.top = (oy - 65) + 'px'; knob.style.transform = 'translate(0px,0px)'; e.preventDefault();
  });
  joy.addEventListener('pointermove', (e) => {
    if (e.pointerId !== joyId) return;
    const v = joyVector(e.clientX - ox, e.clientY - oy, R); state.mx = v.x; state.my = v.y; state.run = v.mag > 0.85;
    knob.style.transform = `translate(${v.x * R}px,${-v.y * R}px)`;
  });
  const joyEnd = (e) => { if (e.pointerId !== joyId) return; joyId = null; state.mx = state.my = 0; state.run = false; base.style.display = 'none'; };
  joy.addEventListener('pointerup', joyEnd); joy.addEventListener('pointercancel', joyEnd);

  const btns = {};
  const mk = (a, label, cls, fn) => {
    const b = document.createElement('button'); b.className = 'tb ' + cls; b.textContent = label; b.dataset.a = a;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); h.first(); b.classList.add('down'); fn(); });
    const up = () => b.classList.remove('down'); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
    root.appendChild(b); btns[a] = b; return b;
  };
  mk('punch', 'SOCO', 'p', h.punch); mk('kick', 'CHUTE', 'k', h.kick); mk('fire', 'FOGO', 'f', h.fire); mk('jump', 'PULO', 'j', h.jump);
  mk('dash', 'DASH', 'd', h.dash); mk('fear', 'ILUSÃO', 'z', h.fear); mk('interact', 'USAR', 'e', h.interact);
  mk('skills', 'HAB.', 't s', h.skills); mk('cloak', 'MANTO', 't c', h.cloak); mk('byak', 'BYAKU', 't v', h.byak); mk('pause', 'MENU', 't m', h.pause);
  mk('full', '⛶', 't u', () => { try { const d = document.documentElement; if (d.requestFullscreen) d.requestFullscreen().then(() => { try { screen.orientation.lock('landscape'); } catch { /* ok */ } }).catch(() => {}); } catch { /* ok */ } });
  btns.interact.style.display = 'none';

  return {
    state,
    setClan(clan, hasFear) { btns.cloak.style.display = clan === 'uzumaki' ? '' : 'none'; btns.byak.style.display = clan === 'hyuga' ? '' : 'none'; btns.fear.style.display = hasFear ? '' : 'none'; },
    setFear(v) { btns.fear.style.display = v ? '' : 'none'; },
    setInteract(v) { btns.interact.style.display = v ? '' : 'none'; },
    dispose() { if (root.remove) root.remove(); },
  };
}
