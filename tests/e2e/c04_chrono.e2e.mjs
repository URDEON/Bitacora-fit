import assert from 'node:assert/strict';
import { createRunner, launch, newPage, readDb, renders, resetRenders, sleep, startApp, waitFor } from './harness.mjs';

const run = createRunner('C-04 rendimiento del cronómetro');
const app = await startApp();
const browser = await launch();
try {
  await run.step('Cuenta atrás en marcha: App no se renderiza durante 3 s y el banner sigue avanzando', async () => {
    const { page, errors, context } = await newPage(browser, { countRenders: true, seed: { chrono: { running: true, initialSelectedMs: 12000 } } });
    await page.goto(app.url);
    const banner = page.locator('.running-banner strong');
    await banner.waitFor();
    await sleep(800);
    const first = await banner.textContent();
    await resetRenders(page);
    await sleep(3000);
    const counts = await renders(page);
    const later = await banner.textContent();
    console.log('        renders en 3 s:', JSON.stringify(counts), `| banner ${first} -> ${later}`);
    assert.ok((counts.App ?? 0) <= 1, `App se renderizó ${counts.App} veces`);
    assert.notEqual(first, later, 'el banner no avanzó');
    assert.deepEqual(errors, []);
    await context.close();
  });

  await run.step('Con la vista Cronómetro abierta solo ChronoView se actualiza a ~10 Hz; App permanece quieta', async () => {
    const { page, context } = await newPage(browser, { countRenders: true, seed: { chrono: { running: true, initialSelectedMs: 15000 } } });
    await page.goto(app.url);
    await page.locator('.running-banner').click();
    await page.locator('.chrono-big-digits').waitFor();
    await sleep(500);
    await resetRenders(page);
    const digits = page.locator('.chrono-big-digits');
    const before = await digits.textContent();
    await sleep(2000);
    const counts = await renders(page);
    const after = await digits.textContent();
    console.log('        renders en 2 s:', JSON.stringify(counts), `| reloj ${before} -> ${after}`);
    assert.ok((counts.App ?? 0) <= 1, `App se renderizó ${counts.App} veces`);
    assert.ok((counts.ChronoView ?? 0) >= 10, `ChronoView solo se renderizó ${counts.ChronoView} veces`);
    assert.notEqual(before, after);
    await context.close();
  });

  await run.step('Precisión: fin de descanso en el instante calculado, estado detenido y aviso retirado', async () => {
    const { page, context } = await newPage(browser, { seed: { chrono: { running: true, initialSelectedMs: 3000 } } });
    const started = Date.now();
    await page.goto(app.url);
    await page.locator('.running-banner').waitFor();
    await waitFor(async () => (await readDb(page))?.chrono.running === false, { timeout: 8000, label: 'fin de cuenta atrás' });
    const elapsed = Date.now() - started;
    await page.locator('.running-banner').waitFor({ state: 'detached', timeout: 3000 });
    console.log(`        cuenta atrás de 3 s completada ${elapsed} ms tras el inicio (incluye carga)`);
    assert.ok(elapsed >= 2900, `terminó demasiado pronto: ${elapsed} ms`);
    await context.close();
  });

  await run.step('HIIT: cambia de fase en cada límite (2 s trabajo / 2 s descanso / 2 rondas) y termina', async () => {
    const { page, context } = await newPage(browser, { seed: { chrono: { mode: 'hiit', running: true, hiitWorkSec: 2, hiitRestSec: 2, hiitTotalRounds: 2 } } });
    await page.goto(app.url);
    const seen = new Set();
    const t0 = Date.now();
    await waitFor(async () => {
      const db = await readDb(page);
      if (db) seen.add(`${db.chrono.hiitCurrentRound}:${db.chrono.hiitPhase}`);
      return db && db.chrono.running === false;
    }, { timeout: 12000, interval: 50, label: 'fin de HIIT' });
    console.log('        fases observadas:', [...seen].join(' -> '), `| ${Date.now() - t0} ms`);
    for (const phase of ['1:rest', '2:work']) assert.ok(seen.has(phase), `no se observó la fase ${phase}`);
    await context.close();
  });
} finally {
  await browser.close();
  await app.close();
  run.finish();
}
