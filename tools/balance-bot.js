const L = require('../src/logic.js');
const { B, F } = L;
const INF = 1e6;

// ---------- мінімальний розріз: які клітинки перекрити дамбами ----------
function maxflowCut(st, isNode, cap, sources, sinks) {
  const N = st.N, M = N * N;
  // вузли: in = c, out = c + M; S = 2M, T = 2M + 1
  const S = 2 * M, T = 2 * M + 1, V = 2 * M + 2;
  const head = new Int32Array(V).fill(-1), to = [], nxt = [], capA = [];
  const add = (u, v, c) => { to.push(v); capA.push(c); nxt.push(head[u]); head[u] = to.length - 1; to.push(u); capA.push(0); nxt.push(head[v]); head[v] = to.length - 1; };
  for (let c = 0; c < M; c++) {
    if (!isNode[c]) continue;
    add(c, c + M, cap[c]);
    for (const v of L.n4(st, c)) if (isNode[v]) add(c + M, v, INF);
  }
  for (const s of sources) add(S, s, INF);
  for (const t of sinks) add(t + M, T, INF);
  let flow = 0;
  const level = new Int32Array(V), it = new Int32Array(V);
  const bfs = () => {
    level.fill(-1); level[S] = 0; const q = [S];
    for (let i = 0; i < q.length; i++) { const u = q[i]; for (let e = head[u]; e >= 0; e = nxt[e]) if (capA[e] > 0 && level[to[e]] < 0) { level[to[e]] = level[u] + 1; q.push(to[e]); } }
    return level[T] >= 0;
  };
  const dfs = (u, f) => {
    if (u === T) return f;
    for (; it[u] >= 0; it[u] = nxt[it[u]]) {
      const e = it[u], v = to[e];
      if (capA[e] > 0 && level[v] === level[u] + 1) {
        const d = dfs(v, Math.min(f, capA[e]));
        if (d > 0) { capA[e] -= d; capA[e ^ 1] += d; return d; }
      }
    }
    return 0;
  };
  while (bfs()) {
    for (let i = 0; i < V; i++) it[i] = head[i];
    let f; while ((f = dfs(S, INF)) > 0) { flow += f; if (flow >= INF) return null; }
  }
  // досяжні з S у залишковій мережі
  const seen = new Uint8Array(V); const q = [S]; seen[S] = 1;
  for (let i = 0; i < q.length; i++) { const u = q[i]; for (let e = head[u]; e >= 0; e = nxt[e]) if (capA[e] > 0 && !seen[to[e]]) { seen[to[e]] = 1; q.push(to[e]); } }
  const cut = [];
  for (let c = 0; c < M; c++) if (isNode[c] && seen[c] && !seen[c + M]) cut.push(c);
  return cut;
}
function damable(st, c) {
  if (st.bld[c] >= 0 || L.isBorder(st.N, c) || st.feature[c] === F.ROCK) return false;
  if (st.flooded[c] && st.height[c] < 1) return false;
  return true;
}
function waterGraph(st) {
  const M = st.N * st.N, Wf = st.W + st.rises.slice(st.tide).reduce((a, b) => a + b, 0);
  const isNode = new Uint8Array(M), cap = new Float64Array(M);
  for (let c = 0; c < M; c++) {
    if (st.bld[c] === B.DAM) continue;
    if (st.flooded[c] || st.height[c] <= Wf) { isNode[c] = 1; cap[c] = damable(st, c) ? 1 : INF; }
  }
  const sources = [];
  for (let c = 0; c < M; c++) if (L.isBorder(st.N, c) && st.flooded[c]) sources.push(c);
  return { isNode, cap, sources, Wf };
}
function protectCut(st, targets) {
  const g = waterGraph(st);
  const sinks = targets.filter((c) => g.isNode[c]);
  if (!sinks.length) return null;
  for (const t of sinks) g.cap[t] = INF;
  return maxflowCut(st, g.isNode, g.cap, g.sources, sinks);
}

