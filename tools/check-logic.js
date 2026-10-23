// Швидкий «зліпок» правил: бот грає кожен рівень з фіксованим варіантом,
// а хеш фінального стану й кроків порівнюється з tools/baseline/logic.json.
// Запуск: node tools/check-logic.js [--update]   (--update перезаписує зліпок)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const L = require('../src/logic.js');
const { bot } = require('./balance-bot.js');

const BASELINE = path.join(__dirname, 'baseline', 'logic.json');
// поля стану, що входять у хеш; bridges і v свідомо не входять (крок 1 прибирає bridges)
const FIELDS = ['height', 'feature', 'flooded', 'bld', 'pop', 'W', 'day', 'tide', 'wood', 'stone', 'lost', 'left', 'reclaimed', 'built', 'finalScore'];
const WITH_DAMS = { maxSaw: 3, maxQuarry: 2, reclaim: 6 };
const NO_DAMS = { maxSaw: 3, maxQuarry: 0, reclaim: 0 };

function stateHash(st, steps) {
  const o = {};
  for (const k of FIELDS) o[k] = st[k];
  if (steps) o.steps = steps;
  return crypto.createHash('sha1').update(JSON.stringify(o)).digest('hex');
}
function variantFor(li) {
  return L.LEVELS[li].tools.includes('dam') ? WITH_DAMS : NO_DAMS;
}
function snapshot() {
  return L.LEVELS.map((lv, li) => {
    const r = bot(L.newLevel(li), variantFor(li));
    return { li, name: r.st.name, score: r.score, steps: r.steps.length, hash: stateHash(r.st, r.steps) };
  });
}

if (require.main === module) {
  const t0 = Date.now();
  const cur = snapshot();
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  if (process.argv.includes('--update')) {
    fs.mkdirSync(path.dirname(BASELINE), { recursive: true });
    fs.writeFileSync(BASELINE, '[\n' + cur.map((r) => '  ' + JSON.stringify(r)).join(',\n') + '\n]\n');
    console.log(`check:logic: зліпок записано в ${path.relative(process.cwd(), BASELINE)} (бали ${cur.map((r) => r.score).join(' ')}, ${secs} с)`);
    process.exit(0);
  }
  if (!fs.existsSync(BASELINE)) {
    console.error('check:logic FAIL: немає tools/baseline/logic.json. Створити: node tools/check-logic.js --update');
    process.exit(1);
  }
  const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  let bad = 0;
  for (let i = 0; i < Math.max(base.length, cur.length); i++) {
    const a = base[i], b = cur[i];
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    bad++;
    console.error(`  рівень ${i + 1}: було ${JSON.stringify(a)}`);
    console.error(`  ${' '.repeat(String(i + 1).length + 8)} стало ${JSON.stringify(b)}`);
  }
  if (bad) {
    console.error(`check:logic FAIL: ${bad} з ${base.length} рівнів не збігаються зі зліпком`);
    process.exit(1);
  }
  console.log(`check:logic OK: ${cur.length} рівнів збігаються зі зліпком (бали ${cur.map((r) => r.score).join(' ')}, ${secs} с)`);
}

module.exports = { stateHash, variantFor, snapshot, FIELDS };
