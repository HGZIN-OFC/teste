// Capturas do personagem com o mini-three (offline). Uso: NODE_PATH=$(npm root -g) node tools/preview/shot.cjs saida.png '<cases json>' [w h]
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '../..');
(async () => {
  const srv = http.createServer((q, r) => {
    const rel = decodeURIComponent(q.url.split('?')[0]);
    const f = path.join(root, rel);
    fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); r.end(d); });
  }).listen(0);
  const [out, cases, w = '360', h = '480'] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  p.on('pageerror', (e) => console.log('ERRO:', e.message));
  await p.goto(`http://localhost:${srv.address().port}/tools/preview/preview.html?w=${w}&h=${h}&c=${encodeURIComponent(cases)}`);
  await p.waitForFunction(() => window.__done, null, { timeout: 120000 }).catch(() => console.log('timeout'));
  await p.screenshot({ path: out, fullPage: true }); await b.close(); srv.close(); console.log('ok', out);
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