// ---------- бот ----------
function lifeDays(st, c, type) {
  const s = L.clone(st);
  if (type != null && s.bld[c] < 0) s.bld[c] = type;
  if (!L.connectivity(s)[c]) return 0;
  let days = L.daysToTide(s);
  while (!s.over) {
    L.applyTide(s);
    if (s.flooded[c] || !L.connectivity(s)[c]) break;
    days += s.days;
  }
  return Math.min(days, st.tides * st.days - st.day);
}
function bestProducer(st, tool) {
  let best = null;
  const type = tool === 'saw' ? B.SAW : B.QUARRY;
  for (let c = 0; c < st.N * st.N; c++) {
    if (!L.checkCell(st, tool, c).ok) continue;
    const o = L.output(st, c, type); const out = o.wood + o.stone;
    if (out < 1) continue;
    const v = out * lifeDays(st, c, type);
    if (!best || v > best.v) best = { c, v, out };
  }
  return best;
}
function actions(st, opts) {
  const N = st.N, out = [];
  const base = L.futureScore(st);
  const has = (t) => st.tools.indexOf(t) >= 0 && !(opts.no || []).includes(t);
  const at = L.forecast(st);
  const evalBuild = (fn) => { const s = L.clone(st); if (!fn(s)) return null; return L.futureScore(s) - base; };
  for (let c = 0; c < N * N; c++) {
    if (has('village') && L.checkCell(st, 'village', c).ok) {
      const d = evalBuild((s) => L.build(s, 'village', c));
      if (d > 0) out.push({ kind: 'village', c, d, cost: 2 });
    }
  }
  if (has('dam')) {
    // захист селищ: окремо кожне в небезпеці і всі разом на одному острові
    const danger = [];
    for (let c = 0; c < N * N; c++) if (st.bld[c] === B.VILLAGE && at[c] < 99) danger.push(c);
    // шлях від селища до міста: дамби мають зберегти і селище, і дорогу
    const pathTo = (c) => {
      const prev = new Int32Array(N * N).fill(-2); prev[c] = -1; const q = [c];
      for (let i = 0; i < q.length; i++) { const u = q[i]; if (u === st.town) break; for (const v of L.n4(st, u)) if (prev[v] === -2 && !st.flooded[v]) { prev[v] = u; q.push(v); } }
      if (prev[st.town] === -2) return [c];
      const p = []; for (let u = st.town; u !== -1; u = prev[u]) p.push(u); return p;
    };
    const sets = danger.map((c) => pathTo(c));
    if (danger.length > 1) sets.push([].concat(...danger.map(pathTo)));
    // захист перешийків: міста + селища, що стануть відрізаними
    const risk = L.nextTideRisk(st);
    if (risk.cut.length) sets.push([st.town].concat(risk.cut));
    for (const set of sets) {
      const cut = protectCut(st, set);
      if (!cut || !cut.length || cut.length > st.stone) continue;
      const d = evalBuild((s) => { const r = L.buildLine(s, cut); return r.built.length === cut.length; });
      if (d > 0) out.push({ kind: 'dams', cells: cut, d, cost: cut.length * opts.stoneW });
    }
    // осушення мілини
    if (opts.reclaim && st.tides * st.days - st.day > 4) {
      const g = waterGraph(st);
      const tried = new Set();
      for (let c = 0; c < N * N; c++) {
        if (!L.shallow(st, c) || L.isBorder(N, c) || tried.has(c)) continue;
        if (!L.n4(st, c).some((n) => !st.flooded[n])) continue;
        // невелика ділянка мілини навколо c
        const R = [c]; tried.add(c);
        for (let i = 0; i < R.length && R.length < opts.reclaim; i++) for (const v of L.n4(st, R[i])) if (L.shallow(st, v) && !L.isBorder(N, v) && R.indexOf(v) < 0 && R.length < opts.reclaim) R.push(v);
        const cap = Float64Array.from(g.cap); for (const r of R) cap[r] = INF;
        const cut = maxflowCut(st, g.isNode, cap, g.sources, R);
        if (!cut || !cut.length || cut.length > st.stone) continue;
        const s = L.clone(st); const r = L.buildLine(s, cut);
        if (r.built.length !== cut.length || r.drained.length < 2) continue;
        const d = L.futureScore(s) - base + r.drained.length * 0.9;
        out.push({ kind: 'dams', cells: cut, d, cost: cut.length * opts.stoneW, reclaim: r.drained.length });
      }
    }
    for (let c = 0; c < N * N; c++) {
      if (at[c] > 2 || !L.checkCell(st, 'dam', c).ok) continue;
      const d = evalBuild((s) => L.build(s, 'dam', c));
      if (d > 0) out.push({ kind: 'dams', cells: [c], d, cost: opts.stoneW });
    }
  }
  return out;
}
function bot(st0, opts) {
  opts = Object.assign({ maxSaw: 2, maxQuarry: 1, stoneW: 1.5, reclaim: 0, seed: 1 }, opts || {});
  const st = L.clone(st0);
  const log = [];
  // steps: що саме збудовано і де, щоб відтворити гру бота (check-logic, check-ui)
  const steps = [];
  let saws = 0, quarries = 0, guard = 0;
  while (!st.over && guard++ < 200) {
    for (let k = 0; k < 30; k++) {
      const left = st.tides * st.days - st.day;
      if (saws < opts.maxSaw && st.tools.includes('saw') && left > 4 && st.wood >= 3) {
        const p = bestProducer(st, 'saw');
        if (p && p.v >= 8) { L.build(st, 'saw', p.c); saws++; log.push(st.day + ':saw'); steps.push({ day: st.day, tool: 'saw', cells: [p.c] }); continue; }
      }
      if (quarries < opts.maxQuarry && st.tools.includes('quarry') && st.tools.includes('dam') && !(opts.no || []).includes('dam') && left > 4 && st.wood >= 3) {
        const p = bestProducer(st, 'quarry');
        if (p && p.v >= 5) { L.build(st, 'quarry', p.c); quarries++; log.push(st.day + ':quarry'); steps.push({ day: st.day, tool: 'quarry', cells: [p.c] }); continue; }
      }
      const acts = actions(st, opts).map((a) => Object.assign(a, { v: a.d / Math.max(1, a.cost) }));
      if (!acts.length) break;
      acts.sort((a, b) => b.v - a.v);
      const p = acts[0];
      if (p.kind === 'village') L.build(st, 'village', p.c);
      else L.buildLine(st, p.cells);
      steps.push({ day: st.day, tool: p.kind === 'dams' ? 'dam' : p.kind, cells: p.cells ? p.cells.slice() : [p.c] });
      log.push(st.day + ':' + p.kind + (p.cells ? p.cells.length : '') + (p.reclaim ? 'r' + p.reclaim : ''));
    }
    L.endDay(st);
  }
  return { score: st.finalScore, st, log, steps };
}
function tally(log) { const t = {}; for (const e of log) { const k = e.split(':')[1].replace(/\d+.*$/, ''); t[k] = (t[k] || 0) + 1; } return t; }
function evaluate(li, def) {
  const st = L.newLevel(li, def);
  const hasDam = st.tools.includes('dam');
  const variants = [];
  for (const maxSaw of [2, 3, 4]) for (const maxQuarry of (hasDam ? [1, 2, 3] : [0])) for (const reclaim of (hasDam ? [0, 6, 12] : [0])) variants.push({ maxSaw, maxQuarry, reclaim });
  let best = null; const all = [];
  for (const v of variants) {
    const r = bot(st, v); all.push(r.score);
    if (!best || r.score > best.score) best = Object.assign(r, { v });
  }
  const noDam = bot(st, Object.assign({}, best.v, { no: ['dam'] }));
  return { st, best, noDam, all };
}
if (require.main === module) {
  const only = process.argv[2] != null ? +process.argv[2] : -1;
  for (let li = 0; li < L.LEVELS.length; li++) {
    if (only >= 0 && li !== only) continue;
    const t1 = Date.now();
    const r = evaluate(li);
    console.log(`#${li + 1} ${r.st.name.padEnd(18)} best=${r.best.score} ${JSON.stringify(r.best.v)} lost=${r.best.st.lost} left=${r.best.st.left} recl=${r.best.st.reclaimed} | noDam=${r.noDam.score} | ${JSON.stringify(tally(r.best.log))} ${Date.now() - t1}ms`);
  }
}
module.exports = { bot, evaluate, tally, protectCut };
