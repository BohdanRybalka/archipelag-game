const L = require('../src/logic.js');
const only = process.argv[2] != null ? +process.argv[2] : -1;
function comps(st, W) {
  const N = st.N, fl = st.flooded.slice();
  L.floodStep(st, W, fl, -1);
  const id = new Int16Array(N * N).fill(-1); let k = 0; const sizes = [];
  for (let c = 0; c < N * N; c++) {
    if (fl[c] || id[c] >= 0) continue;
    const q = [c]; id[c] = k;
    for (let i = 0; i < q.length; i++) for (const v of L.n4(st, q[i])) if (!fl[v] && id[v] < 0) { id[v] = k; q.push(v); }
    sizes.push(q.length); k++;
  }
  return sizes;
}
L.LEVELS.forEach((def, li) => {
  if (only >= 0 && li !== only) return;
  const st = L.newLevel(li);
  const N = st.N;
  let land = 0, shal = 0, forest = 0, rock = 0;
  for (let c = 0; c < N * N; c++) { if (!st.flooded[c]) land++; else if (st.height[c] >= 1) shal++; if (st.feature[c] === 1) forest++; if (st.feature[c] === 2) rock++; }
  console.log(`\n#${li + 1} ${def.name}  N=${N} land=${land} shallow=${shal} forest=${forest} rock=${rock} tides=${st.tides} W0=${st.W}`);
  let rows = '';
  for (let y = 0; y < N; y++) {
    let s = '';
    for (let x = 0; x < N; x++) {
      const c = y * N + x;
      if (st.flooded[c]) { s += st.height[c] >= 1 ? ' ~' : ' ·'; continue; }
      const f = st.feature[c];
      s += (c === st.town ? 'T' : st.bld[c] === 1 ? 'H' : f === 2 ? '^' : f === 1 ? 't' : ' ') + st.height[c];
    }
    rows += s + '\n';
  }
  console.log(rows);
  let W = st.W; const line = [];
  for (let k = 0; k <= st.tides; k++) {
    if (k > 0) W += st.rises[k - 1];
    line.push(`W${W}: ${comps(st, W).filter((s) => s >= 2).sort((a, b) => b - a).join('+')}`);
  }
  console.log(line.join(' | '));
});
