// Rede local em memória: mesma interface do Net, mas a simulação (sim.js) roda dentro do navegador. Usada no modo solo.
import { createSim } from './sim.js';

export class LocalNet {
  constructor(terrain) { this.terrain = terrain; this.handlers = {}; this.open = false; this.sim = null; this.timer = 0; this.conn = null; }
  on(type, fn) { this.handlers[type] = fn; return this; }
  async connect() {
    this.sim = createSim({ terrain: this.terrain });
    this.conn = { player: null, send: (o) => { const m = JSON.parse(JSON.stringify(o)); setTimeout(() => { const f = this.handlers[m.t]; if (f) f(m); }, 0); } };
    this.open = true; let last = performance.now();
    this.timer = setInterval(() => { // avança a simulação em tempo real (máx. 5 passos por vez, se a aba ficou lenta)
      const now = performance.now(), n = Math.min(5, Math.max(1, Math.round((now - last) / (this.sim.DT * 1000)))); last = now;
      for (let i = 0; i < n; i++) this.sim.tick();
    }, 50);
  }
  send(o) { if (this.open) this.sim.onMessage(this.conn, JSON.parse(JSON.stringify(o))); }
  close() { clearInterval(this.timer); if (this.sim && this.conn) this.sim.onClose(this.conn); this.open = false; this.handlers = {}; }
}
