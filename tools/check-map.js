// перевірка ручної карти: коли що заливає, з дамбами і без
const L = require('../src/logic.js');
const li = +process.argv[2];
const dams = process.argv[3] ? JSON.parse(process.argv[3]) : [];
const st = L.newLevel(li);
const N = st.N;
const toC = ([y, x]) => y * N + x;
function show(s, at) {
  let out = '    ' + [...Array(N).keys()].map((x) => String(x).padStart(3)).join('') + '\n';
  for (let y = 0; y < N; y++) {
    let r = String(y).padStart(3) + ' ';
    for (let x = 0; x < N; x++) {
      const c = y * N + x;
      let t;
      if (s.bld[c] === L.B.DAM) t = '##';
      else if (s.flooded[c]) t = s.height[c] >= 1 ? '~' + s.height[c] : ' ·';
      else t = (c === s.town ? 'T' : s.bld[c] === 1 ? 'H' : s.feature[c] === 2 ? '^' : s.feature[c] === 1 ? 't' : at && at[c] < 99 ? String(at[c]) : ' ') + s.height[c];
      r += ' ' + t;
    }
    out += r + '\n';
  }
  return out;
}
const s = L.clone(st); s.stone = 99;
const r = L.buildLine(s, dams.map(toC));
console.log('dams', r.built.length, 'drained', r.drained.length, 'future', L.futureScore(s), 'base', L.futureScore(st));
console.log('(цифра перед висотою = через скільки припливів заллє)');
console.log(show(s, L.forecast(s)));
