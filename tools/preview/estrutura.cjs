// Gera PNG da prévia da malha suave (rodar com NODE_PATH=$(npm root -g)):
//   node tools/preview/estrutura.cjs saida.png "r=0,-3&e=..&t=.." [w h]
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '../..');
(async () => {
  const srv = http.createServer((q, r) => {
    const rel = decodeURIComponent(q.url.split('?')[0]);
    const f = rel.startsWith('/mundo/') ? path.join(root, 'public', rel) : path.join(root, rel);
    fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); r.end(d); });
  }).listen(0);
  const port = srv.address().port;
  const [out, query = '', w = '800', h = '600'] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  p.on('pageerror', (e) => console.log('ERRO:', e.message));
  await p.goto(`http://localhost:${port}/tools/preview/estrutura.html?${query}&w=${w}&h=${h}`);
  await p.waitForFunction(() => window.__done, null, { timeout: 120000 }).catch(() => console.log('timeout'));
  console.log('info', JSON.stringify(await p.evaluate(() => window.__info || window.__err)));
  await p.screenshot({ path: out }); await b.close(); srv.close(); console.log('ok', out);
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
