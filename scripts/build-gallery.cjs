// Gera design/galeria-componentes.html (arquivo único, sem CDN) a partir de:
//   design/galeria/galeria.src.html  (página)
//   design/galeria/tokens.css        (paleta do painel sobre o Basecoat)
//   node_modules/basecoat-css        (CSS e JS já compilados do Basecoat)
// Uso: node scripts/build-gallery.cjs
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const css = read('node_modules/basecoat-css/dist/basecoat.cdn.min.css')
  .replace(/\/\*#\s*sourceMappingURL=[^*]*\*\//g, '')
  .replace(/<\/style/gi, '<\\/style');
const js = read('node_modules/basecoat-css/dist/js/all.min.js')
  .replace(/\/\/#\s*sourceMappingURL=.*$/gm, '')
  .replace(/<\/script/gi, '<\\/script');
const tokens = read('design/galeria/tokens.css');

let html = read('design/galeria/galeria.src.html').trim();
for (const marker of ['/*BASECOAT_CSS*/', '/*TOKENS_CSS*/', '/*BASECOAT_JS*/']) {
  if (!html.includes(marker)) throw new Error('Marcador ausente: ' + marker);
}
html = html
  .replace('/*BASECOAT_CSS*/', () => css)
  .replace('/*TOKENS_CSS*/', () => tokens)
  .replace('/*BASECOAT_JS*/', () => js);

fs.writeFileSync(path.join(root, 'design/galeria-componentes.html'), html + '\n', 'utf8');
console.log('Gerado design/galeria-componentes.html (' + Math.round(html.length / 1024) + ' KB)');
