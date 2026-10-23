// Перевіряє, що закомічений index.html збігається з тим, що збирає tools/build.js.
// Запуск: node tools/check-build.js (або npm run check:build)
const fs = require('fs');
const path = require('path');
const { buildPage } = require('./build.js');

const root = path.join(__dirname, '..');
const built = buildPage(path.join(root, 'src'));
const committed = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

if (built === committed) {
  console.log('check:build OK: index.html збігається зі збіркою');
} else {
  const a = built.split('\n'), b = committed.split('\n');
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  console.error(`check:build FAIL: index.html не збігається зі збіркою (перший різний рядок ${i + 1})`);
  console.error(`  збірка:   ${(a[i] || '').slice(0, 160)}`);
  console.error(`  у репо:   ${(b[i] || '').slice(0, 160)}`);
  console.error('Запусти npm run build і закоміть index.html.');
  process.exit(1);
}
