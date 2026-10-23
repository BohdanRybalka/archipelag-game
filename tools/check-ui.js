// Перевірки гри в браузері (Playwright): головний екран, відтворення бота в інтерфейсі,
// сумісність збережень, відкидання підмінених збережень, скриншоти для перегляду.
// Запуск: node tools/check-ui.js [U1 U4 …] (або npm run check:ui); без аргументів — усі сценарії
// CHROMIUM_PATH=/шлях/до/chrome — якщо браузер Playwright не збігається з встановленим.
// Скриншоти (U5) падають у tools/out/, автоматично не перевіряються.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const L = require('../src/logic.js');
const { bot } = require('./balance-bot.js');
const { stateHash, variantFor, FIELDS } = require('./check-logic.js');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'out');
const FIXTURE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'save-v4.json'), 'utf8'));
// сторінку віддаємо з вигаданого origin через перехоплення запитів: мережа не потрібна
const ORIGIN = 'http://archipelag.test';
const THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
const THREE_JS = fs.readFileSync(require.resolve('three/build/three.min.js'));
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'));
const XSS_DAY = '<img src=x onerror="document.title=\'PWNED\'">';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function withTimeout(p, ms, what) {
  let t;
  return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`тайм-аут ${ms / 1000} с: ${what}`)), ms); })]).finally(() => clearTimeout(t));
}
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function eq(got, want, what) { assert(got === want, `${what}: очікувано ${JSON.stringify(want)}, є ${JSON.stringify(got)}`); }

// ---------- сторінка ----------
async function route(r) {
  const url = r.request().url();
  const u = new URL(url);
  if (url === THREE_URL) {
    // через SRI (crossorigin="anonymous") браузер вимагає CORS-заголовок, інакше скрипт заблоковано
    return r.fulfill({ status: 200, body: THREE_JS, headers: { 'Content-Type': 'application/javascript', 'Access-Control-Allow-Origin': '*' } });
  }
  if (u.hostname === 'fonts.googleapis.com') return r.fulfill({ status: 200, body: '', headers: { 'Content-Type': 'text/css', 'Access-Control-Allow-Origin': '*' } });
  if (u.origin === ORIGIN) {
    if (u.pathname === '/' || u.pathname === '/index.html') return r.fulfill({ status: 200, body: INDEX, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    if (u.pathname === '/favicon.ico') return r.fulfill({ status: 204, body: '' });
    return r.fulfill({ status: 404, body: '' });
  }
  return r.abort();
}
const contexts = [];
async function open(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  contexts.push(context);
  await context.route('**/*', route);
  const page = await context.newPage();
  const errors = [], requests = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
  page.on('request', (r) => requests.push(r.url()));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  return { page, errors, requests };
}
// головний екран готовий: меню рівнів намальоване, острів побудований
async function waitTitle(page) {
  await page.waitForFunction(() => window.__arch && document.querySelectorAll('#level-map .lvl').length > 0
    && __arch.state().mode === 'title' && __arch.state().st, null, { timeout: 30000 });
}
async function load(page, storage) {
  await page.goto(ORIGIN + '/');
  if (storage) {
    await page.evaluate((s) => { localStorage.clear(); for (const k in s) localStorage.setItem(k, s[k]); }, storage);
    await page.reload();
  }
  await waitTitle(page);
}
const text = (page, sel) => page.$eval(sel, (el) => el.textContent.replace(/\s+/g, ' ').trim());
const arch = (page) => page.evaluate(() => { const a = __arch.state(); return { mode: a.mode, li: a.st && a.st.li, day: a.st && a.st.day, tide: a.st && a.st.tide, over: a.st && a.st.over, built: a.st && a.st.built }; });
async function shot(page, name) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, name) });
}

// ---------- сценарії ----------
async function u1(browser) {
  const { page, errors } = await open(browser);
  await load(page);
  eq(await page.locator('#level-map .lvl').count(), L.LEVELS.length, 'кнопок рівнів');
  eq(await text(page, '#btn-play'), 'Грати', '#btn-play');
  await sleep(1500);
  await shot(page, 'u5-title.png');
  return errors;
}

async function u2(browser, li) {
  const r = bot(L.newLevel(li), variantFor(li));
  const { page, errors } = await open(browser);
  await load(page);
  await withTimeout(page.evaluate((i) => __arch.start(i), li), 30000, `__arch.start(${li})`);
  let s = await arch(page);
  eq(s.mode, 'play', 'режим після start');
  let shotTide = li === 1;
  for (let guard = 0; !s.over && guard < 100; guard++) {
    for (const step of r.steps.filter((x) => x.day === s.day)) {
      const before = s.built;
      await page.evaluate((x) => (x.tool === 'dam' ? __arch.dams(x.cells) : __arch.build(x.tool, x.cells[0])), step);
      s = await arch(page);
      eq(s.built - before, step.cells.length, `рівень ${li + 1}, день ${step.day}: збудовано для ${JSON.stringify(step)}`);
    }
    await withTimeout(page.evaluate(() => __arch.next()), 60000, `__arch.next() на дні ${s.day}`);
    s = await arch(page);
    if (shotTide && s.tide === 1) {
      shotTide = false;
      await sleep(800);
      await shot(page, 'u5-level2-tide1.png');
      await page.keyboard.press('KeyM');
      await sleep(400);
      await shot(page, 'u5-level2-map.png');
      await page.keyboard.press('KeyM');
    }
  }
  eq(s.mode, 'result', `рівень ${li + 1}: режим наприкінці`);
  assert(await page.locator('#screen-result').isVisible(), `рівень ${li + 1}: екран результату не видно`);
  eq(+(await text(page, '#res-table .sum b')), r.score, `рівень ${li + 1}: бали на екрані результату (бот)`);
  const fin = await page.evaluate((fields) => { const st = __arch.state().st; const o = {}; for (const k of fields) o[k] = st[k]; return o; }, FIELDS);
  eq(stateHash(fin, r.steps), stateHash(r.st, r.steps), `рівень ${li + 1}: хеш фінального стану (бот)`);
  if (li === 1) { await sleep(1500); await shot(page, 'u5-level2-result.png'); }
  return errors;
}

