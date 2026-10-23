const L = require('../src/logic.js');
const { evaluate, tally } = require('./balance-bot.js');
const fs = require('fs');
const out = [];
for (let li = 0; li < L.LEVELS.length; li++) {
  const t = Date.now();
  const r = evaluate(li);
  const Bs = r.best.score;
  const g = [Math.round(Bs * (li === 0 ? 0.5 : 0.5)), Math.round(Bs * 0.75), Math.round(Bs * 0.95)];
  out.push(g);
  console.log(`#${li + 1} ${r.st.name.padEnd(18)} best=${Bs} noDam=${r.noDam.score} goals=${g.join('/')} lost=${r.best.st.lost} recl=${r.best.st.reclaimed} ${JSON.stringify(tally(r.best.log))} ${Date.now() - t}ms`);
}
let s = fs.readFileSync(require('path').join(__dirname, '..', 'src', 'logic.js'), 'utf8');
s = s.replace(/\n  const GOALS = .*\n  LEVELS.forEach\(\(l, i\) => \{ l.goals = GOALS\[i\]; \}\);\n/, '\n');
s = s.replace('  // ---------- RNG / шум ----------', `  const GOALS = ${JSON.stringify(out)};\n  LEVELS.forEach((l, i) => { l.goals = GOALS[i]; });\n\n  // ---------- RNG / шум ----------`);
fs.writeFileSync(require('path').join(__dirname, '..', 'src', 'logic.js'), s);
