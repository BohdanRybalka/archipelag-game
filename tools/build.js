// Збирає гру в один файл index.html у корені репозиторію (для GitHub Pages).
// Запуск: node tools/build.js
const fs = require('fs');
const path = require('path');

const THREE_CDN = '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>';

function buildPage(srcDir) {
  const read = (f) => fs.readFileSync(path.join(srcDir, f), 'utf8');
  const tpl = read(fs.existsSync(path.join(srcDir, 'template.html')) ? 'template.html' : 'index.html');
  const filled = tpl
    .replace('/*__CSS__*/', () => read('style.css'))
    .replace('/*__LOGIC__*/', () => read('logic.js'))
    .replace('/*__GAME__*/', () => read('game.js'))
    .replace('<!--__THREE__-->', () => THREE_CDN);
  // усе до <div id="app"> — це заголовок сторінки (title, шрифти, стилі)
  const cut = filled.indexOf('<div id="app">');
  const head = filled.slice(0, cut).replace(/<meta name="claude:[^>]*>\n?/, '').trim();
  const body = filled.slice(cut).trim();
  return `<!doctype html>
<html lang="uk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>
${head}
</head>
<body>
${body}
</body>
</html>
`;
}

if (require.main === module) {
  const root = path.join(__dirname, '..');
  const out = path.join(root, 'index.html');
  fs.writeFileSync(out, buildPage(path.join(root, 'src')));
  console.log('index.html:', fs.statSync(out).size, 'bytes');
}

module.exports = { buildPage };
