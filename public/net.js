// Cliente WebSocket (mesmo host/porta da página).
export class Net {
  constructor() { this.ws = null; this.handlers = {}; this.open = false; }
  on(type, fn) { this.handlers[type] = fn; return this; }
  connect() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);
      this.ws = ws;
      ws.onopen = () => { this.open = true; resolve(); };
      ws.onerror = () => reject(new Error('Não consegui conectar ao servidor. Ele está rodando (node server.js)?'));
      ws.onclose = () => { this.open = false; this.handlers.close && this.handlers.close(); };
      ws.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch { return; } const f = this.handlers[m.t]; if (f) f(m); };
    });
  }
  send(o) { if (this.open && this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }
  close() { this.handlers = {}; try { this.ws && this.ws.close(); } catch { /* ok */ } this.open = false; }
}