async function u3(browser) {
  const { page, errors } = await open(browser);
  await load(page, { 'archipelag3:current': JSON.stringify(FIXTURE), 'archipelag3:progress': '{"stars":[1]}' });
  eq(await text(page, '#btn-play'), 'Продовжити день 5', '#btn-play');
  await page.click('#btn-play');
  await page.waitForFunction(() => __arch.state().mode === 'play', null, { timeout: 30000 });
  eq(await text(page, '#lvl-name'), 'Перша дамба', 'назва рівня в HUD');
  eq(await text(page, '#res-wood'), '8+1', 'дерево в HUD');
  eq(await text(page, '#res-stone'), '3+0', 'камінь в HUD');
  await page.waitForFunction(() => document.querySelector('#score').textContent === '3', null, { timeout: 5000 })
    .catch(async () => { throw new Error(`жителі в HUD: очікувано "3", є ${JSON.stringify(await text(page, '#score'))}`); });
  return errors;
}

async function u4(browser) {
  const variants = {
    'day з HTML': () => { const f = structuredClone(FIXTURE); f.st.day = XSS_DAY; return f; },
    'li рядком': () => { const f = structuredClone(FIXTURE); f.li = String(f.li); return f; },
    'без v': () => { const f = structuredClone(FIXTURE); delete f.st.v; return f; },
  };
  // варіанти перевіряються всі, навіть якщо перший уже впав: так видно, яка саме перевірка зламалась
  const errors = [];
  for (const [name, make] of Object.entries(variants)) {
    const { page, errors: errs, requests } = await open(browser);
    const fail = (msg) => errors.push(`${name}: ${msg}`);
    await page.goto(ORIGIN + '/');
    const title = await page.title();
    await load(page, { 'archipelag3:current': JSON.stringify(make()), 'archipelag3:progress': '{"stars":[1]}' });
    await sleep(500); // дати час img/onerror, якщо розмітка все ж потрапила в сторінку
    const got = await page.title();
    if (got !== title) fail(`заголовок сторінки: очікувано ${JSON.stringify(title)}, є ${JSON.stringify(got)}`);
    if (requests.some((u) => new URL(u).pathname === '/x')) fail('був запит на /x');
    if (await page.evaluate(() => localStorage.getItem('archipelag3:current')) !== null) fail('archipelag3:current не видалено');
    const play = await text(page, '#btn-play');
    if (play !== 'Грати') fail(`#btn-play: очікувано "Грати", є ${JSON.stringify(play)}`);
    errs.forEach(fail);
    await page.context().close();
  }
  return errors;
}

// ---------- запуск ----------
const SCENARIOS = [
  ['U1', 'головний екран', u1],
  ['U2', 'бот у інтерфейсі, рівень 1', (b) => u2(b, 0)],
  ['U2', 'бот у інтерфейсі, рівень 2 (+ скриншоти U5)', (b) => u2(b, 1)],
  ['U3', 'сумісність збережень', u3],
  ['U4', 'підмінене збереження відкидається', u4],
];

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--enable-unsafe-swiftshader'], // WebGL без GPU
  });
  const only = process.argv.slice(2).map((a) => a.toUpperCase());
  const run = SCENARIOS.filter(([id]) => !only.length || only.includes(id));
  let failed = 0;
  for (const [id, name, fn] of run) {
    const t0 = Date.now();
    let problems;
    try {
      problems = await withTimeout(fn(browser), 300000, name);
    } catch (e) {
      problems = [e.message];
    }
    // кожна сторінка безперервно малює WebGL програмно, тож відкриті вкладки гальмують наступні сценарії
    while (contexts.length) await contexts.pop().close();
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    if (problems.length) {
      failed++;
      console.error(`${id} FAIL ${name} (${secs} с)`);
      for (const p of problems) console.error('   ' + p);
    } else console.log(`${id} OK   ${name} (${secs} с)`);
  }
  await browser.close();
  if (failed) { console.error(`check:ui FAIL: ${failed} з ${run.length}`); process.exit(1); }
  console.log(`check:ui OK: ${run.length} сценаріїв, скриншоти в ${path.relative(process.cwd(), OUT) || '.'}`);
})();
