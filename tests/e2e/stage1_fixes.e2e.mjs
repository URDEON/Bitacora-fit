import assert from 'node:assert/strict';
import { createRunner, launch, newPage, readDb, sleep, startApp, waitFor } from './harness.mjs';

// 1x1 valid transparent PNG
const VALID_PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

// Fake JPEG filename whose real binary signature is ISO-BMFF ftypheic
const FAKE_JPEG_HEIC_BYTES = Buffer.from([
  0x00, 0x00, 0x00, 0x18,
  0x66, 0x74, 0x79, 0x70, // 'ftyp'
  0x68, 0x65, 0x69, 0x63, // 'heic'
  0x00, 0x00, 0x00, 0x00,
  0x6d, 0x69, 0x66, 0x31,
  0x68, 0x65, 0x69, 0x63,
]);

const app = await startApp();
const browser = await launch();
const run = createRunner('ETAPA 1 — Verificación E2E integral (C-03, C-06..C-10, C-12)');

const visiblePane = (page) => page.locator('main > div:not([hidden])');
const clickDock = (page, label) => page.locator('.bottom-dock').getByRole('button', { name: label, exact: true }).click();

try {
  await run.step('C-03 y C-10: rechaza HEIC disfrazado de JPG, acepta PNG real y confirma borrado sin window.confirm', async () => {
    const { page, context, errors } = await newPage(browser, {
      seed: {
        db: {
          goals: { calories: 2200, proteinG: 150, waterMl: 2500, targetWeightKg: 75, weeklyWorkoutDays: 4 },
        },
      },
    });
    const nativeDialogs = [];
    page.on('dialog', (d) => {
      nativeDialogs.push(d.message());
      void d.dismiss();
    });
    try {
      await page.goto(app.url);
      await waitFor(() => page.locator('.bottom-dock').isVisible(), { label: 'carga inicial' });

      await clickDock(page, 'Entrenar');
      await visiblePane(page).locator('button:has-text("fotos y mapa muscular")').click();
      await waitFor(() => page.locator('[role="dialog"]').isVisible(), { label: 'modal visual abierto' });

      const acceptAttr = await page.locator('[role="dialog"] input[type="file"]').getAttribute('accept');
      assert.equal(acceptAttr, 'image/jpeg,image/png,image/webp');

      // Subir archivo con extensión .jpg pero bytes reales HEIC
      await page.locator('[role="dialog"] input[type="file"]').setInputFiles({
        name: 'camara_iphone.jpg',
        mimeType: 'image/jpeg',
        buffer: FAKE_JPEG_HEIC_BYTES,
      });
      await waitFor(
        async () => (await page.locator('[role="dialog"] [role="alert"]').textContent())?.includes('HEIC/HEIF'),
        { label: 'mensaje de rechazo HEIC' },
      );
      let db = await readDb(page);
      assert.equal(Object.keys(db.customExercisePhotos || {}).length, 0);

      // Subir PNG real válido
      await page.locator('[role="dialog"] input[type="file"]').setInputFiles({
        name: 'maquina.png',
        mimeType: 'image/png',
        buffer: VALID_PNG_BYTES,
      });
      await waitFor(async () => {
        const cur = await readDb(page);
        return (cur.customExercisePhotos?.['Press de banca plano con barra'] || []).length === 1;
      }, { label: 'foto válida guardada' });

      db = await readDb(page);
      const savedUrl = db.customExercisePhotos['Press de banca plano con barra'][0];
      assert.match(savedUrl, /^data:image\/(jpeg|png|webp);base64,/);

      // C-10: Pulsar "Borrar foto" abre alertdialog accesible encima del modal visual (y Escape solo cierra el alertdialog)
      await page.locator('[role="dialog"]').getByRole('button', { name: /Borrar foto/i }).click();
      await waitFor(() => page.locator('[role="alertdialog"]').isVisible(), { label: 'diálogo accesible de borrado' });
      await page.keyboard.press('Escape');
      await waitFor(async () => !(await page.locator('[role="alertdialog"]').isVisible()), { label: 'cierre con Escape' });
      assert.equal(await page.locator('[role="dialog"]').isVisible(), true);
      db = await readDb(page);
      assert.equal(db.customExercisePhotos['Press de banca plano con barra'].length, 1);

      // Ahora confirmar eliminación
      await page.locator('[role="dialog"]').getByRole('button', { name: /Borrar foto/i }).click();
      await waitFor(() => page.locator('[role="alertdialog"]').isVisible());
      await page.locator('[role="alertdialog"]').getByRole('button', { name: 'Eliminar', exact: true }).click();
      await waitFor(async () => {
        const cur = await readDb(page);
        return (cur.customExercisePhotos?.['Press de banca plano con barra'] || []).length === 0;
      }, { label: 'foto eliminada tras confirmar' });

      assert.equal(nativeDialogs.length, 0, `No debía dispararse ningún diálogo nativo: ${nativeDialogs.join(', ')}`);
      assert.deepEqual(errors, []);
    } finally {
      await context.close();
    }
  });

  await run.step('C-06 y C-12e: steppers respetan el máximo y el badge +kg desempata registros del mismo día por hora/ID', async () => {
    const today = new Date();
    const isoToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const { page, context, errors } = await newPage(browser, {
      seed: {
        db: {
          workouts: [
            { id: 1, date: '2026-10-01', time: '09:00', category: 'Pecho', name: 'Press de banca plano con barra', mode: 'strength', sets: 4, reps: 8, weight: 60 },
            { id: 2, date: '2026-10-01', time: '18:30', category: 'Pecho', name: 'Press de banca plano con barra', mode: 'strength', sets: 4, reps: 8, weight: 65 },
            { id: 3, date: isoToday, time: '10:00', category: 'Pecho', name: 'Press de banca plano con barra', mode: 'strength', sets: 4, reps: 8, weight: 70 },
          ],
        },
      },
    });
    try {
      await page.goto(app.url);
      await waitFor(() => page.locator('.bottom-dock').isVisible());
      await clickDock(page, 'Entrenar');

      // C-12e: 70 kg hoy comparado contra el último de 2026-10-01 (18:30 -> 65 kg) debe mostrar +5 kg, no +10 kg
      const ticketText = await visiblePane(page).locator('.ticket-row').first().textContent();
      assert.ok(ticketText?.includes('+5 kg'), `Se esperaba +5 kg y se obtuvo: ${ticketText}`);

      // C-06: fijar Series en 29 y pulsar '+' cuatro veces -> no puede superar 30
      const setsInput = visiblePane(page).getByLabel('Series de fuerza');
      await setsInput.fill('29');
      const plusBtn = visiblePane(page).locator('.number-stepper').first().getByRole('button', { name: '+', exact: true });
      await plusBtn.click();
      await plusBtn.click();
      await plusBtn.click();
      await plusBtn.click();
      assert.equal(await setsInput.inputValue(), '30');

      assert.deepEqual(errors, []);
    } finally {
      await context.close();
    }
  });

  await run.step('C-07 y C-12b: MiniLineChart reinicia selección al cambiar ejercicio y delta de peso respeta fase de ganancia', async () => {
    const { page, context, errors } = await newPage(browser, {
      seed: {
        db: {
          goals: { calories: 2800, proteinG: 160, waterMl: 3000, targetWeightKg: 78, weeklyWorkoutDays: 4 },
          bodyMetrics: [
            { id: 1, date: '2026-10-01', time: '08:00', weightKg: 70 },
            { id: 2, date: '2026-10-15', time: '08:00', weightKg: 72.5 },
          ],
          workouts: [
            { id: 10, date: '2026-10-01', time: '10:00', category: 'Pecho', name: 'Press de banca plano con barra', mode: 'strength', sets: 4, reps: 8, weight: 60 },
            { id: 11, date: '2026-10-05', time: '10:00', category: 'Pecho', name: 'Press de banca plano con barra', mode: 'strength', sets: 4, reps: 8, weight: 65 },
            { id: 12, date: '2026-10-10', time: '10:00', category: 'Pecho', name: 'Press de banca plano con barra', mode: 'strength', sets: 4, reps: 8, weight: 70 },
            { id: 20, date: '2026-10-02', time: '10:00', category: 'Piernas y Glúteos', name: 'Sentadilla libre con barra', mode: 'strength', sets: 4, reps: 6, weight: 95 },
            { id: 21, date: '2026-10-12', time: '10:00', category: 'Piernas y Glúteos', name: 'Sentadilla libre con barra', mode: 'strength', sets: 4, reps: 6, weight: 105 },
          ],
        },
      },
    });
    try {
      await page.goto(app.url);
      await waitFor(() => page.locator('.bottom-dock').isVisible());
      await clickDock(page, 'Progreso');

      // C-12b: de 70 kg a 72.5 kg con meta 78 kg (+2.5 kg) debe pintarse favorable (var(--accent-green))
      const deltaColor = await visiblePane(page).locator('text=+2.5 kg').evaluate((el) => el.getAttribute('style') || '');
      assert.ok(deltaColor.includes('var(--accent-green)'), `Color inesperado para ganancia deseada: ${deltaColor}`);

      // C-07: ir a Gráficos Fuerza/Kcal, seleccionar el primer punto (60 kg) de Press de banca y cambiar a Sentadilla
      await visiblePane(page).getByRole('button', { name: /Gráficos Fuerza\/Kcal/i }).click();
      const chartCard = visiblePane(page).locator('.card-soft').first();
      await chartCard.locator('svg[role="group"] g[role="button"]').first().click();
      await waitFor(async () => (await chartCard.textContent())?.includes('60 kg'), {
        label: 'primer punto 60 kg seleccionado',
      });

      await chartCard.getByLabel('Ejercicio para el gráfico de cargas').selectOption('Sentadilla libre con barra');
      await waitFor(
        async () => (await chartCard.textContent())?.includes('105 kg'),
        { label: 'selección reiniciada al último punto (105 kg) del nuevo ejercicio' },
      );

      assert.deepEqual(errors, []);
    } finally {
      await context.close();
    }
  });

  await run.step('C-08 y C-09: listener único de retroceso, jerarquía completa de 5 niveles y navegación de historial sin salto forzado', async () => {
    const { page, context, errors } = await newPage(browser, {
      seed: {
        db: {
          routines: [
            {
              id: 'rt-1',
              title: 'Torso A',
              subtitle: '1 ejercicio',
              color: '#D94E28',
              exercises: [{ category: 'Pecho', name: 'Press de banca plano con barra', mode: 'strength', sets: 4, reps: 8, weight: 60, restSeconds: 90 }],
            },
          ],
          meals: [
            { id: 1, date: '2026-10-10', mealType: 'Almuerzo', time: '13:30', desc: 'Pollo con arroz', calories: 650, protein: 45, carbs: 70, fat: 14 },
          ],
          waterLogs: [
            { id: 2, date: '2026-10-10', time: '14:00', ml: 500, label: 'Botella' },
          ],
        },
      },
    });
    const importCapApp = async () =>
      page.evaluate(async () => {
        const entry = performance
          .getEntriesByType('resource')
          .find((r) => r.name.includes('capacitor_app') || r.name.includes('@capacitor/app'));
        const spec = entry ? entry.name : '/@id/@capacitor/app';
        const mod = await import(spec);
        return Boolean(await mod.App.hasListeners('backButton'));
      });
    const triggerBack = () =>
      page.evaluate(async () => {
        const entry = performance
          .getEntriesByType('resource')
          .find((r) => r.name.includes('capacitor_app') || r.name.includes('@capacitor/app'));
        const spec = entry ? entry.name : '/@id/@capacitor/app';
        const mod = await import(spec);
        await mod.App.notifyListeners('backButton', { canGoBack: false });
      });
    const hasBackListener = importCapApp;
    const activeTabName = () =>
      page.evaluate(() => document.querySelector('.bottom-dock .nav-item.active')?.textContent?.trim() || '');

    try {
      await page.goto(app.url);
      await waitFor(() => page.locator('.bottom-dock').isVisible());
      await waitFor(hasBackListener, { label: 'listener de backButton activo' });

      // C-09: Progreso -> Calendario -> tocar día con solo comidas/agua NO salta a Entrenar
      await clickDock(page, 'Progreso');
      await visiblePane(page).getByRole('button', { name: /Consistencia y Stats/i }).click();
      await page.locator('input[aria-label="Fecha de los registros"]').fill('2026-10-15');
      await visiblePane(page).getByRole('button', { name: /^2026-10-10/ }).click();
      assert.equal(await activeTabName(), 'Progreso', 'El calendario no debe saltar forzadamente a Entrenar');
      assert.equal(await page.locator('input[aria-label="Fecha de los registros"]').inputValue(), '2026-10-10');

      // C-09: Progreso -> Historial -> tocar fila de fecha abre Inicio (resumen del día), NO Entrenar
      await visiblePane(page).getByRole('button', { name: /Historial/i }).click();
      await visiblePane(page).locator('button.ticket-row:has-text("FECHA: 2026-10-10")').click();
      await waitFor(async () => (await activeTabName()) === 'Inicio', { label: 'navegación a Inicio desde Historial' });

      // C-08: Atrás desde el resumen del día regresa a Progreso -> Historial -> Calendario -> Peso -> Inicio
      await triggerBack();
      await waitFor(async () => (await activeTabName()) === 'Progreso', { label: 'regreso a Progreso' });
      assert.equal(await visiblePane(page).getByRole('button', { name: /Historial/i }).getAttribute('aria-pressed'), 'true');

      await triggerBack();
      await waitFor(async () => (await visiblePane(page).getByRole('button', { name: /Consistencia y Stats/i }).getAttribute('aria-pressed')) === 'true');

      await triggerBack();
      await waitFor(async () => (await visiblePane(page).getByRole('button', { name: /Peso Corporal/i }).getAttribute('aria-pressed')) === 'true');

      await triggerBack();
      await waitFor(async () => (await activeTabName()) === 'Inicio');

      // Apilar: Inicio -> Alimentación -> Entrenar -> Rutinas Guardadas -> Editar rutina -> Modal visual -> Diálogo
      await clickDock(page, 'Alimentación');
      await clickDock(page, 'Entrenar');
      await visiblePane(page).getByRole('button', { name: /RUTINAS GUARDADAS/i }).click();
      await visiblePane(page).getByRole('button', { name: 'Editar rutina Torso A', exact: true }).click();
      assert.equal(await visiblePane(page).locator('.routine-editor').isVisible(), true);

      // Abrir modal visual desde el chip de la rutina y subir 1 foto para abrir luego el diálogo de borrado
      await visiblePane(page).locator('.ticket-row button:has-text("Press de banca plano con barra")').click();
      await waitFor(() => page.locator('[role="dialog"]').isVisible());
      await page.locator('[role="dialog"] input[type="file"]').setInputFiles({
        name: 'foto.png',
        mimeType: 'image/png',
        buffer: VALID_PNG_BYTES,
      });
      await waitFor(() => page.locator('[role="dialog"]').getByRole('button', { name: /Borrar foto/i }).isVisible());
      await page.locator('[role="dialog"]').getByRole('button', { name: /Borrar foto/i }).click();
      await waitFor(() => page.locator('[role="alertdialog"]').isVisible());

      // Verificar que tras múltiples navegaciones el listener sigue activo (y cada pulso ejecuta 1 solo nivel, probando que no hay listeners duplicados)
      assert.equal(await hasBackListener(), true, 'El listener de navegación debe permanecer activo');

      // 1) Cierra ConfirmDialog
      await triggerBack();
      await waitFor(async () => !(await page.locator('[role="alertdialog"]').isVisible()));
      assert.equal(await page.locator('[role="dialog"]').isVisible(), true);

      // 2) Cierra ExerciseVisualModal
      await triggerBack();
      await waitFor(async () => !(await page.locator('[role="dialog"]').isVisible()));
      assert.equal(await visiblePane(page).locator('.routine-editor').isVisible(), true);

      // 3) Cierra RoutineEditor
      await triggerBack();
      await waitFor(async () => !(await visiblePane(page).locator('.routine-editor').isVisible()));
      assert.equal(await visiblePane(page).locator('button:has-text("INICIAR SESIÓN")').isVisible(), true);

      // 4) Sale de subvista Rutinas -> Logger
      await triggerBack();
      await waitFor(() => visiblePane(page).locator('#exercise-name').isVisible());
      assert.equal(await activeTabName(), 'Entrenar');

      // 5) Historial de pestañas: Entrenar -> Alimentación -> Inicio
      await triggerBack();
      await waitFor(async () => (await activeTabName()) === 'Alimentación');

      await triggerBack();
      await waitFor(async () => (await activeTabName()) === 'Inicio');

      assert.deepEqual(errors, []);
    } finally {
      await context.close();
    }
  });

  await run.step('C-12a, C-12c y C-12d: etiqueta Trabajo HIIT en banner, zonas secundarias ámbar en mapa muscular y scroll real al editar comida', async () => {
    const today = new Date();
    const isoToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const { page, context, errors } = await newPage(browser, {
      seed: {
        chrono: {
          mode: 'hiit',
          running: true,
          hiitWorkSec: 30,
          hiitRestSec: 15,
          hiitTotalRounds: 4,
          hiitCurrentRound: 1,
          hiitPhase: 'work',
        },
        db: {
          meals: [
            { id: 50, date: isoToday, mealType: 'Desayuno', time: '08:30', desc: 'Avena con claras', calories: 420, protein: 30, carbs: 52, fat: 8 },
          ],
          waterLogs: Array.from({ length: 10 }, (_, i) => ({
            id: 100 + i,
            date: isoToday,
            time: '09:00',
            ml: 250,
            label: `Vaso ${i + 1}`,
          })),
        },
      },
    });
    try {
      await page.goto(app.url);
      await waitFor(() => page.locator('.running-banner').isVisible());

      // C-12a: el banner muestra "Trabajo HIIT" en vez de "Descanso en curso"
      const bannerText = await page.locator('.running-banner').textContent();
      assert.ok(bannerText?.includes('Trabajo HIIT'), `Banner incorrecto: ${bannerText}`);

      // C-12c: en Hombros ("Press militar con barra" tiene upper_chest en secondaryMuscles), comprobar el color ámbar (#F59E0B) en upper_chest
      await clickDock(page, 'Entrenar');
      await visiblePane(page).locator('.cat-pill', { hasText: 'Hombros' }).click();
      await visiblePane(page).locator('.ex-info-eye-btn').first().click();
      await waitFor(() => page.locator('[role="dialog"] svg').first().isVisible());
      const upperChestAmber = await page.locator('[role="dialog"] svg path[d="M44 40 L59 40 L59 50 L43 49 Z"][fill="#F59E0B"]').count();
      assert.equal(upperChestAmber, 1, 'upper_chest secundario debe colorearse en ámbar (#F59E0B)');
      await page.locator('[role="dialog"] button[aria-label="Cerrar"]').click();

      // C-12d: en Alimentación con 10 registros de agua empujando el formulario mucho más abajo de 280px, editar comida desplaza hasta mealFormRef
      await clickDock(page, 'Alimentación');
      await sleep(100);
      await visiblePane(page).locator('.ticket-row:has-text("Avena con claras") button[title="Editar comida"]').click();
      await waitFor(async () => (await page.evaluate(() => window.scrollY)) > 400, {
        label: 'scroll dinámico hacia el formulario de comidas (>400px, no fijo en 280px)',
      });

      assert.deepEqual(errors, []);
    } finally {
      await context.close();
    }
  });
} finally {
  await browser.close();
  await app.close();
  run.finish();
}
