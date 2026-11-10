// Junta os módulos de public/ em UM arquivo HTML (modo solo, sem servidor). Uso: node tools/bundle.mjs
// Só o three.js continua vindo do CDN. Não precisa de npm.
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), pub = path.join(root, 'public');
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
const read = (n) => fs.readFileSync(path.join(pub, n + '.js'), 'utf8');
const order = [], seen = new Set();
(function visit(n) { if (seen.has(n)) return; seen.add(n); for (const m of read(n).matchAll(/from\s+'\.\/([\w-]+)\.js'/g)) visit(m[1]); order.push(n); })('main');
let out = '';
for (const n of order) {
  let src = read(n); const names = [];
  src = src.replace(/import\s*\*\s*as\s+THREE\s+from\s+'three';?/g, '');
  src = src.replace(/import\s*\{([^}]*)\}\s*from\s*'\.\/([\w-]+)\.js';?/g, (_, list, mod) => `const {${list.replace(/\s+as\s+/g, ': ')}} = __m['${mod}'];`);
  src = src.replace(/^export\s+(async\s+function|function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm, (_, kw, name) => { names.push(name); return `${kw} ${name}`; });
  if (/^\s*export\s/m.test(src) || /import\.meta/.test(src)) throw new Error(`${n}.js tem sintaxe de módulo não suportada pelo empacotador`);
  out += `__m['${n}'] = (function () {\n'use strict';\n${src}\nreturn { ${names.join(', ')} };\n})();\n`;
}
const bundle = `(async () => {\nconst THREE = globalThis.__SW_THREE__ || await import('${THREE_URL}');\nconst __m = {};\n${out}})();`;
const css = fs.readFileSync(path.join(pub, 'style.css'), 'utf8');
const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="mobile-web-app-capable" content="yes"><title>Shinobi Wilds</title>
<style>${css}</style></head><body>
<canvas id="game"></canvas><div id="hud" class="hidden"></div><div id="screens"></div><div id="pause" class="hidden"></div><div id="toasts"></div>
<div id="bootfail" class="sticker" style="display:none"><h2>Não consegui carregar o three.js</h2><p>Esta versão precisa de internet para baixar o three.js (jsDelivr). Verifique a conexão e recarregue a página.</p></div>
<script>window.__SW_SOLO_ONLY__=true;setTimeout(function(){if(!window.__swBoot)document.getElementById('bootfail').style.display='flex'},9000);</script>
<script>
${bundle.replace(/<\/script/gi, '<\\/script')}
</script></body></html>
`;
// Versão "fragmento" para publicar como artefato (o esqueleto <html>/<head>/<body> é colocado pela plataforma)
const fragment = `<title>Shinobi Wilds</title>
<style>${css}</style>
<canvas id="game"></canvas><div id="hud" class="hidden"></div><div id="screens"></div><div id="pause" class="hidden"></div><div id="toasts"></div>
<div id="bootfail" class="sticker" style="display:none"><h2>Não consegui carregar o three.js</h2><p>Esta versão precisa de internet para baixar o three.js (jsDelivr). Verifique a conexão e recarregue a página.</p></div>
<script>window.__SW_SOLO_ONLY__=true;setTimeout(function(){if(!window.__swBoot)document.getElementById('bootfail').style.display='flex'},9000);</script>
<script>
${bundle.replace(/<\/script/gi, '<\\/script')}
</script>
`;
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'shinobi-wilds-artifact.html'), fragment);
fs.writeFileSync(path.join(root, 'dist', 'shinobi-wilds-solo.html'), html);
console.log(`dist/shinobi-wilds-solo.html gerado (${(html.length / 1024).toFixed(0)} KB, módulos: ${order.join(', ')})`);
