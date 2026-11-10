// node tools/preview/shot.mjs saida.png '[{"label":"..","look":{...},"ry":0,"cam":{...}}]' [w h]
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d); }); }).listen(0);
const port = srv.address().port;
const [out, cases, w = '360', h = '480'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
p.on('console', (m) => console.log('console:', m.text())); p.on('pageerror', (e) => console.log('ERRO:', e.message));
await p.goto(`http://localhost:${port}/tools/preview/preview.html?w=${w}&h=${h}&c=${encodeURIComponent(cases)}`);
await p.waitForFunction(() => window.__done, null, { timeout: 60000 }).catch(() => console.log('timeout'));
await p.screenshot({ path: out, fullPage: true }); await b.close(); srv.close(); console.log('ok', out);
