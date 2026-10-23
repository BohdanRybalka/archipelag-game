/* Архіпелаг — чиста ігрова логіка (без рендеру). Працює і в браузері, і в Node. */
(function (root) {
  'use strict';

  const MAXH = 8;
  const B = { TOWN: 0, VILLAGE: 1, SAW: 2, QUARRY: 3, DAM: 4 };
  const F = { NONE: 0, FOREST: 1, ROCK: 2 };
  const TOOLS = ['village', 'saw', 'quarry', 'dam'];
  const TOOL_B = { village: B.VILLAGE, saw: B.SAW, quarry: B.QUARRY, dam: B.DAM };
  const COST = {
    village: { wood: 2, stone: 0 },
    saw: { wood: 3, stone: 0 },
    quarry: { wood: 3, stone: 0 },
    bridge: { wood: 1, stone: 0 },  // 1 + по 1 за кожну клітинку прольоту
    dam: { wood: 0, stone: 1 },
  };
  const VMAX = 4;          // найбільше селище
  const BRIDGE_MAX = 3;    // найдовший проліт моста
  const SAW_MAX = 2, QUARRY_MAX = 2;

  // ---------- Рівні ----------
  // peaks: [x, y, висота, радіус]; ridges: [x1, y1, x2, y2, висота, радіус]; dips: [x, y, глибина, радіус]
  const LEVELS = [
    {
      name: 'Тиха бухта', N: 13, tides: 4, days: 3, W0: 1, seed: 1101, floor: 1.2, hamlets: 2,
      tools: ['village', 'saw'], start: { wood: 6, stone: 0 },
      intro: 'Селища ростуть після кожного припливу, якщо до них веде дорога від міста. Те, що заллє вода, зникне разом із людьми.',
      peaks: [[0.42, 0.44, 8.6, 0.55], [0.74, 0.7, 6.2, 0.34]], noise: 0.9, forest: 0.3, rock: 0.0,
    },
    {
      name: 'Перша дамба', N: 14, tides: 3, days: 3, W0: 1, seed: 2203, floor: 1.2, hamlets: 1, lowHamlets: 2, newTool: 'dam',
      tools: ['village', 'saw', 'quarry', 'dam'], start: { wood: 6, stone: 4 },
      intro: 'Дамба не тоне й не пускає воду. Відгороди низину, і селища в ній уціліють.',
      map: [
        '.  .  .  .  .  .  .  .  .  .  .  .  .  .',
        '.  .  1  2  2  3  3  2 ^5  1  1 ^5  .  .',
        '.  1  2 t3 t3  4  4 ^5  1  1  1 ^5  1  .',
        '.  1 t2 t3  4 H5  5 ^5  1  1  1 ^5  1  .',
        '.  2 t3  4  5  6  6  5 ^5 ^5 ^5 ^5  1  .',
        '.  2 t3  4  6 T8  6  5  4  4  4  3  1  .',
        '.  1 t3  3  5  6  5  4 ^5 ^5 ^5 ^5  1  .',
        '.  1  2 t3  4  4  4 ^5  2  2  2 ^5  2  .',
        '.  1  2 t3 t3  3  3 ^5  2  2 H2 ^5 t3  .',
        '.  .  1  2  3 t3  3 ^5  2  2  2 ^5 t3  .',
        '.  .  1  1  2  3  3 ^5  2  2  2  3  2  .',
        '.  .  .  1  1  2  3 ^5 ^5  1 ^5 ^5  1  .',
        '.  .  .  .  1  1  2 t3 t3  1  3  2  1  .',
        '.  .  .  .  .  .  .  .  .  .  .  .  .  .',
      ],
    },
    {
      name: 'Перешийок', N: 14, tides: 4, days: 3, W0: 1, seed: 2207, floor: 1.2, hamlets: 3,
      tools: ['village', 'saw', 'quarry', 'dam'], start: { wood: 7, stone: 3 },
      intro: 'Вода розріже острів навпіл. Ланцюг дамб через перешийок збереже дорогу між пагорбами.',
      peaks: [[0.27, 0.48, 8.6, 0.36], [0.75, 0.5, 6.8, 0.3]], ridges: [[0.27, 0.48, 0.75, 0.5, 2.8, 0.15]], noise: 0.8, forest: 0.3, rock: 0.06,
    },
    {
      name: 'Затока', N: 15, tides: 5, days: 3, W0: 1, seed: 3319, floor: 1.2, hamlets: 2, lowHamlets: 1,
      tools: ['village', 'saw', 'quarry', 'dam'], start: { wood: 7, stone: 4 },
      intro: 'Перегороди вхід у затоку. Замкнена дамбами вода стече, і з’явиться нова земля.',
      peaks: [[0.3, 0.28, 8.6, 0.3], [0.78, 0.36, 6.6, 0.24], [0.4, 0.8, 6.4, 0.24]],
      ridges: [[0.3, 0.28, 0.78, 0.36, 4.0, 0.12], [0.3, 0.28, 0.4, 0.8, 3.6, 0.12]], dips: [[0.66, 0.66, 2.6, 0.22]], noise: 0.6, forest: 0.28, rock: 0.08,
    },
    {
      name: 'Три сестри', N: 15, tides: 5, days: 3, W0: 1, seed: 4417, floor: 1.2, hamlets: 3, lowHamlets: 1,
      tools: ['village', 'saw', 'quarry', 'dam'], start: { wood: 7, stone: 3 },
      intro: 'Три пагорби, три перешийки, а каменю на все не вистачить. Вирішуй, що тримати.',
      peaks: [[0.3, 0.32, 8.6, 0.3], [0.74, 0.34, 7.0, 0.27], [0.5, 0.76, 7.2, 0.28]],
      ridges: [[0.3, 0.32, 0.74, 0.34, 3.2, 0.13], [0.3, 0.32, 0.5, 0.76, 2.8, 0.12], [0.74, 0.34, 0.5, 0.76, 2.4, 0.11]], noise: 0.8, forest: 0.28, rock: 0.08,
    },
    {
      name: 'Штормовий рік', N: 15, tides: 5, days: 3, W0: 1, seed: 6607, floor: 1.2, hamlets: 3, lowHamlets: 2, rises: [1, 1, 2, 1, 1],
      tools: ['village', 'saw', 'quarry', 'dam'], start: { wood: 7, stone: 4 },
      intro: 'Третій приплив буде штормовим: вода підніметься одразу на два уступи.',
      peaks: [[0.5, 0.5, 8.6, 0.27], [0.22, 0.26, 7.0, 0.22], [0.78, 0.24, 7.4, 0.22], [0.24, 0.78, 6.8, 0.22], [0.78, 0.76, 7.6, 0.22]],
      ridges: [[0.5, 0.5, 0.22, 0.26, 3.4, 0.1], [0.5, 0.5, 0.78, 0.24, 3.0, 0.1], [0.5, 0.5, 0.24, 0.78, 2.6, 0.1], [0.5, 0.5, 0.78, 0.76, 3.8, 0.1]], noise: 0.8, forest: 0.3, rock: 0.08,
    },
    {
      name: 'Мілини', N: 16, tides: 3, days: 4, W0: 1, seed: 7703, floor: 1.3, hamlets: 2, lowHamlets: 3,
      tools: ['village', 'saw', 'quarry', 'dam'], start: { wood: 8, stone: 6 },
      intro: 'Низькі острівці серед мілини. Тут дамби будують більше землі, ніж її було.',
      peaks: [[0.5, 0.46, 8.6, 0.25], [0.2, 0.22, 5.6, 0.2], [0.8, 0.2, 6.0, 0.2], [0.16, 0.66, 5.6, 0.22], [0.46, 0.82, 5.2, 0.2], [0.82, 0.66, 6.2, 0.22], [0.34, 0.44, 4.2, 0.18], [0.66, 0.44, 4.0, 0.18]],
      noise: 1.0, forest: 0.32, rock: 0.11,
    },
    {
      name: 'Високий берег', N: 16, tides: 6, days: 3, W0: 1, seed: 8819, floor: 1.2, hamlets: 4, lowHamlets: 2,
      tools: ['village', 'saw', 'quarry', 'dam'], start: { wood: 8, stone: 4 },
      intro: 'Останній острів і шість припливів. Втримай усіх разом до кінця.',
      peaks: [[0.36, 0.3, 8.8, 0.31], [0.78, 0.3, 8.0, 0.26], [0.24, 0.76, 7.6, 0.26], [0.7, 0.76, 7.8, 0.28]],
      ridges: [[0.36, 0.3, 0.78, 0.3, 4.0, 0.1], [0.36, 0.3, 0.24, 0.76, 3.4, 0.1], [0.78, 0.3, 0.7, 0.76, 2.8, 0.1], [0.24, 0.76, 0.7, 0.76, 4.4, 0.09]], noise: 0.8, forest: 0.28, rock: 0.08,
    },
  ];




  const GOALS = [[28,41,52],[30,45,57],[53,80,101],[48,72,91],[55,82,104],[54,80,102],[42,62,79],[79,118,149]];
  LEVELS.forEach((l, i) => { l.goals = GOALS[i]; });

  // ---------- RNG / шум ----------
  function rnd(st) {
    let a = (st.s = (st.s + 0x6D2B79F5) | 0);
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function hash2(a, b) {
    let h = (a ^ Math.imul(b + 0x9E3779B9, 0x85EBCA6B)) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x7FEB352D) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x846CA68B) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
  }
  function makeNoise(rng, size) {
    const g = [];
    for (let i = 0; i < size * size; i++) g.push(rnd(rng));
    const get = (i, j) => g[(((j % size) + size) % size) * size + (((i % size) + size) % size)];
    const sm = (t) => t * t * (3 - 2 * t);
    return (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = sm(x - xi), yf = sm(y - yi);
      const a = get(xi, yi), b = get(xi + 1, yi), c = get(xi, yi + 1), d = get(xi + 1, yi + 1);
      return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
    };
  }
  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    const qx = ax + t * dx - px, qy = ay + t * dy - py;
    return Math.sqrt(qx * qx + qy * qy);
  }

  // ---------- Сусіди ----------
  function n4(st, c) {
    const N = st.N, x = c % N, y = (c / N) | 0, out = [];
    if (x > 0) out.push(c - 1); if (x < N - 1) out.push(c + 1);
    if (y > 0) out.push(c - N); if (y < N - 1) out.push(c + N);
    return out;
  }
  function n8(st, c) {
    const N = st.N, x0 = c % N, y0 = (c / N) | 0, out = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const x = x0 + dx, y = y0 + dy;
      if (x >= 0 && y >= 0 && x < N && y < N) out.push(y * N + x);
    }
    return out;
  }
  const isBorder = (N, c) => { const x = c % N, y = (c / N) | 0; return x === 0 || y === 0 || x === N - 1 || y === N - 1; };

  // ---------- Карта ----------
  function parseMap(L) {
    const rows = L.map.map((r) => r.trim().split(/\s+/));
    const N = rows.length;
    const height = new Array(N * N).fill(0), feature = new Array(N * N).fill(F.NONE), hamlets = [];
    let town = -1;
    rows.forEach((r, y) => r.forEach((tok, x) => {
      const c = y * N + x;
      if (tok === '.') return;
      const m = tok.length > 1 ? tok[0] : '';
      height[c] = +tok[tok.length - 1];
      if (m === 't') feature[c] = F.FOREST;
      else if (m === '^') feature[c] = F.ROCK;
      else if (m === 'T') town = c;
      else if (m === 'H') hamlets.push(c);
    }));
    return { height, feature, town, hamlets };
  }
  function genMap(L) {
    if (L.map) return parseMap(L);
    const N = L.N;
    const rng = { s: L.seed >>> 0 };
    const n1 = makeNoise(rng, 7), n2 = makeNoise(rng, 9), nf = makeNoise(rng, 6), nr = makeNoise(rng, 5);
    const ox = rnd(rng) * 7, oy = rnd(rng) * 7;
    const raw = new Array(N * N).fill(-9);
    for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
      const u = x / (N - 1), v = y / (N - 1);
      let f = -9;
      for (const p of L.peaks) {
        const dx = u - p[0], dy = v - p[1];
        f = Math.max(f, p[2] * (1 - Math.sqrt(dx * dx + dy * dy) / p[3]));
      }
      for (const r of L.ridges || []) f = Math.max(f, r[4] * (1 - segDist(u, v, r[0], r[1], r[2], r[3]) / r[5]));
      for (const d of L.dips || []) { const dd = Math.sqrt((u - d[0]) ** 2 + (v - d[1]) ** 2); if (dd < d[3]) f -= d[2] * (1 - dd / d[3]); }
      if (L.floor) f = Math.max(f, L.floor - Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5)) * 1.6);
      f += (n1(x * 0.38 + ox, y * 0.38 + oy) - 0.5) * L.noise + (n2(x * 0.9 + oy, y * 0.9 + ox) - 0.5) * L.noise * 0.5;
      raw[y * N + x] = f;
    }
    const height = raw.map((f) => (f < 0.5 ? 0 : Math.max(1, Math.min(MAXH - 1, Math.round(f)))));
    for (const p of L.patch || []) height[p[1] * N + p[0]] = p[2];
    // місто — у найвищій точці першого пагорба
    const p0 = L.peaks[0];
    let town = -1, best = -1e9;
    for (let c = 0; c < N * N; c++) {
      if (!height[c]) continue;
      const x = (c % N) / (N - 1), y = ((c / N) | 0) / (N - 1);
      const v = raw[c] - Math.sqrt((x - p0[0]) ** 2 + (y - p0[1]) ** 2) * 6;
      if (v > best) { best = v; town = c; }
    }
    const tmp = { N };
    height[town] = MAXH;
    for (const v of n4(tmp, town)) if (height[v]) height[v] = Math.max(height[v], MAXH - 2);
    const W0 = L.W0 || 0;
    const cheb = (a, b) => Math.max(Math.abs((a % N) - (b % N)), Math.abs(((a / N) | 0) - ((b / N) | 0)));
    const feature = new Array(N * N).fill(F.NONE);
    const land = [];
    for (let c = 0; c < N * N; c++) if (height[c] > W0) land.push(c);
    const fc = land.filter((c) => height[c] >= W0 + 1 && height[c] <= 6 && cheb(c, town) >= 2)
      .map((c) => ({ c, v: nf((c % N) * 0.5 + ox, ((c / N) | 0) * 0.5 + oy) + rnd(rng) * 0.22 }))
      .sort((a, b) => b.v - a.v);
    const nForest = Math.round(L.forest * land.length);
    for (let i = 0; i < Math.min(nForest, fc.length); i++) feature[fc[i].c] = F.FOREST;
    const rc = land.filter((c) => height[c] >= W0 + 2 && feature[c] === F.NONE && cheb(c, town) >= 2)
      .map((c) => ({ c, v: nr((c % N) * 0.6 + oy, ((c / N) | 0) * 0.6 + ox) + rnd(rng) * 0.3 }))
      .sort((a, b) => b.v - a.v);
    const nRock = Math.round(L.rock * land.length);
    for (let i = 0; i < Math.min(nRock, rc.length); i++) feature[rc[i].c] = F.ROCK;
    // хутори: високі (далеко від міста) і низинні (їх треба рятувати)
    const hamlets = [];
    const pick = (cands, want) => {
      let k = 0;
      for (const o of cands) {
        if (k >= want) break;
        if (hamlets.some((h) => cheb(h, o.c) < 3)) continue;
        hamlets.push(o.c); k++;
      }
    };
    pick(land.filter((c) => height[c] >= W0 + 2 && height[c] <= MAXH - 1 && feature[c] !== F.ROCK && cheb(c, town) >= 4)
      .map((c) => ({ c, v: height[c] * 0.35 + cheb(c, town) * 0.25 + rnd(rng) * 1.2 })).sort((a, b) => b.v - a.v), L.hamlets || 0);
    pick(land.filter((c) => height[c] >= W0 + 1 && height[c] <= W0 + 2 && feature[c] !== F.ROCK && cheb(c, town) >= 3)
      .map((c) => ({ c, v: n4(tmp, c).filter((n) => height[n] <= W0).length * -0.2 + rnd(rng) })).sort((a, b) => b.v - a.v), L.lowHamlets || 0);
    for (const h of hamlets) feature[h] = F.NONE;
    return { height, feature, town, hamlets };
  }

  // ---------- Стан ----------
  function newLevel(li, def) {
    const L = def || LEVELS[li];
    const g = genMap(L);
    const N = L.N, W0 = L.W0 || 0;
    const st = {
      v: 4, li, N, name: L.name,
      tides: L.tides, days: L.days, rises: L.rises || new Array(L.tides).fill(1), tools: L.tools.slice(),
      height: g.height, feature: g.feature, town: g.town,
      flooded: new Array(N * N).fill(0),
      bld: new Array(N * N).fill(-1), pop: new Array(N * N).fill(0), bridges: [],
      W: W0, W0, day: 0, tide: 0, wood: L.start.wood, stone: L.start.stone,
      lost: 0, left: 0, reclaimed: 0, built: 0, over: false, finalScore: 0,
      goals: (L.goals || [0, 0, 0]).slice(),
    };
    // вода заходить лише з моря: низина, відгороджена від моря сушею, лишається сухою
    for (let c = 0; c < N * N; c++) if (isBorder(N, c)) st.flooded[c] = 1;
    floodStep(st, W0, st.flooded, -1);
    st.bld[g.town] = B.TOWN;
    for (const h of g.hamlets) { st.bld[h] = B.VILLAGE; st.pop[h] = L.hamletPop || 2; }
    return st;
  }
  function clone(st) {
    const o = Object.assign({}, st);
    o.height = st.height.slice(); o.feature = st.feature.slice(); o.flooded = st.flooded.slice();
    o.bld = st.bld.slice(); o.pop = st.pop.slice(); o.bridges = st.bridges.map((b) => ({ a: b.a, b: b.b, mids: b.mids.slice() }));
    o.tools = st.tools.slice(); o.rises = st.rises.slice(); o.goals = st.goals.slice();
    return o;
  }
  const dry = (st, c, fl) => !(fl || st.flooded)[c];
  const shallow = (st, c) => st.flooded[c] && st.height[c] >= 1;
  function underBridge(st, c) { for (const b of st.bridges) if (b.mids.indexOf(c) >= 0) return true; return false; }

  // ---------- Зв'язність ----------
  function bridgeAdj(st, fl) {
    const adj = new Map();
    for (const b of st.bridges) {
      if (!dry(st, b.a, fl) || !dry(st, b.b, fl)) continue;
      (adj.get(b.a) || adj.set(b.a, []).get(b.a)).push(b.b);
      (adj.get(b.b) || adj.set(b.b, []).get(b.b)).push(b.a);
    }
    return adj;
  }
  function connectivity(st, fl) {
    fl = fl || st.flooded;
    const N = st.N, conn = new Uint8Array(N * N);
    const adj = bridgeAdj(st, fl);
    const q = [st.town]; conn[st.town] = 1;
    for (let i = 0; i < q.length; i++) {
      const u = q[i];
      for (const v of n4(st, u)) if (!conn[v] && dry(st, v, fl)) { conn[v] = 1; q.push(v); }
      const bl = adj.get(u);
      if (bl) for (const v of bl) if (!conn[v]) { conn[v] = 1; q.push(v); }
    }
    return conn;
  }
  // дерево доріг від міста до всіх будівель (для рендеру)
  function roadTree(st) {
    const N = st.N, par = new Int32Array(N * N).fill(-2), via = new Int8Array(N * N);
    const adj = bridgeAdj(st);
    const q = [st.town]; par[st.town] = -1;
    for (let i = 0; i < q.length; i++) {
      const u = q[i];
      for (const v of n4(st, u)) if (par[v] === -2 && dry(st, v)) { par[v] = u; via[v] = 0; q.push(v); }
      const bl = adj.get(u);
      if (bl) for (const v of bl) if (par[v] === -2) { par[v] = u; via[v] = 1; q.push(v); }
    }
    const segs = new Map();
    for (let c = 0; c < N * N; c++) {
      const b = st.bld[c];
      if (b < 0 || b === B.TOWN || b === B.DAM || par[c] === -2) continue;
      let u = c;
      while (par[u] >= 0) {
        const p = par[u];
        if (via[u] === 0) { const k = u < p ? u + ':' + p : p + ':' + u; if (segs.has(k)) break; segs.set(k, [Math.min(u, p), Math.max(u, p)]); }
        u = p;
      }
    }
    return [...segs.values()];
  }

  // ---------- Вода ----------
  // вода тече лише через сторони клітинок; дамби її зупиняють
  function floodStep(st, W, fl, extraDam) {
    const out = [], dist = new Int16Array(st.N * st.N).fill(-1), q = [];
    for (let c = 0; c < st.N * st.N; c++) if (fl[c]) { dist[c] = 0; q.push(c); }
    for (let i = 0; i < q.length; i++) {
      const u = q[i];
      for (const v of n4(st, u)) {
        if (dist[v] >= 0 || fl[v]) continue;
        if (st.height[v] > W || st.bld[v] === B.DAM || v === extraDam) continue;
        dist[v] = dist[u] + 1; fl[v] = 1; q.push(v); out.push({ c: v, d: dist[v] });
      }
    }
    return out;
  }
  // вода, відрізана дамбами від моря, стікає: ділянка стає сухою
  function drain(st, from) {
    const N = st.N, reach = new Uint8Array(N * N), q = [];
    for (let c = 0; c < N * N; c++) if (isBorder(N, c) && st.flooded[c]) { reach[c] = 1; q.push(c); }
    for (let i = 0; i < q.length; i++) for (const v of n4(st, q[i])) if (!reach[v] && st.flooded[v] && st.bld[v] !== B.DAM) { reach[v] = 1; q.push(v); }
    const out = [];
    for (let c = 0; c < N * N; c++) if (st.flooded[c] && !reach[c]) out.push(c);
    if (!out.length) return out;
    const fx = from == null ? out[0] % N : from % N, fy = from == null ? (out[0] / N) | 0 : (from / N) | 0;
    out.sort((a, b) => (Math.abs((a % N) - fx) + Math.abs(((a / N) | 0) - fy)) - (Math.abs((b % N) - fx) + Math.abs(((b / N) | 0) - fy)));
    for (const c of out) st.flooded[c] = 0;
    st.reclaimed += out.length;
    return out;
  }
  // at[c]: через скільки припливів клітинку заллє (99 — вистоїть)
  function forecast(st, extraDam) {
    const fl = st.flooded.slice(), at = new Array(st.N * st.N).fill(99);
    for (let c = 0; c < at.length; c++) if (fl[c]) at[c] = 0;
    let W = st.W;
    for (let k = st.tide; k < st.tides; k++) {
      W += st.rises[k];
      for (const o of floodStep(st, W, fl, extraDam == null ? -1 : extraDam)) at[o.c] = k - st.tide + 1;
    }
    return at;
  }

  function applyTide(st) {
    st.W += st.rises[st.tide];
    const flooded = floodStep(st, st.W, st.flooded, -1);
    const ev = { W: st.W, rise: st.rises[st.tide], flooded, lost: [], removed: [], drowned: [], broken: [], grow: [], shrink: [], abandon: [] };
    for (const o of flooded) {
      const c = o.c, b = st.bld[c];
      if (b === B.VILLAGE) { st.lost += st.pop[c]; ev.lost.push({ c, n: st.pop[c], d: o.d }); st.pop[c] = 0; }
      else if (b >= 0) ev.removed.push({ c, b, d: o.d });
      if (b >= 0) st.bld[c] = -1;
      if (st.feature[c] !== F.NONE) { ev.drowned.push({ c, f: st.feature[c], d: o.d }); st.feature[c] = F.NONE; }
    }
    st.bridges = st.bridges.filter((b) => {
      if (st.flooded[b.a] || st.flooded[b.b]) { ev.broken.push(b); return false; }
      return true;
    });
    const conn = connectivity(st);
    for (let c = 0; c < st.N * st.N; c++) {
      if (st.bld[c] !== B.VILLAGE) continue;
      if (conn[c]) { if (st.pop[c] < VMAX) { st.pop[c]++; ev.grow.push(c); } }
      else {
        st.pop[c]--; st.left++; ev.shrink.push(c);
        if (st.pop[c] <= 0) { st.pop[c] = 0; st.bld[c] = -1; ev.abandon.push(c); }
      }
    }
    st.tide++;
    if (st.tide >= st.tides) { st.over = true; st.finalScore = liveScore(st).score; ev.over = true; }
    return ev;
  }

  // ---------- Економіка ----------
  function around(st, c, f) { let n = 0; for (const v of n8(st, c)) if (!st.flooded[v] && st.feature[v] === f && st.bld[v] < 0) n++; return n; }
  function output(st, c, type) {
    const b = type == null ? st.bld[c] : type;
    if (b === B.SAW) return { wood: Math.min(SAW_MAX, around(st, c, F.FOREST)), stone: 0 };
    if (b === B.QUARRY) return { wood: 0, stone: Math.min(QUARRY_MAX, around(st, c, F.ROCK)) };
    if (b === B.TOWN) return { wood: 1, stone: 0 };
    return { wood: 0, stone: 0 };
  }
  function income(st) {
    const conn = connectivity(st);
    const src = []; let wood = 0, stone = 0;
    for (let c = 0; c < st.N * st.N; c++) {
      const b = st.bld[c];
      if (b !== B.SAW && b !== B.QUARRY && b !== B.TOWN) continue;
      if (!conn[c]) { src.push({ c, wood: 0, stone: 0, cut: true }); continue; }
      const o = output(st, c);
      wood += o.wood; stone += o.stone;
      src.push({ c, wood: o.wood, stone: o.stone });
    }
    return { wood, stone, src };
  }
  function endDay(st) {
    const inc = income(st);
    st.wood += inc.wood; st.stone += inc.stone;
    st.day++;
    let tide = null;
    if (st.day % st.days === 0) tide = applyTide(st);
    return { inc, tide };
  }
  const daysToTide = (st) => st.days - (st.day % st.days);

  // ---------- Будівництво ----------
  function costOf(tool, span) {
    if (tool === 'bridge') return { wood: 1 + (span || 1), stone: 0 };
    return { wood: COST[tool].wood, stone: COST[tool].stone };
  }
  const afford = (st, cost) => st.wood >= cost.wood && st.stone >= cost.stone;
  function checkCell(st, tool, c) {
    if (c < 0 || c >= st.N * st.N) return { ok: false, why: '' };
    if (st.bld[c] >= 0) return { ok: false, why: 'busy' };
    if (st.flooded[c]) {
      if (tool !== 'dam') return { ok: false, why: 'water' };
      if (st.height[c] < 1 || isBorder(st.N, c)) return { ok: false, why: 'deep' };
    }
    if (st.feature[c] === F.ROCK) return { ok: false, why: 'rock' };
    if (underBridge(st, c)) return { ok: false, why: 'bridge' };
    const cost = costOf(tool);
    if (!afford(st, cost)) return { ok: false, why: cost.stone > st.stone ? 'stone' : 'wood', cost };
    return { ok: true, cost };
  }
  function bridgeCheck(st, a, b) {
    const N = st.N;
    if (a === b || a < 0 || b < 0) return { ok: false, why: '' };
    const ax = a % N, ay = (a / N) | 0, bx = b % N, by = (b / N) | 0;
    if (ax !== bx && ay !== by) return { ok: false, why: 'line' };
    const dist = Math.abs(ax - bx) + Math.abs(ay - by), span = dist - 1;
    if (span < 1) return { ok: false, why: 'short' };
    if (span > BRIDGE_MAX) return { ok: false, why: 'far' };
    if (!dry(st, a) || !dry(st, b)) return { ok: false, why: 'water' };
    const step = ax === bx ? (by > ay ? N : -N) : (bx > ax ? 1 : -1);
    const mids = [];
    const lo = Math.min(st.height[a], st.height[b]);
    let wet = 0;
    for (let m = a + step; m !== b; m += step) {
      if (underBridge(st, m)) return { ok: false, why: 'cross' };
      if (st.flooded[m]) { wet++; mids.push(m); continue; }
      if (st.height[m] >= lo || st.bld[m] >= 0 || st.feature[m] === F.ROCK) return { ok: false, why: 'blocked' };
      mids.push(m);
    }
    for (const br of st.bridges) if ((br.a === a && br.b === b) || (br.a === b && br.b === a)) return { ok: false, why: 'dup' };
    const cost = costOf('bridge', span);
    if (!afford(st, cost)) return { ok: false, why: 'wood', cost, mids, span };
    return { ok: true, cost, mids, span, wet };
  }
  function build(st, tool, c, c2) {
    if (tool === 'bridge') {
      const r = bridgeCheck(st, c, c2);
      if (!r.ok) return null;
      st.wood -= r.cost.wood; st.stone -= r.cost.stone;
      const cleared = [];
      for (const m of r.mids) if (st.feature[m] === F.FOREST) { st.feature[m] = F.NONE; cleared.push(m); }
      const br = { a: c, b: c2, mids: r.mids };
      st.bridges.push(br); st.built++;
      return { tool, bridge: br, cleared, drained: [] };
    }
    const r = checkCell(st, tool, c);
    if (!r.ok) return null;
    st.wood -= r.cost.wood; st.stone -= r.cost.stone;
    const hadForest = st.feature[c] === F.FOREST;
    if (hadForest) st.feature[c] = F.NONE;
    const wasWater = !!st.flooded[c];
    st.flooded[c] = 0;
    st.bld[c] = TOOL_B[tool];
    if (tool === 'village') st.pop[c] = 1;
    st.built++;
    const drained = tool === 'dam' ? drain(st, c) : [];
    return { tool, c, hadForest, wasWater, drained };
  }
  // дамба лінією: будує по черзі, поки вистачає каменю
  function buildLine(st, cells) {
    const built = [], drained = [];
    for (const c of cells) {
      const ev = build(st, 'dam', c);
      if (!ev) break;
      built.push(ev);
      drained.push(...ev.drained);
    }
    return { built, drained };
  }

  // ---------- Оцінка ----------
  function liveScore(st) {
    const conn = connectivity(st);
    let score = 0, cut = 0;
    for (let c = 0; c < st.N * st.N; c++) if (st.bld[c] === B.VILLAGE) { score += st.pop[c]; if (!conn[c]) cut += st.pop[c]; }
    return { score, cut };
  }
  // скільки жителів буде наприкінці, якщо більше нічого не будувати
  function futureScore(st) {
    if (st.over) return st.finalScore;
    const s = clone(st);
    while (!s.over) applyTide(s);
    return s.finalScore;
  }
  // що станеться з будівлями в наступний приплив
  function nextTideRisk(st) {
    if (st.over) return { flood: [], cut: [], lose: [] };
    const s = clone(st);
    const pre = connectivity(s);
    const ev = applyTide(s);
    const post = connectivity(s);
    const cut = [];
    for (let c = 0; c < st.N * st.N; c++) {
      const b = st.bld[c];
      if (b < 0 || b === B.TOWN || b === B.DAM) continue;
      if (pre[c] && !s.flooded[c] && !post[c]) cut.push(c);
    }
    return { flood: ev.flooded.map((o) => o.c), cut, lose: ev.lost.map((o) => o.c) };
  }
  function starsFor(st, score) { let n = 0; for (const g of st.goals) if (score >= g) n++; return n; }

  const Logic = {
    MAXH, B, F, TOOLS, TOOL_B, COST, VMAX, BRIDGE_MAX, SAW_MAX, QUARRY_MAX, LEVELS,
    rnd, hash2, n4, n8, isBorder, genMap, newLevel, clone, dry, shallow, underBridge, connectivity, roadTree,
    floodStep, drain, forecast, applyTide, around, output, income, endDay, daysToTide,
    costOf, afford, checkCell, bridgeCheck, build, buildLine, liveScore, futureScore, nextTideRisk, starsFor,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Logic;
  else root.Logic = Logic;
})(typeof window !== 'undefined' ? window : globalThis);
