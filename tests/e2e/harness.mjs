import fs from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE_PATH || 'playwright-core');

export const PROJECT = process.env.PROJECT_DIR ?? process.cwd();
const DB_KEY = 'bitacora_fit_s20fe_v5';

const BROWSER = [
  process.env.EDGE_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/chromium',
].filter(Boolean).find((candidate) => fs.existsSync(candidate));

export async function startApp(port = 5190 + Math.floor(Math.random() * 400)) {
  const server = await createServer({ root: PROJECT, logLevel: 'error', server: { host: '127.0.0.1', port, strictPort: false } });
  await server.listen();
  return { url: server.resolvedUrls.local[0], close: () => server.close() };
}

export async function launch() {
  if (!BROWSER) throw new Error('No se encontró Edge/Chrome. Define EDGE_PATH.');
  return chromium.launch({ executablePath: BROWSER, headless: true });
}

/** Cuenta renderizados reales por componente de función leyendo los commits de React (modo desarrollo). */
const RENDER_HOOK = `(() => {
  const counts = {}; window.__renders = counts;
  const bump = (name) => { counts[name] = (counts[name] || 0) + 1; };
  const isFn = (fiber) => fiber.tag === 0 || fiber.tag === 15;
  const nameOf = (fiber) => (fiber.type && (fiber.type.displayName || fiber.type.name)) || 'anon';
  function walk(fiber) {
    for (let child = fiber.child; child; child = child.sibling) {
      const alt = child.alternate;
      if (!alt) continue;
      if (isFn(child) && (child.flags & 1)) bump(nameOf(child));
      if (child.child !== alt.child) walk(child);
    }
  }
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true, isDisabled: false, renderers: new Map(),
    inject(renderer) { const id = this.renderers.size + 1; this.renderers.set(id, renderer); return id; },
    onCommitFiberRoot(id, root) { walk(root.current); },
    onCommitFiberUnmount() {}, onPostCommitFiberRoot() {}, onScheduleFiberRoot() {}, checkDCE() {},
  };
})();`;

export async function newPage(browser, { seed, countRenders = false, viewport = { width: 412, height: 915 } } = {}) {
  const context = await browser.newContext({ viewport });
  if (countRenders) await context.addInitScript(RENDER_HOOK);
  if (seed) {
    await context.addInitScript(`(${((patch, key) => {
      if (localStorage.getItem(key)) return;
      const chrono = { mode: 'countdown', running: false, startedAtEpochMs: null, accumulatedElapsedMs: 0, initialSelectedMs: 90000, laps: [],
        hiitWorkSec: 40, hiitRestSec: 20, hiitTotalRounds: 8, hiitCurrentRound: 1, hiitPhase: 'work', autoStartOnSet: false, keepScreenAwake: false };
      const db = { version: 5, updatedAt: 1, workouts: [], meals: [], waterLogs: [], bodyMetrics: [], ...patch.db, chrono: { ...chrono, ...(patch.chrono || {}) } };
      if (patch.chrono && patch.chrono.running && patch.chrono.startedAtEpochMs === undefined) db.chrono.startedAtEpochMs = Date.now();
      localStorage.setItem(key, JSON.stringify(db));
    }).toString()})(${JSON.stringify(seed)}, ${JSON.stringify(DB_KEY)})`);
  }
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  return { page, context, errors };
}

export const readDb = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), DB_KEY);
export const renders = (page) => page.evaluate(() => ({ ...window.__renders }));
export const resetRenders = (page) => page.evaluate(() => { for (const key of Object.keys(window.__renders)) delete window.__renders[key]; });
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function waitFor(check, { timeout = 10000, interval = 100, label = 'condición' } = {}) {
  const end = Date.now() + timeout;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) throw new Error(`Tiempo agotado esperando: ${label}`);
    await sleep(interval);
  }
}

export function createRunner(title) {
  const results = [];
  return {
    async step(name, fn) {
      try { await fn(); results.push({ name, ok: true }); console.log(`  OK   ${name}`); }
      catch (error) { results.push({ name, ok: false, error }); console.log(`  FALLA ${name}\n        ${error.message}`); }
    },
    finish() {
      const failed = results.filter((result) => !result.ok).length;
      console.log(`\n${title}: ${results.length - failed}/${results.length} comprobaciones correctas`);
      process.exitCode = failed ? 1 : 0;
    },
  };
}
