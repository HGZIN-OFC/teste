// Shinobi Wilds — servidor: arquivos estáticos + WebSocket (implementação própria, sem dependências).
// Uso: node server.js [porta]   (padrão 3000)
import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import { fileURLToPath } from 'url';
import { createSim } from './public/sim.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, 'public');
const PORT = Number(process.argv[2] || process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0'; // em hospedagem na nuvem o próprio serviço define PORT e HOST
const TEST_MODE = process.env.SW_TEST === '1';
const sim = createSim({ testMode: TEST_MODE, log: console.log });

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  let url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(PUBLIC, url));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end('403'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
});

// ---------- WebSocket mínimo (RFC 6455, texto) ----------
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
function wsSend(sock, obj) {
  if (sock.destroyed || !sock.writable) return;
  const payload = Buffer.from(JSON.stringify(obj));
  const len = payload.length;
  let head;
  if (len < 126) head = Buffer.from([0x81, len]);
  else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x81; head[1] = 126; head.writeUInt16BE(len, 2); }
  else { head = Buffer.alloc(10); head[0] = 0x81; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
  sock.write(Buffer.concat([head, payload]));
}
function wsPong(sock, data) {
  const head = Buffer.from([0x8a, data.length]);
  sock.write(Buffer.concat([head, data]));
}

server.on('upgrade', (req, sock) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) { sock.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  let buf = Buffer.alloc(0);
  let frag = null;
  const conn = { sock, player: null, send: (o) => wsSend(sock, o) };
  sock.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= 2) {
      const fin = (buf[0] & 0x80) !== 0, op = buf[0] & 0x0f, masked = (buf[1] & 0x80) !== 0;
      let len = buf[1] & 0x7f, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      if (len > 1 << 20) { sock.destroy(); return; }
      const need = off + (masked ? 4 : 0) + len;
      if (buf.length < need) return;
      let data = buf.subarray(off + (masked ? 4 : 0), need);
      if (masked) { const m = buf.subarray(off, off + 4); data = Buffer.from(data.map((b, i) => b ^ m[i % 4])); }
      buf = buf.subarray(need);
      if (op === 8) { sock.end(); return; }
      if (op === 9) { wsPong(sock, data); continue; }
      if (op === 10) continue;
      if (op === 1 || op === 2) { frag = fin ? null : [data]; if (fin) sim.onMessage(conn, data.toString('utf8')); }
      else if (op === 0 && frag) { frag.push(data); if (fin) { const all = Buffer.concat(frag); frag = null; sim.onMessage(conn, all.toString('utf8')); } }
    }
  });
  const close = () => sim.onClose(conn);
  sock.on('close', close); sock.on('error', close);
});

setInterval(() => sim.tick(), sim.DT * 1000);

server.listen(PORT, HOST, () => {
  console.log(`Shinobi Wilds rodando em http://localhost:${PORT}${TEST_MODE ? '  [MODO DE TESTE]' : ''}`);
  for (const list of Object.values(os.networkInterfaces())) for (const n of list || []) if (n.family === 'IPv4' && !n.internal) console.log(`  Celular/outro PC na mesma rede: http://${n.address}:${PORT}`);
});
