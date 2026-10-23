/* Архіпелаг — рендер, інтерфейс, анімації */
(function () {
  'use strict';
  const L = window.Logic;
  const BT = L.B, F = L.F;
  const $ = (s, el) => (el || document).querySelector(s);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const REDUCED = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const TS = REDUCED ? 0.4 : 1;

  // ---------- Сховище ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem('archipelag3:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('archipelag3:' + k, JSON.stringify(v)); } catch (e) { /* немає сховища */ } },
    del(k) { try { localStorage.removeItem('archipelag3:' + k); } catch (e) { /* */ } },
  };

  // ---------- Кольори ----------
  const COL = {
    town: '#E2483D', village: '#2F5FD0', saw: '#EE9F2E', quarry: '#7A5AD3', dam: '#8F8B83', pier: '#0E9E8C',
    water: '#2E7E92', forest: '#4F9E5E', rock: '#8C8F99', gold: '#E8A317', ink: '#1E2328', danger: '#D9443A', warn: '#E8A317',
    white: '#F6F4EF', road: '#F4EBD8', wood: '#B07A45', stone: '#7F8796',
  };
  const TOOL_COL = { village: COL.village, saw: COL.saw, quarry: COL.quarry, dam: COL.dam };
  const TOOL_NAME = { village: 'Селище', saw: 'Лісопилка', quarry: 'Каменоломня', dam: 'Дамба' };
  const TOOL_HINT = {
    village: 'Росте після кожного припливу, якщо з’єднане з містом',
    saw: `Щодня дає дерево за кожен ліс поруч, до ${L.SAW_MAX}`,
    quarry: `Щодня дає камінь за кожну скелю поруч, до ${L.QUARRY_MAX}`,
    dam: 'Не тоне й не пускає воду. Ставиться і на мілину. Протягни лінію: замкнена вода стече',
  };
  const TYPE_NAME = ['Місто', 'Селище', 'Лісопилка', 'Каменоломня', 'Дамба'];
  const SEASON_PAL = [
    { bg: '#E2E6DC', top: ['#EAD9AE', '#C9DF9F', '#AED38D', '#94C47E', '#7DB273', '#B5C2A3', '#D3D6C9', '#E6E4DA'], side: ['#D4BF93', '#C2AB86'], tree: ['#7CC46D', '#5DAE66', '#98C95C'], water: '#97CAD4' },
    { bg: '#E9E4D7', top: ['#EBD6A4', '#BFD68C', '#A1C77A', '#88B66B', '#73A462', '#B0B999', '#D0D0C1', '#E4E1D6'], side: ['#D5BE91', '#C0A882'], tree: ['#4F9E5E', '#3E8B55', '#6CAA52'], water: '#92C5D1' },
    { bg: '#EADBCE', top: ['#E8D2A4', '#D9CF8F', '#CBBE7A', '#B8A86C', '#A4955F', '#BFB6A2', '#D5CFC2', '#E5E0D6'], side: ['#D2BB90', '#BEA481'], tree: ['#E6A03A', '#D7703E', '#CBB24A'], water: '#96C2CC' },
    { bg: '#DBE2E8', top: ['#E2DCC9', '#DDE5DC', '#E3EAE6', '#EAEFEE', '#F1F4F4', '#F5F7F7', '#FAFBFB', '#FCFDFD'], side: ['#D1C4A6', '#C2B59B'], tree: ['#C6DBD3', '#B1CCC2', '#DCE8E3'], water: '#A1C5D2' },
  ];

  // ---------- Текст ----------
  function plural(n, a, b, c) { const m10 = n % 10, m100 = n % 100; if (m10 === 1 && m100 !== 11) return a; if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return b; return c; }
  const fmt = (v) => (v > 0 ? '+' + v : v < 0 ? '−' + Math.abs(v) : '0');
  const esc = (s) => String(s).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  const WHY = {
    water: 'Вода', busy: 'Зайнято', rock: 'Скеля', wood: 'Бракує дерева', stone: 'Бракує каменю', deep: 'Тут глибоко',
  };

  const ICON = {
    village: '<path d="M3.5 11.2 12 4l8.5 7.2V20a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z"/>',
    saw: '<path d="m12 2.5 1.7 2.6 3-.7.5 3.1 2.8 1.3-1.4 2.8 1.4 2.8-2.8 1.3-.5 3.1-3-.7L12 21.5l-1.7-2.4-3 .7-.5-3.1-2.8-1.3L5.4 12.6 4 9.8l2.8-1.3.5-3.1 3 .7z"/><circle cx="12" cy="12" r="2.8" fill="#fff"/>',
    quarry: '<path d="M2.5 20.5v-6h6.2V9.2h6.6v5.3h6.2v6z"/><path d="m15.5 3.5 5 5-1.6 1.6-5-5z"/>',
    dam: '<rect x="2.5" y="8" width="19" height="12.5" rx="1.6"/><path d="M2.5 14.2h19M8.2 8v6.2M15.8 8v6.2M12 14.2v6.3" stroke="#fff" stroke-width="1.4" fill="none"/>',
    town: '<path d="M4.5 21V10.5L7.5 8V4.5h2.2v2h4.6v-2h2.2V8l3 2.5V21h-5.6v-4.2a1.9 1.9 0 0 0-3.8 0V21z"/>',
    people: '<circle cx="12" cy="7.2" r="3.7"/><path d="M4.3 20.6c.6-4.4 3.7-7.2 7.7-7.2s7.1 2.8 7.7 7.2z"/>',
    wood: '<rect x="2.5" y="7.5" width="19" height="9" rx="4.5"/><circle cx="17" cy="12" r="2.6" fill="#fff" opacity=".5"/>',
    stone: '<path d="M3.5 15.5 6.6 7.4 12.8 4l6.4 3.6 1.6 8.4-6 4.4-8.3-.9z"/>',
    water: '<path d="M2.5 10.5c2.4 0 2.4-2.3 4.8-2.3s2.4 2.3 4.7 2.3 2.4-2.3 4.8-2.3 2.4 2.3 4.7 2.3M2.5 16.5c2.4 0 2.4-2.3 4.8-2.3s2.4 2.3 4.7 2.3 2.4-2.3 4.8-2.3 2.4 2.3 4.7 2.3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    unlink: '<path d="M9.8 14.2 7.4 16.6a3 3 0 0 1-4.2-4.2l2.4-2.4M14.2 9.8l2.4-2.4a3 3 0 0 1 4.2 4.2l-2.4 2.4M8 3.5V6M3.5 8H6M16 20.5V18M20.5 16H18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    warn: '<path d="M12 3.2 22 20.5H2z"/><path d="M12 9.5v5M12 17.3v.2" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>',
    star: '<path d="m12 2.8 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z"/>',
    forest: '<path d="M12 2.5 19 14h-4l3 4.4H6L9 14H5z"/><rect x="11" y="18" width="2" height="3.6" rx=".5"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10.5" rx="2.2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2.2"/>',
    arrow: '<path d="M5 12h13M13 6.5 18.5 12 13 17.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  };
  const svgI = (name, color, size) => `<svg class="ico" viewBox="0 0 24 24" width="${size || 14}" height="${size || 14}" fill="${color || 'currentColor'}" style="color:${color || 'currentColor'}" aria-hidden="true">${ICON[name]}</svg>`;

  // ---------- Твіни ----------
  const E = {
    linear: (t) => t,
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inCubic: (t) => t * t * t,
    inQuad: (t) => t * t,
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  };
  const tweens = new Set();
  let NOW = performance.now();
  function tween(o) {
    return new Promise((res) => {
      tweens.add({ t0: NOW + (o.delay || 0) * TS, dur: Math.max(1, (o.dur || 300) * TS), ease: o.ease || E.outCubic, update: o.update, start: o.start, done: o.done, res, started: false });
    });
  }
  function stepTweens() {
    for (const tw of tweens) {
      const t = (NOW - tw.t0) / tw.dur;
      if (t < 0) continue;
      if (!tw.started) { tw.started = true; if (tw.start) tw.start(); }
      const k = Math.min(1, t);
      if (tw.update) tw.update(tw.ease(k), k);
      if (k >= 1) { tweens.delete(tw); if (tw.done) tw.done(); tw.res(); }
    }
  }
  const sleep = (ms) => tween({ dur: ms });

  // ---------- Звук ----------
  const Sfx = {
    ctx: null, master: null, on: store.get('sound', true),
    ensure() {
      if (this.ctx) return this.ctx;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = 0.5; this.master.connect(this.ctx.destination); } catch (e) { this.ctx = null; }
      return this.ctx;
    },
    tone(freq, dur, o) {
      o = o || {};
      if (!this.on) return; const ctx = this.ensure(); if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume();
      const t = ctx.currentTime + (o.delay || 0);
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * o.slide), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(o.gain || 0.1, t + (o.attack || 0.006));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g); g.connect(this.master); osc.start(t); osc.stop(t + dur + 0.03);
    },
    noise(dur, o) {
      o = o || {};
      if (!this.on) return; const ctx = this.ensure(); if (!ctx) return;
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate); const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(); src.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass';
      const t = ctx.currentTime + (o.delay || 0);
      f.frequency.setValueAtTime(o.from || 300, t);
      f.frequency.exponentialRampToValueAtTime(o.to || 1400, t + dur * 0.55);
      f.frequency.exponentialRampToValueAtTime(o.from || 300, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.gain || 0.08, t + dur * 0.45); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(this.master); src.start(t); src.stop(t + dur + 0.05);
    },
    select() { this.tone(700, 0.07, { type: 'triangle', gain: 0.045 }); },
    build(tool) {
      const f = { village: 440, saw: 392, quarry: 330, dam: 262 }[tool] || 440;
      this.tone(f, 0.18, { type: 'triangle', gain: 0.11 });
      this.tone(f * 1.5, 0.12, { gain: 0.035, delay: 0.035 });
      if (tool === 'dam' || tool === 'quarry') this.noise(0.18, { gain: 0.05, from: 200, to: 700 });
    },
    knock(i) { this.tone(300 + i * 40, 0.06, { type: 'square', gain: 0.025, delay: i * 0.07 * TS }); },
    coin(i) { this.tone(880 * Math.pow(2, (i % 5) / 12), 0.08, { type: 'triangle', gain: 0.035 }); },
    tide(storm) { this.noise(storm ? 2.4 : 1.8, { gain: storm ? 0.13 : 0.09, from: 180, to: storm ? 1400 : 900 }); this.tone(98, 1.4, { gain: 0.05, slide: 0.85 }); },
    sink() { this.tone(240, 0.4, { gain: 0.05, slide: 0.45 }); },
    grow(i) { const sc = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24]; this.tone(523 * Math.pow(2, sc[i % sc.length] / 12), 0.1, { type: 'triangle', gain: 0.04, delay: i * 0.05 * TS }); },
    loss() { this.tone(196, 0.5, { type: 'triangle', gain: 0.06, slide: 0.7 }); },
    star(i) { const f = [523, 659, 784][i] || 784; this.tone(f, 0.3, { type: 'triangle', gain: 0.1 }); this.tone(f * 2, 0.22, { gain: 0.03, delay: 0.04 }); },
    whoosh() { this.noise(0.5, { gain: 0.05, from: 700, to: 2600 }); },
    drain() { this.noise(1.3, { gain: 0.08, from: 1600, to: 260 }); this.tone(330, 0.9, { type: 'triangle', gain: 0.05, slide: 0.5 }); [523, 659, 784].forEach((f, i) => this.tone(f, 0.25, { type: 'triangle', gain: 0.05, delay: 0.7 + i * 0.09 })); },
    bad() { this.tone(170, 0.16, { type: 'square', gain: 0.02, slide: 0.8 }); },
    fail() { [392, 330, 262].forEach((f, i) => this.tone(f, 0.4, { type: 'triangle', gain: 0.07, delay: i * 0.16 })); },
    win() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.35, { type: 'triangle', gain: 0.08, delay: i * 0.11 })); },
  };

  // ---------- Сцена ----------
  const canvas = $('#scene');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    document.body.classList.add('no-webgl');
    return;
  }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SEASON_PAL[0].bg);
  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd6cdbd, 0.5));
  const sun = new THREE.DirectionalLight(0xfff3e3, 0.72);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  scene.add(sun); scene.add(sun.target);

  const BASE = 0.16, STEP = 0.26;
  const tileTop = (h) => BASE + h * STEP;
  const waterTop = (W) => BASE + W * STEP + 0.075;
  let N = 13, OFF = 6;
  const wx = (c) => (c % N) - OFF;
  const wz = (c) => ((c / N) | 0) - OFF;
  const BH = [0.95, 0.5, 0.45, 0.6, 0];

  // ---------- Матеріали ----------
  function std(hex, extra) {
    return new THREE.MeshStandardMaterial(Object.assign({ color: new THREE.Color(hex), roughness: 1, metalness: 0, flatShading: true }, extra || {}));
  }
  const pal0 = SEASON_PAL[0];
  const M = {
    topH: [null].concat(pal0.top.map((c) => std(c))),
    side: [std(pal0.side[0]), std(pal0.side[1])],
    water: std(pal0.water), waterSide: std(new THREE.Color(pal0.water).multiplyScalar(0.8).getHex()),
    plinth: std('#3B454F'), plinthTop: std('#46515C'),
    white: std(COL.white), wood: std('#A47A52'), woodDark: std('#7E5C3E'), dark: std('#353A41'), steel: std('#A3A9AF'),
    stone: std('#A6A197'), stoneTop: std('#C4BFB5'), stoneLight: std('#D8D4CB'), rock: std('#B9B3A8'),
    tree: pal0.tree.map((c) => std(c)), trunk: std('#8C6A4C'),
    road: std(COL.road), roadSide: std('#DCCFB5'),
    town: std(COL.town), village: std(COL.village), villageDark: std('#244AA6'), saw: std(COL.saw), quarry: std(COL.quarry),
    foam: new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.75, depthWrite: false }),
  };
  M.waterShallow = std(new THREE.Color(pal0.water).lerp(new THREE.Color('#F2FBF8'), 0.38).getHex());
  M.topH[0] = M.topH[1];
  M.sideH = [M.side[0], M.side[0], M.side[1], M.side[1], M.side[1], M.side[1], M.side[1], M.side[1], M.side[1]];
  const ghostCache = new Map();
  function ghostMat(m) {
    if (Array.isArray(m)) return m.map(ghostMat);
    let g = ghostCache.get(m);
    if (!g) { g = m.clone(); g.transparent = true; g.opacity = 0.6; g.depthWrite = false; ghostCache.set(m, g); }
    return g;
  }

  // ---------- Текстури ----------
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function canvasTex(size, draw) {
    const cv = document.createElement('canvas'); cv.width = cv.height = size;
    draw(cv.getContext('2d'), size);
    const t = new THREE.CanvasTexture(cv); t.anisotropy = 4; return t;
  }
  const TEX = {
    fill: canvasTex(128, (g, s) => { g.fillStyle = '#fff'; rr(g, 7, 7, s - 14, s - 14, 22); g.fill(); }),
    ring: canvasTex(128, (g, s) => { g.strokeStyle = '#fff'; g.lineWidth = 9; rr(g, 10, 10, s - 20, s - 20, 20); g.stroke(); }),
    dot: canvasTex(64, (g, s) => { g.fillStyle = '#fff'; g.beginPath(); g.arc(s / 2, s / 2, s * 0.16, 0, Math.PI * 2); g.fill(); }),
    stripes: canvasTex(128, (g, s) => {
      g.save(); rr(g, 7, 7, s - 14, s - 14, 22); g.clip();
      g.strokeStyle = '#fff'; g.lineWidth = 9;
      for (let i = -s; i < 2 * s; i += 24) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + s, s); g.stroke(); }
      g.restore();
    }),
    blob: canvasTex(128, (g, s) => {
      const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      gr.addColorStop(0, 'rgba(0,0,0,0.6)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.28)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
    }),
  };
  const planeGeo = new THREE.PlaneGeometry(1, 1);
  const blobMat = new THREE.MeshBasicMaterial({ map: TEX.blob, transparent: true, depthWrite: false, opacity: 0.45 });

  // ---------- Геометрія ----------
  const GC = new Map();
  const geo = (key, make) => { let g = GC.get(key); if (!g) { g = make(); GC.set(key, g); } return g; };
  const box = (w, h, d) => geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
  const cyl = (rt, rb, h, s) => geo(`c${rt},${rb},${h},${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
  const unitBox = geo('unit', () => { const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0.5, 0, 0); return g; });
  function prism(w, h, d) {
    return geo(`p${w},${h},${d}`, () => {
      const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }); g.translate(0, 0, -d / 2); return g;
    });
  }
  function roundedShape(w, d, r) {
    const s = new THREE.Shape(), x = -w / 2, y = -d / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
    s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  function bevelBox(w, h, d, r, bev) {
    const shape = roundedShape(w - 2 * bev, d - 2 * bev, r);
    const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.002, h - 2 * bev), bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, curveSegments: 3, steps: 1 });
    g.rotateX(-Math.PI / 2); g.translate(0, bev, 0);
    return g;
  }
  const tileGeo = (h) => geo('tile' + h, () => bevelBox(1, tileTop(h), 1, 0.1, 0.045));
  const waterGeo = (() => { const g = new THREE.BoxGeometry(1.004, 1, 1.004); g.translate(0, 0.5, 0); return g; })();
  const pickGeo = (() => { const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0); return g; })();
  const pickMat = new THREE.MeshBasicMaterial();

  // ---------- Моделі ----------
  function seeded(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return (s >>> 8) / 16777216; }; }
  function mk(parent, geom, mat, x, y, z, ghost, rx, ry, rz) {
    const m = new THREE.Mesh(geom, ghost ? ghostMat(mat) : mat);
    m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, rz || 0);
    m.castShadow = !ghost; m.receiveShadow = !ghost; parent.add(m); return m;
  }
  function blobShadow(g, s) { const m = new THREE.Mesh(planeGeo, blobMat); m.rotation.x = -Math.PI / 2; m.position.y = 0.006; m.scale.setScalar(s || 0.95); m.renderOrder = 1; g.add(m); }

  const VSLOTS = [[-0.17, -0.16], [0.18, -0.17], [-0.17, 0.18], [0.18, 0.17]];
  function makeHouse(c, i, ghost) {
    const R = seeded(L.hash2(c * 7 + i, 41));
    const g = new THREE.Group();
    const h = 0.18 + R() * 0.12, w = 0.22 + R() * 0.05;
    mk(g, box(w, h, 0.2), M.white, 0, h / 2, 0, ghost);
    mk(g, prism(w + 0.07, 0.14, 0.25), M.village, 0, h, 0, ghost);
    mk(g, box(0.05, 0.08, 0.01), M.villageDark, -w * 0.2, 0.04, 0.101, ghost);
    if (R() < 0.6) mk(g, box(0.05, 0.1, 0.05), M.white, w * 0.25, h + 0.08, -0.04, ghost);
    g.position.set(VSLOTS[i][0] + (R() - 0.5) * 0.04, 0, VSLOTS[i][1] + (R() - 0.5) * 0.04);
    g.rotation.y = Math.floor(R() * 4) * Math.PI / 2;
    return g;
  }
  function setVillagePop(g, pop, anim, delay) {
    const hs = g.userData.houses;
    const ps = [];
    while (hs.length < pop) {
      const h = makeHouse(g.userData.cell, hs.length, g.userData.ghost);
      g.add(h); hs.push(h);
      if (anim) {
        h.scale.setScalar(0.001);
        ps.push(tween({ dur: 520, delay: delay || 0, ease: E.outBack, update: (k) => h.scale.setScalar(Math.max(0.001, k)) }));
      }
    }
    while (hs.length > pop) {
      const h = hs.pop();
      if (anim) ps.push(tween({ dur: 520, delay: delay || 0, ease: E.inCubic, update: (k) => { h.scale.setScalar(Math.max(0.001, 1 - k)); h.position.y = -k * 0.2; } }).then(() => g.remove(h)));
      else g.remove(h);
    }
    return Promise.all(ps);
  }
  function damH(c) { return Math.max(tileTop(st.height[c]) + 0.14, waterTop(st.W) + 0.16); }

  function makeBuilding(type, c, ghost) {
    const g = new THREE.Group();
    g.userData = { cell: c, type, anim: null, ghost: !!ghost };
    const body = new THREE.Group(); g.add(body);
    const R = seeded(L.hash2(c + 17, type * 31 + 7));
    body.rotation.y = Math.floor(R() * 4) * Math.PI / 2;
    const h = st.height[c];
    switch (type) {
      case BT.TOWN: {
        body.rotation.y = 0;
        mk(body, geo('townbase', () => bevelBox(0.9, 0.07, 0.9, 0.12, 0.025)), M.stoneLight, 0, 0, 0, ghost);
        mk(body, box(0.4, 0.3, 0.32), M.white, 0.08, 0.22, 0.12, ghost);
        mk(body, prism(0.48, 0.18, 0.38), M.town, 0.08, 0.37, 0.12, ghost);
        mk(body, box(0.2, 0.68, 0.2), M.white, -0.2, 0.41, -0.18, ghost);
        mk(body, box(0.215, 0.05, 0.215), M.town, -0.2, 0.62, -0.18, ghost);
        mk(body, cyl(0, 0.16, 0.22, 4), M.town, -0.2, 0.86, -0.18, ghost, 0, Math.PI / 4, 0);
        mk(body, box(0.06, 0.06, 0.01), M.dark, -0.2, 0.52, -0.075, ghost);
        mk(body, box(0.16, 0.16, 0.16), M.white, 0.27, 0.15, -0.24, ghost);
        mk(body, prism(0.22, 0.1, 0.2), M.town, 0.27, 0.23, -0.24, ghost);
        mk(body, box(0.09, 0.12, 0.01), M.dark, 0.08, 0.13, 0.285, ghost);
        if (!ghost) {
          const pole = mk(body, box(0.016, 0.26, 0.016), M.dark, -0.2, 1.08, -0.18, false);
          pole.castShadow = false;
          const flag = mk(body, box(0.15, 0.09, 0.008), M.town, -0.12, 1.15, -0.18, false);
          g.userData.anim = { flag };
        }
        break;
      }
      case BT.VILLAGE: {
        body.rotation.y = 0;
        g.userData.houses = [];
        break;
      }
      case BT.SAW: {
        mk(body, box(0.42, 0.22, 0.32), M.white, -0.05, 0.11, 0, ghost);
        mk(body, prism(0.52, 0.15, 0.38), M.saw, -0.05, 0.22, 0, ghost);
        mk(body, cyl(0.045, 0.045, 0.3, 6), M.wood, 0.27, 0.045, -0.05, ghost, Math.PI / 2, 0, 0);
        mk(body, cyl(0.045, 0.045, 0.3, 6), M.wood, 0.27, 0.045, 0.05, ghost, Math.PI / 2, 0, 0);
        mk(body, cyl(0.045, 0.045, 0.3, 6), M.wood, 0.27, 0.125, 0, ghost, Math.PI / 2, 0, 0);
        const saw = mk(body, cyl(0.1, 0.1, 0.02, 10), M.steel, -0.05, 0.13, 0.18, ghost, Math.PI / 2, 0, 0);
        g.userData.anim = { saw };
        break;
      }
      case BT.QUARRY: {
        mk(body, box(0.5, 0.12, 0.42), M.stone, 0, 0.06, 0, ghost);
        mk(body, box(0.3, 0.12, 0.26), M.stoneTop, -0.06, 0.18, 0.05, ghost);
        mk(body, box(0.11, 0.09, 0.11), M.stoneLight, 0.13, 0.165, -0.1, ghost);
        mk(body, box(0.09, 0.07, 0.09), M.stoneLight, -0.26, 0.035, 0.24, ghost, 0, 0.4, 0);
        mk(body, box(0.04, 0.6, 0.04), M.woodDark, 0.22, 0.3, 0.18, ghost);
        const arm = new THREE.Group(); arm.position.set(0.22, 0.6, 0.18); body.add(arm);
        mk(arm, box(0.48, 0.035, 0.035), M.quarry, -0.16, 0, 0, ghost);
        mk(arm, box(0.006, 0.18, 0.006), M.dark, -0.36, -0.09, 0, ghost);
        mk(arm, box(0.08, 0.06, 0.08), M.stoneLight, -0.36, -0.2, 0, ghost);
        g.userData.anim = { arm, phase: R() * 6 };
        break;
      }
      case BT.DAM: {
        body.rotation.y = 0;
        const wm = mk(body, geo('dam', () => bevelBox(1, 1, 1, 0.08, 0.05)), [M.stoneTop, M.stone], 0, 0, 0, ghost);
        wm.scale.y = damH(c);
        g.userData.wallMesh = wm;
        break;
      }
    }
    if (!ghost && type !== BT.DAM) blobShadow(g, type === BT.TOWN ? 1.05 : 0.95);
    g.position.set(wx(c), type === BT.DAM ? 0 : tileTop(h), wz(c));
    if (type === BT.VILLAGE) setVillagePop(g, Math.max(1, st.pop[c] || 1), false);
    return g;
  }

  // ---------- Дерева і скелі ----------
  const treeGeo = {
    pine: geo('pine', () => { const g = new THREE.CylinderGeometry(0, 0.19, 0.44, 6, 1); g.translate(0, 0.34, 0); return g; }),
    pine2: geo('pine2', () => { const g = new THREE.CylinderGeometry(0, 0.14, 0.3, 6, 1); g.translate(0, 0.52, 0); return g; }),
    round: geo('round', () => { const g = new THREE.IcosahedronGeometry(0.17, 0); g.translate(0, 0.3, 0); return g; }),
    trunk: geo('trunk', () => { const g = new THREE.CylinderGeometry(0.03, 0.042, 0.16, 5); g.translate(0, 0.08, 0); return g; }),
  };
  function makeTrees(c, h) {
    const grp = new THREE.Group(); grp.position.set(wx(c), tileTop(h), wz(c));
    const R = seeded(L.hash2(c, 913));
    const spots = [[-0.22, -0.21], [0.22, -0.2], [-0.21, 0.22], [0.21, 0.21]];
    const n = 2 + Math.floor(R() * 2.6);
    const trees = [];
    for (let i = 0; i < n; i++) {
      const sp = spots.splice(Math.floor(R() * spots.length), 1)[0];
      const t = new THREE.Group();
      t.position.set(sp[0] + (R() - 0.5) * 0.08, 0, sp[1] + (R() - 0.5) * 0.08);
      const s = 0.78 + R() * 0.38; t.scale.setScalar(s); t.rotation.y = R() * Math.PI;
      const ci = Math.floor(R() * 3);
      const tr = new THREE.Mesh(treeGeo.trunk, M.trunk); tr.castShadow = true; t.add(tr);
      if (R() < 0.62) {
        const a = new THREE.Mesh(treeGeo.pine, M.tree[ci]); a.castShadow = true; a.receiveShadow = true; t.add(a);
        if (R() < 0.5) { const b = new THREE.Mesh(treeGeo.pine2, M.tree[ci]); b.castShadow = true; t.add(b); }
      } else {
        const a = new THREE.Mesh(treeGeo.round, M.tree[ci]); a.castShadow = true; a.receiveShadow = true; t.add(a);
      }
      t.userData.phase = R() * 6.28;
      grp.add(t); trees.push(t);
    }
    grp.userData.trees = trees;
    return grp;
  }
  const rockGeo = geo('rock', () => new THREE.IcosahedronGeometry(1, 0));
  function makeRocks(c, h) {
    const grp = new THREE.Group(); grp.position.set(wx(c), tileTop(h), wz(c));
    const R = seeded(L.hash2(c, 331));
    const n = 2 + (R() < 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(rockGeo, M.rock);
      const s = i === 0 ? 0.25 : 0.12 + R() * 0.06;
      m.scale.set(s * (0.9 + R() * 0.3), s * (0.65 + R() * 0.3), s * (0.9 + R() * 0.3));
      m.position.set(i === 0 ? (R() - 0.5) * 0.1 : (R() - 0.5) * 0.6, s * 0.35, i === 0 ? (R() - 0.5) * 0.1 : (R() - 0.5) * 0.6);
      m.rotation.set(R() * 3, R() * 3, R() * 3);
      m.castShadow = true; m.receiveShadow = true; grp.add(m);
    }
    return grp;
  }

  // ---------- Наліпки на клітинках ----------
  class Decals {
    constructor(tex, order) { this.tex = tex; this.pool = []; this.used = 0; this.order = order; this.group = new THREE.Group(); scene.add(this.group); }
    begin() { this.used = 0; }
    add(c, color, opacity, y, scale) {
      let m = this.pool[this.used];
      if (!m) {
        m = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
        m.rotation.x = -Math.PI / 2; m.renderOrder = this.order; this.group.add(m); this.pool.push(m);
      }
      m.visible = true; m.material.color.set(color); m.material.opacity = opacity;
      m.position.set(wx(c), y + 0.008, wz(c)); m.scale.setScalar(scale || 1);
      this.used++; return m;
    }
    end() { for (let i = this.used; i < this.pool.length; i++) this.pool[i].visible = false; }
    clear() { this.begin(); this.end(); }
  }
  const D = {
    forecast: new Decals(TEX.stripes, 2),
    map: new Decals(TEX.fill, 2),
    dots: new Decals(TEX.dot, 3),
    hl: new Decals(TEX.ring, 4),
    cursor: new Decals(TEX.ring, 5),
  };

  // ---------- Підлога ----------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.ShadowMaterial({ opacity: 0.13 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.6; ground.receiveShadow = true; scene.add(ground);
  const aoPlane = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ map: TEX.blob, transparent: true, depthWrite: false, opacity: 0.32 }));
  aoPlane.rotation.x = -Math.PI / 2; aoPlane.position.y = -0.598; scene.add(aoPlane);

  // ---------- Стан ----------
  let st = null;          // стан рівня
  let BD = null;          // тривимірна дошка
  let mode = 'title';     // title | play | busy | result
  let tool = null, hover = -1, pendingHover = -1;
  let line = null;        // дамба, яку протягують
  let mapMode = false, touchMode = false;
  let undo = [];
  let ver = 0;            // версія стану для кешів
  const cache = {};
  function cached(key, fn) { if (cache[key] && cache[key].v === ver) return cache[key].val; const val = fn(); cache[key] = { v: ver, val }; return val; }
  const conn = () => cached('conn', () => L.connectivity(st));
  const risk = () => cached('risk', () => L.nextTideRisk(st));
  const fore = () => cached('fore', () => L.forecast(st));
  const future = () => cached('future', () => L.futureScore(st));
  const live = () => cached('live', () => L.liveScore(st));
  const progress = store.get('progress', { stars: [] });

  // ---------- Дошка ----------
  function surfY(c) {
    if (!BD || !st) return 0;
    if (st.flooded[c]) return BD.waterVis[c] || waterTop(st.W);
    if (st.bld[c] === BT.DAM) { const g = BD.bld.get(c); return g && g.userData.wallMesh ? g.userData.wallMesh.scale.y : damH(c); }
    return tileTop(st.height[c]);
  }
  function chipY(c) {
    const b = st.bld[c];
    if (b >= 0 && b !== BT.DAM) return tileTop(st.height[c]) + BH[b] + 0.08;
    if (st.feature[c] === F.FOREST) return surfY(c) + 0.6;
    return surfY(c) + 0.16;
  }
  function setN(n) {
    N = n; OFF = (N - 1) / 2;
    const s = N / 2 + 1.6;
    Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 80 });
    sun.shadow.camera.updateProjectionMatrix();
    aoPlane.scale.setScalar(N * 1.75);
    view.ext = computeExtents();
  }
  function buildBoard(s, pop) {
    const grp = new THREE.Group();
    const b = { grp, tiles: [], water: [], pick: [], feats: [], bld: new Map(), roads: new Map(), waterVis: new Array(N * N).fill(0), roadGrp: new THREE.Group(), foam: null };
    grp.add(b.roadGrp);
    const pl = new THREE.Mesh(geo('plinth' + N, () => bevelBox(N + 0.36, 0.6, N + 0.36, 0.32, 0.07)), [M.plinthTop, M.plinth]);
    pl.position.y = -0.6; pl.receiveShadow = true; pl.castShadow = true; grp.add(pl);
    for (let c = 0; c < N * N; c++) {
      const x = wx(c), z = wz(c), h = s.height[c];
      const shal = h >= 1 && !L.isBorder(N, c);
      const w = new THREE.Mesh(waterGeo, [M.waterSide, M.waterSide, shal ? M.waterShallow : M.water, M.waterSide, M.waterSide, M.waterSide]);
      w.position.set(x, 0, z); w.receiveShadow = true;
      const vis = s.flooded[c] ? waterTop(s.W) : 0;
      b.waterVis[c] = vis; w.scale.y = Math.max(0.001, vis); w.visible = vis > 0; grp.add(w); b.water[c] = w;
      if (!L.isBorder(N, c)) {
        const t = makeTile(c, h);
        t.visible = !s.flooded[c] && s.bld[c] !== BT.DAM; grp.add(t); b.tiles[c] = t;
        if (!s.flooded[c] && s.feature[c] === F.FOREST) { const tr = makeTrees(c, h); grp.add(tr); b.feats[c] = tr; }
        if (!s.flooded[c] && s.feature[c] === F.ROCK) { const rk = makeRocks(c, h); grp.add(rk); b.feats[c] = rk; }
      }
      const p = new THREE.Mesh(pickGeo, pickMat); p.visible = false; p.position.set(x, 0, z); p.userData.cell = c; grp.add(p); b.pick[c] = p;
    }
    scene.add(grp);
    BD = b;
    for (let c = 0; c < N * N; c++) if (s.bld[c] >= 0) { const g = makeBuilding(s.bld[c], c, false); grp.add(g); b.bld.set(c, g); }
    buildFoam(); syncRoads(false); updatePickAll();
    if (pop) return popIn(b);
    return Promise.resolve();
  }
  function makeTile(c, h) {
    const t = new THREE.Mesh(tileGeo(h), [M.topH[h], M.sideH[h]]);
    t.position.set(wx(c), 0, wz(c)); t.castShadow = true; t.receiveShadow = true;
    return t;
  }
  function updatePick(c) {
    if (!BD) return;
    const b = st.bld[c];
    let h = surfY(c);
    if (b >= 0 && b !== BT.DAM) h += BH[b];
    else if (st.feature[c] === F.FOREST) h += 0.4;
    BD.pick[c].scale.y = Math.max(0.05, h);
  }
  function updatePickAll() { for (let c = 0; c < N * N; c++) updatePick(c); }
  function popIn(b) {
    const ps = [];
    for (let c = 0; c < N * N; c++) {
      const d = Math.hypot((c % N) - OFF, ((c / N) | 0) - OFF);
      const delay = d * 48 + (L.hash2(c, 5) % 60);
      const w = b.water[c];
      if (b.waterVis[c] > 0) {
        const to = b.waterVis[c]; w.scale.y = 0.001;
        ps.push(tween({ dur: 520, delay: delay * 0.6, ease: E.outCubic, update: (k) => { w.scale.y = Math.max(0.001, to * k); } }));
      }
      const t = b.tiles[c];
      if (t) { t.scale.y = 0.001; ps.push(tween({ dur: 560, delay, ease: E.outBack, update: (k) => { t.scale.y = Math.max(0.001, k); } })); }
      const f = b.feats[c];
      if (f) { f.scale.setScalar(0.001); ps.push(tween({ dur: 460, delay: delay + 200, ease: E.outBack, update: (k) => { f.scale.setScalar(Math.max(0.001, k)); } })); }
      const g = b.bld.get(c);
      if (g) { g.scale.setScalar(0.001); ps.push(tween({ dur: 480, delay: delay + 260, ease: E.outBack, update: (k) => { g.scale.setScalar(Math.max(0.001, k)); } })); }
    }
    b.roadGrp.visible = false; if (b.foam) b.foam.visible = false;
    return Promise.all(ps).then(() => {
      b.roadGrp.visible = true; if (b.foam) b.foam.visible = true;
    });
  }
  function exitBoard(b) {
    if (!b) return Promise.resolve();
    const g = b.grp;
    return tween({ dur: 700, ease: E.inCubic, update: (k) => { g.position.y = -k * 12; g.rotation.y = k * 0.25; } })
      .then(() => { scene.remove(g); });
  }
  function disposeBoardNow() { if (BD) { scene.remove(BD.grp); BD = null; } }

  // ---------- Дороги ----------
  const roadW = 0.13;
  function roadPiece(grp, x, y, z, len, ang) {
    const m = new THREE.Mesh(unitBox, M.road); m.receiveShadow = true;
    m.position.set(x, y, z); m.rotation.y = ang; m.scale.set(len, 0.022, roadW); grp.add(m); return m;
  }
  function makeRoad(u, v) {
    const g = new THREE.Group();
    const yu = surfY(u) + 0.012, yv = surfY(v) + 0.012;
    const ux = wx(u), uz = wz(u), vx = wx(v), vz = wz(v);
    const ang = Math.atan2(-(vz - uz), vx - ux);
    roadPiece(g, ux, yu, uz, 0.5, ang);
    roadPiece(g, vx, yv, vz, 0.5, ang + Math.PI);
    if (Math.abs(yu - yv) > 0.02) {
      const mx = (ux + vx) / 2, mz = (uz + vz) / 2;
      const r = new THREE.Mesh(box(1, 1, 1), M.roadSide);
      r.position.set(mx, (yu + yv) / 2, mz); r.rotation.y = ang;
      r.scale.set(0.04, Math.abs(yu - yv), roadW); g.add(r);
    }
    return g;
  }
  function syncRoads(anim) {
    if (!BD) return;
    const segs = L.roadTree(st);
    const want = new Map();
    for (const [u, v] of segs) want.set(u + ':' + v + ':' + surfY(u).toFixed(2) + ':' + surfY(v).toFixed(2), [u, v]);
    for (const [k, g] of BD.roads) {
      if (want.has(k)) continue;
      BD.roads.delete(k);
      const grp = BD.roadGrp;
      if (anim) tween({ dur: 300, update: (t) => g.scale.set(1, 1, Math.max(0.001, 1 - t)) }).then(() => grp.remove(g));
      else grp.remove(g);
    }
    let i = 0;
    for (const [k, [u, v]] of want) {
      if (BD.roads.has(k)) continue;
      const g = makeRoad(u, v);
      BD.roadGrp.add(g); BD.roads.set(k, g);
      if (anim) { g.scale.setScalar(0.001); tween({ dur: 380, delay: (i++) * 22, ease: E.outBack, update: (t) => g.scale.setScalar(Math.max(0.001, t)) }); }
    }
  }

  // ---------- Піна біля берега ----------
  function buildFoam() {
    if (!BD) return;
    if (BD.foam) { BD.grp.remove(BD.foam); BD.foam = null; }
    const items = [];
    for (let c = 0; c < N * N; c++) {
      if (!st.flooded[c]) continue;
      for (const n of L.n4(st, c)) if (!st.flooded[n] && st.height[n] > 0) items.push([c, n]);
    }
    if (!items.length) return;
    const im = new THREE.InstancedMesh(box(1, 1, 1), M.foam, items.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    items.forEach(([c, n], i) => {
      const cxp = wx(c), czp = wz(c), nx = wx(n), nz = wz(n);
      const horiz = cxp !== nx;
      p.set((cxp + nx) / 2 + (cxp - nx) * 0.035, waterTop(st.W) + 0.004, (czp + nz) / 2 + (czp - nz) * 0.035);
      s.set(horiz ? 0.06 : 0.92, 0.012, horiz ? 0.92 : 0.06);
      m4.compose(p, q, s); im.setMatrixAt(i, m4);
    });
    im.renderOrder = 2;
    BD.grp.add(im); BD.foam = im;
  }

  // ---------- Човни на обрії ----------
  function makeBoat() {
    const g = new THREE.Group();
    const s = 0.75;
    const hull = new THREE.Mesh(box(0.34 * s, 0.08, 0.16 * s), M.white); hull.position.y = 0.04; hull.castShadow = true; g.add(hull);
    const stripe = new THREE.Mesh(box(0.345 * s, 0.025, 0.165 * s), M.town); stripe.position.y = 0.07; g.add(stripe);
    const mast = new THREE.Mesh(box(0.012, 0.3, 0.012), M.dark); mast.position.set(0, 0.22, 0); g.add(mast);
    const sail = new THREE.Mesh(prism(0.18, 0.24, 0.01), M.white); sail.position.set(0.02, 0.1, 0); sail.rotation.y = Math.PI / 2; sail.castShadow = true; g.add(sail);
    return g;
  }
  const sailors = [makeBoat(), makeBoat()];
  sailors.forEach((b) => { scene.add(b); b.visible = false; });
  function stepSailors(t) {
    const show = !!BD;
    sailors.forEach((b, i) => {
      b.visible = show; if (!show) return;
      const P = 4 * (N - 1), u = ((t * 0.32 + i * P / 2) % P + P) % P;
      const side = Math.floor(u / (N - 1)), k = u - side * (N - 1);
      let x, z, a;
      if (side === 0) { x = -OFF + k; z = -OFF; a = 0; } else if (side === 1) { x = OFF; z = -OFF + k; a = -Math.PI / 2; }
      else if (side === 2) { x = OFF - k; z = OFF; a = Math.PI; } else { x = -OFF; z = OFF - k; a = Math.PI / 2; }
      b.position.set(x, waterTop(st ? st.W : 0) + Math.sin(t * 1.8 + i) * 0.012, z);
      b.rotation.y = a; b.rotation.z = Math.sin(t * 1.3 + i * 2) * 0.05;
    });
  }

  // ---------- Сезони ----------
  function seasonIdx(s) { return Math.min(3, Math.floor((s.tide / s.tides) * 4)); }
  function seasonTargets(idx) {
    const p = SEASON_PAL[idx];
    const pairs = [[scene.background, p.bg], [M.water.color, p.water], [M.waterShallow.color, new THREE.Color(p.water).lerp(new THREE.Color('#F2FBF8'), 0.38)], [M.waterSide.color, new THREE.Color(p.water).multiplyScalar(0.8)], [M.side[0].color, p.side[0]], [M.side[1].color, p.side[1]]];
    for (let h = 1; h <= 8; h++) pairs.push([M.topH[h].color, p.top[h - 1]]);
    for (let i = 0; i < 3; i++) pairs.push([M.tree[i].color, p.tree[i]]);
    return pairs;
  }
  function syncBodyBg() { document.documentElement.style.setProperty('--bg', '#' + scene.background.getHexString()); }
  function applySeason(idx, dur, delay) {
    const pairs = seasonTargets(idx);
    const from = pairs.map((p) => p[0].clone());
    const to = pairs.map((p) => new THREE.Color(p[1]));
    if (!dur) { pairs.forEach((p, i) => p[0].copy(to[i])); syncBodyBg(); return Promise.resolve(); }
    return tween({ dur, delay, ease: E.inOutCubic, update: (k) => { pairs.forEach((p, i) => p[0].copy(from[i]).lerp(to[i], k)); syncBodyBg(); } });
  }

  // ---------- Камера ----------
  const ELEV = Math.atan(1 / Math.SQRT2);
  const TARGET = new THREE.Vector3(0, 0.8, 0);
  const cam = { theta: Math.PI / 4, thetaT: Math.PI / 4, zoom: 1, zoomT: 1, pan: { x: 0, y: 0 }, orbit: true };
  const view = { vw: 1, vh: 1, rect: { x: 0, y: 0, w: 1, h: 1 }, rectT: { x: 0, y: 0, w: 1, h: 1 }, ext: null, scale: 1 };
  function placeCamera(theta) {
    const d = 44;
    camera.position.set(TARGET.x + Math.sin(theta) * Math.cos(ELEV) * d, TARGET.y + Math.sin(ELEV) * d, TARGET.z + Math.cos(theta) * Math.cos(ELEV) * d);
    camera.lookAt(TARGET);
    const rx = Math.cos(theta), rz = -Math.sin(theta);
    const fx = -Math.sin(theta), fz = -Math.cos(theta);
    sun.position.set(TARGET.x - rx * 8 + fx * 4, TARGET.y + 16, TARGET.z - rz * 8 + fz * 4);
    sun.target.position.copy(TARGET);
  }
  function computeExtents() {
    placeCamera(Math.PI / 4); camera.updateMatrixWorld();
    const inv = camera.matrixWorldInverse; const v = new THREE.Vector3();
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; const hh = N / 2 + 0.2;
    const pts = [];
    for (const x of [-hh, hh]) for (const z of [-hh, hh]) for (const y of [-0.62, 1.6]) pts.push([x, y, z]);
    for (const x of [-3.5, 3.5]) for (const z of [-3.5, 3.5]) pts.push([x, 3.0, z]);
    for (const p of pts) { v.set(p[0], p[1], p[2]).applyMatrix4(inv); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
    placeCamera(cam.theta);
    return { w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  }
  function measureRect() {
    const vw = view.vw, vh = view.vh;
    let r;
    if (!document.body.classList.contains('in-game')) {
      const p = $('#start-panel');
      const pr = p && !$('#screen-start').hidden ? p.getBoundingClientRect() : null;
      if (pr && vw >= 860) r = { x: pr.right + 12, y: 24, w: vw - pr.right - 36, h: vh - 48 };
      else if (pr) r = { x: 12, y: 12, w: vw - 24, h: Math.max(160, pr.top - 18) };
      else r = { x: 16, y: 16, w: vw - 32, h: vh - 32 };
    } else {
      const tb = $('#topbar').getBoundingClientRect().bottom;
      document.documentElement.style.setProperty('--top-h', Math.round(tb) + 'px');
      const top = (vw >= 960 ? $('#timeline').getBoundingClientRect().bottom : tb) + 8;
      const bot = $('#bottombar').getBoundingClientRect().top - 6;
      const side = vw >= 700 ? 60 : 8;
      r = { x: side, y: top, w: vw - side * 2, h: Math.max(120, bot - top) };
    }
    view.rectT = r;
  }
  function layout() {
    view.vw = window.innerWidth; view.vh = window.innerHeight;
    renderer.setSize(view.vw, view.vh, false);
    measureRect();
  }
  function applyFrustum() {
    const r = view.rect, ext = view.ext;
    const s = Math.min(r.w / ext.w, r.h / ext.h) * cam.zoom;
    const ax = r.x + r.w / 2, ay = r.y + r.h / 2;
    const lim = (ext.w / 2) * (1 - 1 / cam.zoom) + 0.6;
    cam.pan.x = clamp(cam.pan.x, -lim, lim); cam.pan.y = clamp(cam.pan.y, -lim * 0.8, lim * 0.8);
    const bcx = ext.cx + cam.pan.x, bcy = ext.cy + cam.pan.y;
    camera.left = bcx - ax / s; camera.right = camera.left + view.vw / s;
    camera.top = bcy + ay / s; camera.bottom = camera.top - view.vh / s;
    camera.updateProjectionMatrix();
    view.scale = s;
  }
  function defaultZoom() {
    const r = view.rectT, ext = view.ext;
    const s0 = Math.min(r.w / ext.w, r.h / ext.h);
    const usedH = ext.h * s0;
    return usedH < r.h * 0.7 ? clamp((r.h * 0.78) / usedH, 1, 1.45) : 1;
  }
  function rotate(dir) { cam.thetaT += (dir * Math.PI) / 2; Sfx.tone(520, 0.08, { type: 'triangle', gain: 0.04 }); }

  // ---------- Фішки над полем ----------
  const chipsEl = $('#chips');
  const overlay = [];
  function addChip(html, pos, cls, layer, dy) {
    const pin = document.createElement('div'); pin.className = 'pin ' + (layer || '');
    pin.innerHTML = `<div class="chip ${cls || ''}">${html}</div>`;
    chipsEl.appendChild(pin);
    const it = { el: pin, pos: pos.clone(), layer, dy: dy || 0 };
    overlay.push(it); placeItem(it); return it;
  }
  function clearChips(layer) {
    for (let i = overlay.length - 1; i >= 0; i--) if (overlay[i].layer === layer) { overlay[i].el.remove(); overlay.splice(i, 1); }
  }
  const _v = new THREE.Vector3();
  function toScreen(p) { _v.copy(p).project(camera); return { x: (_v.x + 1) / 2 * view.vw, y: (1 - _v.y) / 2 * view.vh }; }
  function placeItem(it) {
    const s = toScreen(it.pos);
    if (it.w == null) it.w = it.el.firstChild ? it.el.firstChild.offsetWidth : 0;
    const half = it.w / 2 + 8;
    const x = it.w ? clamp(s.x, half, view.vw - half) : s.x;
    it.el.style.transform = `translate3d(${x.toFixed(1)}px,${(s.y + it.dy).toFixed(1)}px,0)`;
  }
  const cellPos = (c, y) => new THREE.Vector3(wx(c), y == null ? chipY(c) : y, wz(c));

  // ---------- Прев’ю ----------
  let ghost = null, ghostKey = '';
  function hideGhost() { if (ghost) { ghost.parent && ghost.parent.remove(ghost); ghost = null; ghostKey = ''; } }
  function showGhost(key, make) {
    if (ghostKey === key && ghost) return;
    hideGhost();
    ghost = make(); ghost.userData.baseY = ghost.position.y;
    BD.grp.add(ghost); ghostKey = key;
  }
  function deltaChip(d) {
    return `${svgI('people', null, 13)}<b>${d > 0 ? '+' + d : fmt(d)}</b>`;
  }
  function validCells(t) {
    return cached('valid' + t, () => {
      const out = [];
      for (let c = 0; c < N * N; c++) { const r = L.checkCell(st, t, c); if (r.ok || r.why === 'wood' || r.why === 'stone') out.push(c); }
      return out;
    });
  }
  function previewDelta(key, fn) {
    return cached('pd' + key, () => {
      const s = L.clone(st);
      if (!fn(s)) return null;
      return L.futureScore(s) - future();
    });
  }

  function refreshPreview() {
    clearChips('preview');
    D.hl.begin(); D.cursor.begin(); D.dots.begin();
    let hypoAt = null;
    if (st && BD && mode === 'play' && tool === 'village') {
      const col = TOOL_COL[tool];
      for (const c of validCells(tool)) D.dots.add(c, col, 0.55, surfY(c), 0.62);
    }
    if (st && BD && mode === 'play' && tool === 'dam') {
      for (const c of validCells('dam')) if (st.flooded[c]) D.dots.add(c, COL.ink, 0.38, surfY(c), 0.55);
    }
    if (st && BD && mode === 'play' && tool === 'dam' && (line || hover >= 0)) {
      hypoAt = previewDamLine(line ? line.cells : [hover]);
    } else if (st && BD && mode === 'play' && hover >= 0) {
      const c = hover;
      if (tool) {
        const chk = L.checkCell(st, tool, c);
        const t = L.TOOL_B[tool];
        if (chk.ok || chk.why === 'wood' || chk.why === 'stone') {
          showGhost(tool + c, () => makeBuilding(t, c, true));
          D.cursor.add(c, chk.ok ? TOOL_COL[tool] : COL.danger, 0.95, tileTop(st.height[c]));
          let html = '';
          if (tool === 'saw' || tool === 'quarry') {
            const o = L.output(st, c, t);
            const f = tool === 'saw' ? F.FOREST : F.ROCK;
            for (const n of L.n8(st, c)) if (!st.flooded[n] && st.feature[n] === f && st.bld[n] < 0) D.hl.add(n, tool === 'saw' ? COL.forest : COL.quarry, 0.95, surfY(n), 0.88);
            html = `${svgI(tool === 'saw' ? 'wood' : 'stone', null, 13)}<b>+${o.wood + o.stone}</b><span>щодня</span>${conn()[c] ? '' : `<em class="bad">${svgI('unlink', null, 12)} без дороги</em>`}`;
          } else {
            const d = chk.ok ? previewDelta(tool + c, (s) => L.build(s, tool, c)) : 0;
            html = deltaChip(d || 0);
            if (tool === 'village' && !conn()[c]) html += `<em class="bad">${svgI('unlink', null, 12)} без дороги</em>`;
            if (tool === 'village' && fore()[c] < 99) html += `<span>${svgI('water', null, 12)} заллє через ${fore()[c]}</span>`;
          }
          if (!chk.ok) html = `<em class="bad">${WHY[chk.why]}</em>`;
          const top = tileTop(st.height[c]) + (t === BT.DAM ? Math.max(0.3, damH(c) - tileTop(st.height[c])) : BH[t]) + 0.18;
          addChip(html + (touchMode && chk.ok ? '<i class="tap">торкнись ще раз</i>' : ''), cellPos(c, top), 'total' + (chk.ok ? '' : ' is-bad'), 'preview', -4);
        } else {
          hideGhost();
          D.cursor.add(c, COL.danger, 0.85, surfY(c));
          if (chk.why && WHY[chk.why]) addChip(esc(WHY[chk.why]), cellPos(c), 'warn', 'preview');
        }
      } else {
        hideGhost();
        if (!L.isBorder(N, c)) { D.cursor.add(c, COL.ink, 0.45, surfY(c)); cellInfo(c); }
      }
    } else hideGhost();
    D.hl.end(); D.cursor.end(); D.dots.end();
    refreshForecast(hypoAt);
  }
  // прев'ю дамби або цілої лінії дамб
  function previewDamLine(cells) {
    const good = cells.filter((c) => { const r = L.checkCell(st, 'dam', c); return r.ok || r.why === 'stone'; });
    if (!good.length) {
      hideGhost();
      const c = cells[cells.length - 1];
      const r = L.checkCell(st, 'dam', c);
      D.cursor.add(c, COL.danger, 0.85, surfY(c));
      if (WHY[r.why]) addChip(esc(WHY[r.why]), cellPos(c), 'warn', 'preview');
      return null;
    }
    const key = good.join(',');
    showGhost('dam' + key, () => { const g = new THREE.Group(); for (const c of good) g.add(makeBuilding(BT.DAM, c, true)); return g; });
    const res = cached('dl' + key, () => {
      const s = L.clone(st); s.stone = 999;
      const r = L.buildLine(s, good);
      return { d: L.futureScore(s) - future(), drained: r.drained, at: L.forecast(s) };
    });
    const at = fore();
    for (let i = 0; i < N * N; i++) if (!st.flooded[i] && good.indexOf(i) < 0 && res.at[i] > at[i]) D.hl.add(i, COL.pier, 0.95, surfY(i), 0.84);
    for (const c of res.drained) D.hl.add(c, COL.village, 0.95, surfY(c), 0.84);
    for (const c of good) D.cursor.add(c, st.stone >= good.length ? COL.ink : COL.danger, 0.7, surfY(c) + 0.02, 0.9);
    const need = good.length, enough = st.stone >= need;
    let html = deltaChip(res.d);
    if (res.drained.length) html += `<span>${svgI('water', null, 12)} нова суша +${res.drained.length}</span>`;
    html += enough ? `<span>${svgI('stone', null, 12)} −${need}</span>` : `<em class="bad">${svgI('stone', null, 12)} треба ${need}, є ${st.stone}</em>`;
    if (touchMode && !line && enough) html += '<i class="tap">торкнись ще раз або тягни</i>';
    const last = good[good.length - 1];
    addChip(html, cellPos(last, damH(last) + 0.3), 'total' + (enough ? '' : ' is-bad'), 'preview', -4);
    return res.at;
  }
  function cellInfo(c) {
    const b = st.bld[c];
    const at = fore()[c];
    const tide = st.flooded[c] || at === 99 ? '' : `<span>${svgI('water', null, 12)} ${at === 1 ? 'наступний приплив' : 'за ' + at + ' ' + plural(at, 'приплив', 'припливи', 'припливів')}</span>`;
    let html = '';
    if (b === BT.VILLAGE) html = `<b>${svgI('people', null, 12)} ${st.pop[c]}</b>${conn()[c] ? '' : `<em class="bad">${svgI('unlink', null, 12)} відрізане</em>`}${tide}`;
    else if (b === BT.SAW || b === BT.QUARRY) { const o = L.output(st, c); html = `<b>${svgI(b === BT.SAW ? 'wood' : 'stone', null, 12)} +${o.wood + o.stone} щодня</b>${conn()[c] ? '' : `<em class="bad">${svgI('unlink', null, 12)} відрізано</em>`}${tide}`; }
    else if (b === BT.TOWN) html = `<b>Місто</b><span>${svgI('wood', null, 12)} +1 щодня</span>`;
    else if (b >= 0) html = `<b>${TYPE_NAME[b]}</b>${tide}`;
    else if (st.flooded[c] && st.height[c] >= 1) html = `<b>Мілина</b><span>тут можна ставити дамбу</span>`;
    else if (!st.flooded[c] && at !== 99) html = tide;
    if (html) addChip(html, cellPos(c), 'info', 'preview');
  }
  function refreshForecast(hypoAt) {
    D.forecast.begin(); D.map.begin(); clearChips('map');
    if (st && BD && mode !== 'title' && !st.over) {
      const at = hypoAt || fore();
      for (let c = 0; c < N * N; c++) {
        if (st.flooded[c] || st.bld[c] === BT.DAM || L.isBorder(N, c)) continue;
        if (mapMode) {
          if (at[c] === 99) continue;
          D.map.add(c, COL.water, [0, 0.62, 0.42, 0.27, 0.16, 0.1, 0.08][at[c]] || 0.08, surfY(c), 0.92);
          addChip(String(at[c]), cellPos(c, surfY(c) + 0.05), 'mapnum k' + at[c], 'map', 8);
        } else if (at[c] === 1) D.forecast.add(c, '#2E7E92', 0.5, surfY(c), 0.96);
      }
    }
    D.forecast.end(); D.map.end();
  }
  function refreshStatus() {
    clearChips('status');
    if (!st || !BD || mode === 'title' || st.over) return;
    const cn = conn(), rk = risk();
    for (let c = 0; c < N * N; c++) {
      const b = st.bld[c];
      if (b !== BT.VILLAGE && b !== BT.SAW && b !== BT.QUARRY) continue;
      if (b === BT.VILLAGE && rk.lose.indexOf(c) >= 0) addChip(`${svgI('water', null, 12)}<b>−${st.pop[c]}</b>`, cellPos(c), 'st-cut pulse', 'status');
      else if (!cn[c]) {
        if (b === BT.VILLAGE) addChip(`${svgI('unlink', null, 12)}<b>${st.pop[c]}</b>`, cellPos(c), 'st-cut', 'status');
        else addChip(svgI('unlink', null, 12), cellPos(c), 'st-off', 'status');
      } else if (rk.cut.indexOf(c) >= 0) addChip(svgI('warn', null, 12), cellPos(c), 'st-risk', 'status');
    }
  }

  // ---------- Ефекти ----------
  function ripple(c, color, y, big) {
    const m = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ map: TEX.ring, color, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(wx(c), (y == null ? surfY(c) : y) + 0.01, wz(c)); m.renderOrder = 6; scene.add(m);
    const s1 = big ? 2.4 : 1.7;
    return tween({ dur: 620, ease: E.outCubic, update: (k) => { m.scale.setScalar(0.7 + (s1 - 0.7) * k); m.material.opacity = 0.9 * (1 - k); } })
      .then(() => { scene.remove(m); m.material.dispose(); });
  }
  function floatChip(html, c, delay, cls, y) {
    const pos = cellPos(c, y);
    return sleep(delay || 0).then(() => {
      const it = addChip(html, pos, 'float ' + (cls || ''), 'fx');
      return sleep(1000).then(() => { it.el.remove(); const i = overlay.indexOf(it); if (i >= 0) overlay.splice(i, 1); });
    });
  }
  function sinkObject(obj, delay) {
    if (!obj) return Promise.resolve();
    const y0 = obj.position.y, rz = (Math.random() - 0.5) * 0.7, rx = (Math.random() - 0.5) * 0.5;
    return tween({ dur: 900, delay, ease: E.inCubic, update: (k) => { obj.position.y = y0 - k * 1.1; obj.rotation.z = rz * k; obj.rotation.x = rx * k; obj.scale.setScalar(Math.max(0.001, 1 - k * 0.3)); } })
      .then(() => { obj.parent && obj.parent.remove(obj); });
  }
  function dropIn(g) {
    const y0 = g.position.y;
    g.position.y = y0 + 1.4; g.scale.set(0.82, 1.3, 0.82);
    return tween({ dur: 240, ease: E.inQuad, update: (k) => { g.position.y = y0 + 1.4 * (1 - k); } }).then(() => {
      g.position.y = y0;
      tween({ dur: 650, ease: E.linear, update: (k) => { const d = Math.exp(-4.6 * k) * Math.cos(k * Math.PI * 4.4); g.scale.set(1 + 0.22 * d, 1 - 0.32 * d, 1 + 0.22 * d); }, done: () => g.scale.set(1, 1, 1) });
    });
  }
  function flyTo(text, fromPos, target, cls) {
    const s = toScreen(fromPos);
    const r = target.getBoundingClientRect();
    const el = document.createElement('div'); el.className = 'flyer ' + (cls || ''); el.innerHTML = text;
    document.body.appendChild(el);
    const tx = r.left + r.width / 2, ty = r.top + r.height / 2;
    const mx = (s.x + tx) / 2 + (tx > s.x ? -40 : 40), my = Math.min(s.y, ty) - 60;
    const anim = el.animate([
      { transform: `translate(${s.x}px,${s.y}px) translate(-50%,-50%) scale(1)`, opacity: 1 },
      { transform: `translate(${mx}px,${my}px) translate(-50%,-50%) scale(1.12)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${tx}px,${ty}px) translate(-50%,-50%) scale(0.6)`, opacity: 0.2 },
    ], { duration: 640 * TS, easing: 'cubic-bezier(.45,.05,.4,1)' });
    return new Promise((res) => { anim.onfinish = () => { el.remove(); res(); }; });
  }
  function bump(el) { if (!el) return; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }

  // ---------- HUD ----------
  let shownScore = 0;
  function setScore(v, animate) {
    const el = $('#score');
    if (!animate) { shownScore = v; el.textContent = v; renderGoalBar(v); return Promise.resolve(); }
    const from = shownScore; shownScore = v;
    if (from === v) return Promise.resolve();
    bump(el);
    return tween({ dur: 460, ease: E.outCubic, update: (k) => { const cur = Math.round(lerp(from, v, k)); el.textContent = cur; renderGoalBar(cur); } });
  }
  function renderGoalBar(v) {
    if (!st) return;
    const g = st.goals, max = g[2] * 1.1;
    $('#goal-fill').style.width = clamp((v / max) * 100, 0, 100) + '%';
    const marks = $('#goal-marks');
    if (marks.dataset.k !== g.join(',')) {
      marks.dataset.k = g.join(',');
      marks.innerHTML = g.map((x) => `<span class="gm" style="left:${(x / max) * 100}%">${svgI('star', null, 12)}<i>${x}</i></span>`).join('');
    }
    marks.querySelectorAll('.gm').forEach((m, i) => m.classList.toggle('on', v >= g[i]));
  }
  function renderResources(animateKey) {
    const inc = cached('inc', () => L.income(st));
    $('#res-wood').innerHTML = `${svgI('wood', null, 16)}<b>${st.wood}</b><span>+${inc.wood}</span>`;
    const needStone = st.tools.indexOf('quarry') >= 0 || st.tools.indexOf('dam') >= 0 || st.stone > 0;
    $('#res-stone').hidden = !needStone;
    $('#res-stone').innerHTML = `${svgI('stone', null, 16)}<b>${st.stone}</b><span>+${inc.stone}</span>`;
    if (animateKey) bump($('#res-' + animateKey));
  }
  function renderTimeline() {
    const step = 16, gap = 30, segW = (st.days - 1) * step + gap, W = st.tides * segW + 16, H = 34;
    const pos = st.day;
    const xOf = (k, d) => 10 + k * segW + d * step;
    const tideX = (k) => xOf(k, st.days - 1) + 18;
    let out = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">`;
    const curX = pos >= st.tides * st.days ? tideX(st.tides - 1) : xOf(Math.floor(pos / st.days), pos % st.days);
    out += `<line x1="10" y1="14" x2="${tideX(st.tides - 1)}" y2="14" class="tl-base"/><line x1="10" y1="14" x2="${curX}" y2="14" class="tl-done"/>`;
    for (let k = 0; k < st.tides; k++) {
      for (let d = 0; d < st.days; d++) {
        const i = k * st.days + d, x = xOf(k, d);
        const cls = i < pos ? 'past' : i === pos ? 'now' : 'future';
        out += `<circle cx="${x}" cy="14" r="${cls === 'now' ? 5.4 : 3.4}" class="tl-stop ${cls}"/>`;
      }
      const tx = tideX(k), done = k < st.tide, storm = st.rises[k] > 1;
      out += `<g class="tl-tide ${done ? 'done' : ''} ${k === st.tide ? 'next' : ''} ${storm ? 'storm' : ''}"><circle cx="${tx}" cy="14" r="${storm ? 10 : 8}"/><path d="M${tx - 4.6} 15.2c1.5 0 1.5-2 3.07-2s1.53 2 3.06 2 1.54-2 3.07-2"/>${storm ? `<text x="${tx}" y="33" class="tl-x">×2</text>` : ''}</g>`;
    }
    out += '</svg>';
    $('#timeline').innerHTML = out;
  }
  function renderToolbar() {
    const bar = $('#toolbar');
    const tools = st.tools;
    if (bar.dataset.k !== tools.join(',')) {
      bar.dataset.k = tools.join(',');
      bar.innerHTML = tools.map((t, i) => {
        const cost = L.costOf(t);
        const c = [];
        if (cost.wood) c.push(`${svgI('wood', null, 11)}${cost.wood}`);
        if (cost.stone) c.push(`${svgI('stone', null, 11)}${cost.stone}`);
        return `<button type="button" class="tbtn" data-tool="${t}" style="--c:${TOOL_COL[t]}" aria-label="${TOOL_NAME[t]}, клавіша ${i + 1}">
          <span class="tb-ico">${svgI(t, '#fff', 22)}</span><span class="tb-name">${TOOL_NAME[t]}</span><span class="tb-cost">${c.join(' ')}</span><span class="tb-key">${i + 1}</span>
          <span class="tb-tip" role="tooltip"><b>${TOOL_NAME[t]}</b>${esc(TOOL_HINT[t])}</span></button>`;
      }).join('');
      bar.querySelectorAll('.tbtn').forEach((b) => b.addEventListener('click', () => selectTool(b.dataset.tool)));
    }
    bar.querySelectorAll('.tbtn').forEach((b) => {
      const t = b.dataset.tool;
      b.classList.toggle('poor', !L.afford(st, L.costOf(t)));
      b.classList.toggle('is-sel', t === tool);
      b.setAttribute('aria-pressed', t === tool ? 'true' : 'false');
    });
  }
  function renderNext() {
    const b = $('#next');
    $('#undo').disabled = !undo.length || mode !== 'play';
    if (!st || st.over) { b.disabled = true; return; }
    b.disabled = mode !== 'play';
    const tideNext = L.daysToTide(st) === 1;
    const storm = tideNext && st.rises[st.tide] > 1;
    b.classList.toggle('tide', tideNext);
    b.innerHTML = tideNext ? `${svgI('water', null, 20)}<span>${storm ? 'Шторм' : 'Приплив'}</span>` : `<span>Далі</span>${svgI('arrow', null, 20)}`;
    b.title = tideNext ? 'Завершити день, прийде приплив (пробіл)' : 'Завершити день (пробіл)';
  }
  function renderHUD() {
    if (!st) return;
    $('#lvl-eyebrow').textContent = `Рівень ${st.li + 1}`;
    $('#lvl-name').textContent = st.name;
    renderTimeline(); renderResources(); renderToolbar(); renderNext();
    $('#btn-map').classList.toggle('on', mapMode);
    $('#btn-sound').classList.toggle('off', !Sfx.on);
    const lv = live();
    const cl = $('#cut-line');
    cl.hidden = !lv.cut;
    cl.innerHTML = lv.cut ? `${svgI('unlink', null, 12)} відрізано ${lv.cut}` : '';
    measureRect();
  }
  let bannerTimer = 0;
  function banner(html, kind, ms) {
    const el = $('#banner');
    el.className = 'banner show ' + (kind || '');
    el.innerHTML = html;
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => { el.classList.remove('show'); }, (ms || 2000) * TS);
  }
  let toastTimer = 0;
  function toast(html) {
    const el = $('#toast');
    el.innerHTML = html; el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200 * TS);
  }

  // ---------- Підказки ----------
  const seenHints = store.get('hints', {});
  let hintId = null;
  const HINTS = {
    pick: { text: 'Обери Селище і постав його на сушу', at: () => $('#toolbar [data-tool="village"]') },
    next: { text: 'Коли збудуєш усе, що хочеш, натисни «Далі»', at: () => $('#next') },
    roads: { text: 'Селище без дороги до міста порожніє', at: () => $('#scorebox') },
    saw: { text: 'Дерево скінчилось? Лісопилка біля лісу дає його щодня', at: () => $('#toolbar [data-tool="saw"]') },
    dam: { text: 'Протягни дамбу від берега до берега. Обведене кільцями лишиться сухим', at: () => $('#toolbar [data-tool="dam"]') },
    land: { text: 'Замкнена вода стекла. На новій суші можна будувати', at: () => $('#scorebox') },
    undo: { text: 'Передумав? Скасуй будівництво до кінця дня', at: () => $('#undo') },
  };
  function hint(id) {
    if (seenHints[id] || !HINTS[id] || mode === 'title') return;
    hintId = id;
    const el = $('#hint');
    $('#hint-text').textContent = HINTS[id].text;
    el.hidden = false; el.classList.remove('in'); void el.offsetWidth; el.classList.add('in');
    requestAnimationFrame(positionHint);
    clearTimeout(hint.t);
    if (id !== 'pick') hint.t = setTimeout(() => { if (hintId === id) hintDone(id); }, 9000 * TS);
  }
  function positionHint() {
    const el = $('#hint');
    if (el.hidden || !hintId) return;
    const a = HINTS[hintId].at();
    if (!a) { el.hidden = true; return; }
    const r = a.getBoundingClientRect();
    const w = el.offsetWidth, h = el.offsetHeight, vw = window.innerWidth;
    const x = clamp(r.left + r.width / 2 - w / 2, 10, vw - w - 10);
    const below = r.top < 200;
    const y = below ? r.bottom + 12 : r.top - h - 12;
    el.dataset.side = below ? 'bottom' : 'top';
    el.style.setProperty('--ax', clamp(r.left + r.width / 2 - x, 16, w - 16) + 'px');
    el.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`;
  }
  function hintDone(id) {
    if (id) { seenHints[id] = 1; store.set('hints', seenHints); if (hintId !== id) return; }
    else if (hintId) { seenHints[hintId] = 1; store.set('hints', seenHints); }
    hintId = null; $('#hint').hidden = true;
  }

  // ---------- Дії гравця ----------
  function selectTool(t) {
    if (mode !== 'play' || !st || st.tools.indexOf(t) < 0) return;
    tool = tool === t ? null : t;
    line = null;
    Sfx.select(); hideIntro();
    document.body.classList.toggle('has-tool', !!tool);
    renderToolbar(); refreshPreview();
    if (tool) {
      const cost = L.costOf(tool);
      if (!L.afford(st, cost)) toast(`${svgI(cost.stone > st.stone ? 'stone' : 'wood', null, 14)} ${cost.stone > st.stone ? WHY.stone : WHY.wood}`);
      if (tool === 'village') hintDone('pick');
      if (tool === 'dam') hint('dam');
    } else if (hintId === 'dam') hintDone();
  }
  function deselect() {
    if (line) { line = null; refreshPreview(); return; }
    if (tool) { tool = null; document.body.classList.remove('has-tool'); renderToolbar(); refreshPreview(); }
  }
  function changed() {
    ver++;
    renderHUD(); refreshStatus(); refreshPreview();
    setScore(live().score, true);
    save();
  }

  function doBuild(c) {
    if (mode !== 'play' || !tool) return;
    const t = tool;
    const snap = L.clone(st);
    const ev = L.build(st, t, c);
    if (!ev) { Sfx.bad(); return; }
    undo.push(snap);
    hideGhost(); clearChips('preview');
    Sfx.build(t);
    if (ev.hadForest) removeFeature(c, true);
    const g = makeBuilding(L.TOOL_B[t], c, false);
    BD.grp.add(g); BD.bld.set(c, g);
    if (t === 'dam' && BD.tiles[c]) BD.tiles[c].visible = false;
    dropIn(g);
    ripple(c, TOOL_COL[t], t === 'dam' ? damH(c) : tileTop(st.height[c]));
    ver++;
    syncRoads(true); updatePickAll();
    if (!L.afford(st, L.costOf(t))) { tool = null; document.body.classList.remove('has-tool'); }
    changed();
    if (hintId === t) hintDone(t);
    if (st.li === 0) { hintDone('pick'); setTimeout(() => hint('next'), 500 * TS); }
    else if (undo.length === 1 && !hintId) hint('undo');
  }
  function doBuildDams(cells) {
    if (mode !== 'play') return;
    const good = cells.filter((c) => { const r = L.checkCell(st, 'dam', c); return r.ok || r.why === 'stone'; });
    line = null;
    if (!good.length) { Sfx.bad(); refreshPreview(); return; }
    if (st.stone < good.length) { Sfx.bad(); toast(`${svgI('stone', null, 14)} Треба ${good.length} каменю, є ${st.stone}`); refreshPreview(); return; }
    const snap = L.clone(st);
    const res = L.buildLine(st, good);
    if (!res.built.length) { st = snap; Sfx.bad(); return; }
    undo.push(snap);
    hideGhost(); clearChips('preview');
    Sfx.build('dam');
    res.built.forEach((ev, i) => {
      if (ev.hadForest) removeFeature(ev.c, true);
      const g = makeBuilding(BT.DAM, ev.c, false);
      BD.grp.add(g); BD.bld.set(ev.c, g);
      if (BD.tiles[ev.c]) BD.tiles[ev.c].visible = false;
      g.visible = false;
      sleep(i * 70).then(() => {
        g.visible = true;
        if (ev.wasWater) { BD.water[ev.c].visible = false; BD.waterVis[ev.c] = 0; }
        dropIn(g); if (i < 10) Sfx.knock(i);
        ripple(ev.c, COL.dam, damH(ev.c));
      });
    });
    const dd = res.built.length * 70 + 350;
    if (res.drained.length) animateDrain(res.drained, dd);
    ver++;
    sleep(dd + res.drained.length * 35 + 700).then(() => { buildFoam(); updatePickAll(); syncRoads(true); });
    syncRoads(true); updatePickAll();
    if (!L.afford(st, L.costOf('dam'))) { tool = null; document.body.classList.remove('has-tool'); }
    changed();
    if (hintId === 'dam') hintDone('dam');
    if (res.drained.length) hint('land');
    else if (undo.length === 1 && !hintId) hint('undo');
  }
  function animateDrain(cells, delay) {
    sleep(delay).then(() => { Sfx.drain(); banner(`${svgI('water', null, 16)}<b>Нова суша +${cells.length}</b><span>вода стекла за дамбу</span>`, 'land', 2200); });
    cells.forEach((c, i) => {
      const d = delay + i * 35;
      const w = BD.water[c];
      let t = BD.tiles[c];
      if (!t) { t = makeTile(c, st.height[c]); BD.grp.add(t); BD.tiles[c] = t; }
      let from = 0;
      tween({ dur: 650, delay: d, ease: E.inOutCubic, start: () => { from = BD.waterVis[c]; t.visible = true; t.scale.y = 0.001; },
        update: (k) => { const v = lerp(from, 0, k); BD.waterVis[c] = v; w.scale.y = Math.max(0.001, v); t.scale.y = Math.max(0.001, k); },
        done: () => { w.visible = false; BD.waterVis[c] = 0; t.scale.y = 1; } });
    });
  }
  function extendLine(c) {
    if (!line || c < 0) return;
    const cs = line.cells, last = cs[cs.length - 1];
    if (c === last) return;
    if (cs.length >= 2 && c === cs[cs.length - 2]) { cs.pop(); return; }
    let x = last % N, y = (last / N) | 0;
    const tx = c % N, ty = (c / N) | 0;
    while ((x !== tx || y !== ty) && cs.length < 24) {
      if (x !== tx) x += Math.sign(tx - x); else y += Math.sign(ty - y);
      const n = y * N + x;
      if (cs.indexOf(n) >= 0) break;
      const r = L.checkCell(st, 'dam', n);
      if (!(r.ok || r.why === 'stone')) break;
      cs.push(n);
    }
  }
  function removeFeature(c, anim) {
    const f = BD.feats[c]; if (!f) return;
    BD.feats[c] = null;
    if (anim) tween({ dur: 220, ease: E.inCubic, update: (k) => f.scale.setScalar(Math.max(0.001, 1 - k)) }).then(() => f.parent && f.parent.remove(f));
    else f.parent && f.parent.remove(f);
  }
  function doUndo() {
    if (mode !== 'play' || !undo.length) return;
    st = undo.pop();
    hideGhost();
    disposeBoardNow();
    buildBoard(st, false);
    Sfx.whoosh();
    changed();
    if (hintId === 'undo') hintDone('undo');
  }

  async function nextDay() {
    if (mode !== 'play' || !st || st.over) return;
    mode = 'busy'; document.body.classList.add('busy');
    tool = null; hover = -1; line = null; document.body.classList.remove('has-tool');
    hideGhost(); clearChips('preview'); refreshPreview(); renderToolbar(); renderNext();
    if (hintId === 'next' || hintId === 'undo') hintDone();
    hideIntro();
    const inc = L.income(st);
    let i = 0;
    const flights = [];
    for (const s of inc.src) {
      if (s.cut) { floatChip(svgI('unlink', null, 12), s.c, 0, 'cutf'); continue; }
      if (!s.wood && !s.stone) continue;
      const kind = s.wood ? 'wood' : 'stone';
      const pos = cellPos(s.c);
      const k = i;
      flights.push(sleep(k * 90).then(() => { Sfx.coin(k); return flyTo(`${svgI(kind, null, 13)}+${s.wood || s.stone}`, pos, $('#res-' + kind), kind); }));
      i++;
    }
    await Promise.all(flights);
    const res = L.endDay(st);
    undo = [];
    ver++;
    renderResources(inc.wood ? 'wood' : null); if (inc.stone) bump($('#res-stone'));
    renderTimeline(); renderToolbar();
    if (st.li === 0 && st.wood < 2 && st.tools.indexOf('saw') >= 0) hint('saw');
    if (res.tide) await runTide(res.tide);
    if (st.over) return levelOver();
    mode = 'play'; document.body.classList.remove('busy');
    changed();
    if (pendingHover >= 0) { hover = pendingHover; pendingHover = -1; refreshPreview(); }
  }

  async function runTide(ev) {
    D.forecast.clear(); D.map.clear(); clearChips('map'); clearChips('status');
    const storm = ev.rise > 1;
    Sfx.tide(storm);
    banner(`${svgI('water', null, 16)}<b>${storm ? 'Шторм' : 'Приплив'}</b><span>вода на ${ev.W}-му уступі</span>`, 'tide', 2200);
    if (BD.foam) BD.foam.visible = false;
    const top = waterTop(ev.W);
    const ps = [];
    const tw = (c, to, delay, dur) => {
      let from = 0;
      return tween({ dur, delay, ease: E.inOutCubic, start: () => { from = BD.waterVis[c]; BD.water[c].visible = true; }, update: (k) => { const v = lerp(from, to, k); BD.waterVis[c] = v; BD.water[c].scale.y = Math.max(0.001, v); } });
    };
    for (let c = 0; c < N * N; c++) if (BD.waterVis[c] > 0) ps.push(tw(c, top, 0, storm ? 1600 : 1300));
    for (const o of ev.flooded) {
      const c = o.c, delay = 300 + o.d * 120;
      BD.waterVis[c] = tileTop(st.height[c]) - 0.14; BD.water[c].scale.y = BD.waterVis[c];
      ps.push(tw(c, top, delay, 650).then(() => { if (BD.tiles[c]) BD.tiles[c].visible = false; }));
      if (o.d < 5) tween({ dur: 1, delay: delay + 400 }).then(() => ripple(c, '#FFFFFF', top));
    }
    if (ev.lost.length) tween({ dur: 1, delay: 600 }).then(() => Sfx.loss());
    if (ev.removed.length || ev.lost.length) tween({ dur: 1, delay: 500 }).then(() => Sfx.sink());
    for (const o of ev.lost) {
      const g = BD.bld.get(o.c); BD.bld.delete(o.c);
      ps.push(sinkObject(g, 380 + o.d * 120));
      floatChip(`${svgI('people', null, 12)}−${o.n}`, o.c, 380 + o.d * 120, 'lost', tileTop(st.height[o.c]) + 0.5);
    }
    for (const o of ev.removed) { const g = BD.bld.get(o.c); BD.bld.delete(o.c); ps.push(sinkObject(g, 380 + o.d * 120)); }
    for (const o of ev.drowned) { const f = BD.feats[o.c]; BD.feats[o.c] = null; if (f) ps.push(sinkObject(f, 300 + o.d * 120)); }
    for (const [c, g] of BD.bld) {
      if (g.userData.wallMesh) { const wm = g.userData.wallMesh, from = wm.scale.y, to = damH(c); if (to > from) ps.push(tween({ dur: 900, delay: 150, ease: E.outBack, update: (k) => { wm.scale.y = lerp(from, to, k); } })); }
    }
    ps.push(applySeason(seasonIdx(st), 1500, 450));
    await Promise.all(ps);
    ver++;
    buildFoam(); syncRoads(true); updatePickAll();
    let gi = 0;
    for (const c of ev.grow) {
      const g = BD.bld.get(c); if (!g) continue;
      setVillagePop(g, st.pop[c], true, gi * 60);
      floatChip(`${svgI('people', null, 12)}+1`, c, gi * 60, 'grow');
      if (gi < 20) Sfx.grow(gi);
      gi++;
    }
    for (const c of ev.shrink) {
      const g = BD.bld.get(c);
      floatChip(`${svgI('people', null, 12)}−1`, c, 200, 'lost');
      if (!g) continue;
      if (ev.abandon.indexOf(c) >= 0) { BD.bld.delete(c); sinkObject(g, 300); }
      else setVillagePop(g, st.pop[c], true, 200);
    }
    setScore(L.liveScore(st).score, true);
    if (ev.grow.length || ev.shrink.length) await sleep(900);
    if (ev.shrink.length && st.li <= 2) hint('roads');
    if (!st.over) banner(`<b>${st.tides - st.tide} ${plural(st.tides - st.tide, 'приплив', 'припливи', 'припливів')} до кінця</b>`, 'season', 1600);
  }

  // ---------- Рівні ----------
  function save() {
    if (st && !st.over && document.body.classList.contains('in-game')) store.set('current', { li: st.li, st });
    else if (st && st.over) store.del('current');
  }
  // збереження — недовірені дані: localStorage спільний для всіх сторінок на *.github.io цього акаунта,
  // а поля стану потім ідуть в innerHTML. Тож перевіряємо типи, а константи рівня беремо з коду.
  function loadSave() {
    const cur = store.get('current', null), s = cur && cur.st;
    if (!s) return null;
    const num = Number.isFinite;
    const ok = s.v === 4 && Number.isInteger(cur.li) && L.LEVELS[cur.li] && s.over === false;
    const ref = ok && L.newLevel(cur.li);
    const cells = (a) => Array.isArray(a) && a.length === ref.N * ref.N && a.every(num);
    if (!ok
      || !['W', 'W0', 'day', 'tide', 'wood', 'stone', 'lost', 'left', 'reclaimed', 'built', 'finalScore'].every((k) => num(s[k]))
      || !['feature', 'flooded', 'bld', 'pop'].every((k) => cells(s[k]))) {
      store.del('current'); return null;
    }
    for (const k of ['li', 'N', 'name', 'tides', 'days', 'rises', 'tools', 'goals', 'height', 'town']) s[k] = ref[k];
    return cur;
  }
  function levelUnlocked(li) { return li === 0 || (progress.stars[li - 1] || 0) > 0; }
  async function startLevel(li, savedState) {
    Sfx.ensure();
    $('#screen-start').hidden = true; $('#screen-result').hidden = true; $('#screen-help').hidden = true;
    mode = 'busy'; document.body.classList.add('busy', 'in-game');
    cam.orbit = false;
    cam.thetaT = Math.PI / 4 + Math.round((cam.theta - Math.PI / 4) / (Math.PI / 2)) * (Math.PI / 2);
    tool = null; hover = -1; mapMode = false; undo = [];
    hintId = null; $('#hint').hidden = true;
    hideGhost(); clearChips('preview'); clearChips('map'); clearChips('status');
    D.forecast.clear(); D.map.clear(); D.dots.clear(); D.hl.clear(); D.cursor.clear();
    $('#hud').hidden = false;
    menuBuild++;
    const old = BD; BD = null;
    Sfx.whoosh();
    await exitBoard(old);
    st = savedState ? savedState : L.newLevel(li);
    ver++;
    setN(st.N);
    cam.pan.x = 0; cam.pan.y = 0;
    applySeason(seasonIdx(st), 0);
    renderHUD(); setScore(live().score, false);
    measureRect();
    cam.zoomT = defaultZoom();
    await buildBoard(st, true);
    save();
    showIntro();
    mode = 'play'; document.body.classList.remove('busy');
    changed();
    if (st.li === 0 && st.day === 0 && !st.built) setTimeout(() => hint('pick'), 900 * TS);
  }
  function levelOver() {
    const score = L.liveScore(st).score;
    const stars = L.starsFor(st, score);
    const prev = progress.stars[st.li] || 0;
    if (stars > prev) progress.stars[st.li] = stars;
    const best = store.get('best', {});
    best[st.li] = Math.max(best[st.li] || 0, score);
    store.set('best', best); store.set('progress', progress);
    store.del('current');
    mode = 'result'; document.body.classList.remove('busy');
    hintId = null; $('#hint').hidden = true;
    clearChips('status'); renderNext();
    showResult(score, stars);
  }
  function starRow(n) {
    return [0, 1, 2].map((i) => `<span class="rs ${i < n ? 'on pop' : ''}" style="--d:${300 + i * 260}ms">${svgI('star', null, 34)}</span>`).join('');
  }
  function showResult(score, stars) {
    const el = $('#screen-result');
    const ok = stars > 0;
    const last = st.li >= L.LEVELS.length - 1;
    $('#res-eyebrow').textContent = `Рівень ${st.li + 1} · ${st.name}`;
    $('#res-title').textContent = ok ? (last ? 'Архіпелаг вистояв' : 'Громада вистояла') : 'Замало жителів';
    $('#res-stars').innerHTML = starRow(stars);
    $('#res-sub').textContent = ok ? (stars < 3 ? `До наступної зірки бракує ${st.goals[stars] - score}` : 'Усі три зірки') : `До першої зірки бракує ${st.goals[0] - score}`;
    $('#res-table').innerHTML = `
      <div class="sum"><span>Жителі</span><b>${score}</b></div>
      <div><span>Втрачено</span><b>${st.lost + (st.left || 0)}</b></div>
      ${st.tools.indexOf('dam') >= 0 ? `<div><span>Відвойовано в моря</span><b>${st.reclaimed}</b></div>` : ''}`;
    $('#res-table').style.gridTemplateColumns = `repeat(${st.tools.indexOf('dam') >= 0 ? 3 : 2}, minmax(0, 1fr))`;
    const nextOk = !last && (progress.stars[st.li] || 0) > 0;
    $('#res-actions').innerHTML = `${nextOk ? '<button type="button" class="btn primary" id="res-next">Наступний рівень</button>' : ''}
      <button type="button" class="btn ${nextOk ? 'ghost' : 'primary'}" id="res-retry">Ще раз</button>
      <button type="button" class="btn ghost" id="res-menu">Усі рівні</button>`;
    const nb = $('#res-next'); if (nb) nb.addEventListener('click', () => startLevel(st.li + 1));
    $('#res-retry').addEventListener('click', () => startLevel(st.li));
    $('#res-menu').addEventListener('click', () => toTitle(st.li));
    el.hidden = false;
    el.classList.remove('in'); void el.offsetWidth; el.classList.add('in');
    for (let i = 0; i < stars; i++) setTimeout(() => Sfx.star(i), (300 + i * 260) * TS);
    if (!ok) Sfx.fail(); else if (last) setTimeout(() => Sfx.win(), 1000 * TS);
  }
  function hideIntro() {
    const el = $('#intro');
    if (el.hidden || el.classList.contains('out')) return;
    clearTimeout(showIntro.t);
    el.classList.add('out'); setTimeout(() => { el.hidden = true; el.classList.remove('show', 'out'); }, 380);
  }
  function showIntro() {
    const el = $('#intro');
    const def = L.LEVELS[st.li];
    const nt = def.newTool;
    el.innerHTML = `<div class="eyebrow">Рівень ${st.li + 1} з ${L.LEVELS.length}</div><div class="intro-name">${esc(st.name)}</div><p>${esc(def.intro)}</p>${nt ? `<div class="intro-new" style="--c:${TOOL_COL[nt]}"><span class="tb-ico">${svgI(nt, '#fff', 15)}</span>Нове: ${TOOL_NAME[nt]}</div>` : ''}<div class="intro-goals">${st.goals.map((g, i) => `<span>${'★'.repeat(i + 1)} ${g}</span>`).join('')}</div>`;
    el.hidden = false; el.classList.remove('out'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(showIntro.t);
    showIntro.t = setTimeout(hideIntro, 5000 * TS);
  }

  // ---------- Меню рівнів ----------
  let menuSel = 0, menuBuild = 0;
  function renderLevelMap() {
    const wrap = $('#level-map');
    const best = store.get('best', {});
    wrap.innerHTML = L.LEVELS.map((lv, i) => {
      const un = levelUnlocked(i), s = progress.stars[i] || 0;
      return `<button type="button" class="lvl ${un ? '' : 'locked'} ${i === menuSel ? 'sel' : ''} ${s ? 'done' : ''}" data-i="${i}" ${un ? '' : 'disabled'} aria-label="Рівень ${i + 1}: ${esc(lv.name)}">
        <span class="lvl-dot">${un ? i + 1 : svgI('lock', null, 12)}</span>
        <span class="lvl-stars">${[0, 1, 2].map((k) => `<i class="${k < s ? 'on' : ''}">${svgI('star', null, 10)}</i>`).join('')}</span></button>`;
    }).join('');
    wrap.querySelectorAll('.lvl').forEach((b) => b.addEventListener('click', () => pickMenuLevel(+b.dataset.i)));
    const lv = L.LEVELS[menuSel];
    $('#menu-lvl-name').textContent = lv.name;
    $('#menu-lvl-num').textContent = `Рівень ${menuSel + 1}`;
    $('#menu-lvl-desc').textContent = lv.intro;
    $('#menu-lvl-best').textContent = best[menuSel] ? `Найкраще: ${best[menuSel]} ${plural(best[menuSel], 'житель', 'жителі', 'жителів')}` : '';
    const cur = loadSave();
    const hasCur = cur && cur.st && cur.li === menuSel && !cur.st.over;
    $('#btn-play').innerHTML = hasCur ? `Продовжити <small>день ${cur.st.day + 1}</small>` : 'Грати';
    $('#btn-restart-lvl').hidden = !hasCur;
  }
  async function pickMenuLevel(i, force) {
    if (!levelUnlocked(i)) return;
    if (i === menuSel && !force && BD) { renderLevelMap(); return; }
    menuSel = i; renderLevelMap(); if (!force) Sfx.select();
    const my = ++menuBuild;
    const old = BD; BD = null;
    await exitBoard(old);
    if (my !== menuBuild || mode !== 'title') return;
    st = L.newLevel(i); ver++;
    setN(st.N); applySeason(0, 0); measureRect();
    await buildBoard(st, true);
  }
  async function toTitle(li) {
    $('#screen-result').hidden = true; $('#screen-help').hidden = true; $('#hint').hidden = true; hintId = null;
    $('#intro').hidden = true;
    mode = 'title';
    document.body.classList.remove('in-game', 'busy', 'has-tool');
    $('#hud').hidden = true;
    tool = null; hover = -1; hideGhost(); clearChips('preview'); clearChips('map'); clearChips('status');
    D.forecast.clear(); D.map.clear(); D.dots.clear(); D.hl.clear(); D.cursor.clear();
    let sel = li;
    if (sel == null) {
      sel = 0;
      for (let i = 0; i < L.LEVELS.length; i++) if (levelUnlocked(i) && !(progress.stars[i] > 0)) { sel = i; break; } else if (levelUnlocked(i)) sel = i;
      const cur = loadSave(); if (cur) sel = cur.li;
    }
    $('#screen-start').hidden = false;
    cam.orbit = true;
    menuSel = -1;
    await pickMenuLevel(sel, true);
  }

  // ---------- Введення ----------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pickCell(x, y) {
    if (!BD) return -1;
    ndc.set((x / view.vw) * 2 - 1, -(y / view.vh) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(BD.pick, false);
    if (!hits.length) return -1;
    // з вибраним інструментом низьку клітинку за високою сусідкою теж можна влучити
    if (tool && mode === 'play') {
      const ok = (c) => { const r = L.checkCell(st, tool, c); return r.ok || r.why === 'wood' || r.why === 'stone'; };
      const first = hits[0].object.userData.cell;
      if (!ok(first)) for (let i = 1; i < Math.min(hits.length, 4); i++) { const c = hits[i].object.userData.cell; if (hits[i].distance - hits[0].distance > 1.6) break; if (ok(c)) return c; }
      return first;
    }
    return hits[0].object.userData.cell;
  }
  const pointers = new Map();
  let drag = null, pinch = null;
  canvas.addEventListener('pointerdown', (e) => {
    touchMode = e.pointerType !== 'mouse';
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* */ }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      drag = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, moved: false, btn: e.button, draw: false };
      if (mode === 'play' && tool === 'dam' && e.button === 0) {
        const c = pickCell(e.clientX, e.clientY);
        const r = c >= 0 ? L.checkCell(st, 'dam', c) : null;
        if (r && (r.ok || r.why === 'stone')) { drag.draw = true; drag.c0 = c; line = { cells: [c] }; if (e.pointerType === 'mouse') refreshPreview(); }
      }
    }
    else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y), z0: cam.zoomT };
      if (drag) { drag.moved = true; if (drag.draw) { drag.draw = false; line = null; refreshPreview(); } }
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (p) {
      p.x = e.clientX; p.y = e.clientY;
      if (pinch && pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        cam.zoomT = clamp(pinch.z0 * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, pinch.d0), 0.8, 2.8);
      } else if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 7) drag.moved = true;
        if (drag.draw) {
          const c = pickCell(e.clientX, e.clientY);
          const before = line ? line.cells.join(',') : '';
          extendLine(c);
          if (line && line.cells.join(',') !== before) { Sfx.tone(600 + line.cells.length * 25, 0.04, { type: 'triangle', gain: 0.025 }); refreshPreview(); }
        } else if (drag.moved && mode !== 'title') { cam.pan.x -= dx / view.scale; cam.pan.y += dy / view.scale; }
        drag.x = e.clientX; drag.y = e.clientY;
      }
    }
    if (e.pointerType === 'mouse' && (!drag || !drag.moved) && !(drag && drag.draw)) {
      const c = pickCell(e.clientX, e.clientY);
      if (mode === 'busy') { pendingHover = c; return; }
      if (mode === 'play' && c !== hover) { hover = c; refreshPreview(); }
    }
  });
  function endPointer(e) {
    const had = pointers.has(e.pointerId);
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!had) return;
    if (pointers.size === 0) {
      const d = drag; drag = null;
      if (d && d.draw) {
        const multi = line && line.cells.length > 1;
        if (e.type !== 'pointerup') { line = null; refreshPreview(); return; }
        if (multi || e.pointerType === 'mouse') { doBuildDams(line.cells); return; }
        // торкання без руху: перший раз показати, другий — збудувати
        const c = d.c0; line = null;
        if (hover === c) doBuildDams([c]); else { hover = c; refreshPreview(); }
        return;
      }
      if (d && !d.moved && e.type === 'pointerup' && d.btn === 0) onTap(e);
    }
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && mode === 'play') { hover = -1; pendingHover = -1; refreshPreview(); } });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); if (mode === 'title') return; cam.zoomT = clamp(cam.zoomT * Math.exp(-e.deltaY * 0.0012), 0.8, 2.8); }, { passive: false });
  canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); deselect(); });
  function onTap(e) {
    if (mode !== 'play') return;
    const c = pickCell(e.clientX, e.clientY);
    const mouse = e.pointerType === 'mouse';
    if (!tool) { if (!mouse) { hover = c; refreshPreview(); } return; }
    if (c < 0) { hover = -1; refreshPreview(); return; }
    const chk = L.checkCell(st, tool, c);
    if (!chk.ok) {
      Sfx.bad();
      if (chk.why === 'wood' || chk.why === 'stone') toast(`${svgI(chk.why, null, 14)} ${WHY[chk.why]}`);
      if (!mouse) { hover = c; refreshPreview(); }
      return;
    }
    if (mouse || hover === c) doBuild(c);
    else { hover = c; refreshPreview(); }
  }
  window.addEventListener('keydown', (e) => {
    if (e.target && e.target.closest && e.target.closest('input,textarea')) return;
    if (!$('#screen-help').hidden) { if (e.key === 'Escape') closeHelp(); return; }
    if (mode !== 'play' && mode !== 'busy') return;
    const k = e.code;
    const num = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Digit6: 5, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3, Numpad5: 4, Numpad6: 5 }[k];
    if (num != null) { if (st && st.tools[num]) selectTool(st.tools[num]); }
    else if (k === 'Space' || k === 'Enter') { if (k === 'Enter' && e.target && e.target.closest && e.target.closest('button')) return; nextDay(); }
    else if (k === 'KeyZ' || k === 'Backspace') doUndo();
    else if (k === 'KeyQ') rotate(-1);
    else if (k === 'KeyE') rotate(1);
    else if (k === 'KeyM') toggleMap();
    else if (e.key === 'Escape') deselect();
    else return;
    e.preventDefault();
  });
  function toggleMap() { mapMode = !mapMode; $('#btn-map').classList.toggle('on', mapMode); $('#btn-map').setAttribute('aria-pressed', String(mapMode)); refreshPreview(); Sfx.select(); }
  function openHelp() {
    const el = $('#screen-help'); el.hidden = false; el.classList.remove('in'); void el.offsetWidth; el.classList.add('in');
    $('#help-ingame').hidden = !(st && document.body.classList.contains('in-game'));
    $('#help-tools').innerHTML = L.TOOLS.map((t) => {
      const cost = L.costOf(t); const c = [];
      if (cost.wood) c.push(`${svgI('wood', null, 11)}${cost.wood}`);
      if (cost.stone) c.push(`${svgI('stone', null, 11)}${cost.stone}`);
      return `<div class="ht" style="--c:${TOOL_COL[t]}"><span class="tb-ico">${svgI(t, '#fff', 18)}</span><span class="ht-txt"><b>${TOOL_NAME[t]}</b><em>${c.join(' ')}</em><span>${esc(TOOL_HINT[t])}</span></span></div>`;
    }).join('');
    $('#btn-help-close').focus();
  }
  function closeHelp() { $('#screen-help').hidden = true; }

  $('#btn-play').addEventListener('click', () => {
    const cur = loadSave();
    if (cur && cur.st && cur.li === menuSel && !cur.st.over) startLevel(menuSel, cur.st);
    else startLevel(menuSel);
  });
  $('#btn-restart-lvl').addEventListener('click', () => { store.del('current'); startLevel(menuSel); });
  $('#btn-how').addEventListener('click', openHelp);
  $('#btn-help').addEventListener('click', openHelp);
  $('#btn-help-close').addEventListener('click', closeHelp);
  $('#btn-quit').addEventListener('click', () => { closeHelp(); save(); toTitle(st ? st.li : 0); });
  $('#btn-restart').addEventListener('click', () => { closeHelp(); startLevel(st.li); });
  $('#screen-help').addEventListener('click', (e) => { if (e.target.id === 'screen-help') closeHelp(); });
  $('#btn-rot-l').addEventListener('click', () => rotate(-1));
  $('#btn-rot-r').addEventListener('click', () => rotate(1));
  $('#btn-map').addEventListener('click', toggleMap);
  $('#btn-sound').addEventListener('click', () => { Sfx.on = !Sfx.on; store.set('sound', Sfx.on); $('#btn-sound').classList.toggle('off', !Sfx.on); $('#btn-sound').setAttribute('aria-pressed', String(Sfx.on)); if (Sfx.on) Sfx.select(); });
  $('#next').addEventListener('click', nextDay);
  $('#undo').addEventListener('click', doUndo);
  $('#hint-ok').addEventListener('click', () => hintDone());
  window.addEventListener('resize', () => { layout(); positionHint(); });

  // ---------- Головний цикл ----------
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now; NOW = now;
    stepTweens();
    if (cam.orbit && !REDUCED) cam.thetaT += dt * 0.07;
    const kk = 1 - Math.exp(-dt * 7);
    cam.theta += (cam.thetaT - cam.theta) * kk;
    cam.zoom += (cam.zoomT - cam.zoom) * kk;
    const r = view.rect, rt = view.rectT, kr = 1 - Math.exp(-dt * 5);
    r.x += (rt.x - r.x) * kr; r.y += (rt.y - r.y) * kr; r.w += (rt.w - r.w) * kr; r.h += (rt.h - r.h) * kr;
    placeCamera(cam.theta);
    applyFrustum();
    const t = now / 1000;
    if (BD && st) {
      for (let c = 0; c < BD.feats.length; c++) { const f = BD.feats[c]; if (f && f.userData.trees) for (const tr of f.userData.trees) tr.rotation.z = Math.sin(t * 1.4 + tr.userData.phase) * 0.035; }
      for (const [, g] of BD.bld) {
        const a = g.userData.anim; if (!a) continue;
        if (a.saw) a.saw.rotation.y = t * 3;
        if (a.arm) a.arm.rotation.y = Math.sin(t * 0.6 + a.phase) * 0.9;
        if (a.flag) { a.flag.rotation.y = Math.sin(t * 3) * 0.25; a.flag.scale.x = 1 + Math.sin(t * 5) * 0.06; }
      }
      M.foam.opacity = 0.55 + Math.sin(t * 1.6) * 0.18;
    }
    stepSailors(t);
    if (ghost) ghost.position.y = ghost.userData.baseY + 0.06 + Math.sin(t * 4) * 0.02;
    renderer.render(scene, camera);
    for (const it of overlay) placeItem(it);
  }

  // ---------- Старт ----------
  setN(13);
  layout();
  view.rect = Object.assign({}, view.rectT);
  syncBodyBg();
  $('#btn-sound').classList.toggle('off', !Sfx.on);
  requestAnimationFrame(frame);

  toTitle();

  // хук для перевірок у браузері (tools/check-ui.js): не прибирати
  window.__arch = {
    state: () => ({ mode, st, tool, hover }),
    build: (t, c) => { tool = t; return doBuild(c); },
    next: () => nextDay(),
    start: (li) => startLevel(li),
    screen: (c) => toScreen(new THREE.Vector3(wx(c), tileTop(st.height[c]), wz(c))),
    select: selectTool, undo: doUndo,
    dams: (cells) => { tool = 'dam'; return doBuildDams(cells); },
  };
})();
