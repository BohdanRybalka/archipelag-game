// Генерує фікстуру збереження tools/fixtures/save-v4.json для check-ui (сценарії U3, U4).
// Це зліпок збереження поточної версії: після рефакторингу його НЕ перегенеровувати,
// бо він перевіряє, що старі збереження й далі завантажуються.
// Запуск: node tools/make-fixture.js
const fs = require('fs');
const path = require('path');
const L = require('../src/logic.js');

const LI = 1; // «Перша дамба»
const EXPECT = { day: 4, tide: 1, wood: 8, stone: 3, built: 2 };

function firstOk(st, tool) {
  for (let c = 0; c < st.N * st.N; c++) if (L.checkCell(st, tool, c).ok) return c;
  throw new Error(`немає клітинки для ${tool}`);
}
function makeSave() {
  const st = L.newLevel(LI);
  L.build(st, 'village', firstOk(st, 'village'));
  for (let i = 0; i < 4; i++) L.endDay(st);
  L.build(st, 'dam', firstOk(st, 'dam'));
  return { li: st.li, st };
}
// ключі стану по рядку, щоб diff фікстури читався; масиви лишаються в один рядок
function format(save) {
  const lines = Object.keys(save.st).map((k) => `    ${JSON.stringify(k)}: ${JSON.stringify(save.st[k])}`);
  return `{\n  "li": ${save.li},\n  "st": {\n${lines.join(',\n')}\n  }\n}\n`;
}

if (require.main === module) {
  const save = makeSave();
  const got = {};
  for (const k of Object.keys(EXPECT)) got[k] = save.st[k];
  if (JSON.stringify(got) !== JSON.stringify(EXPECT)) {
    console.error(`make-fixture FAIL: очікувано ${JSON.stringify(EXPECT)}, вийшло ${JSON.stringify(got)}`);
    process.exit(1);
  }
  const out = path.join(__dirname, 'fixtures', 'save-v4.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, format(save));
  console.log(`${path.relative(process.cwd(), out)}: ${save.st.name}, ${JSON.stringify(got)}`);
}

module.exports = { makeSave };
