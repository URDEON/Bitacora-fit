import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MetricCarousel } from '../src/components/MetricCarousel';
import { metricProgress, selectHomeMetrics } from '../src/services/homeMetrics';
import type { BitacoraDB, DailyGoals, WorkoutEntry } from '../src/types';

const workout = (id: number, date: string): WorkoutEntry => ({
  id, date, name: 'Press de banca', category: 'Pecho', mode: 'strength',
  sets: 3, reps: 8, weight: 40,
});

function fixture(): BitacoraDB {
  return {
    goals: { calories: 2000, proteinG: 120, waterMl: 1000, weeklyWorkoutDays: 4, targetWeightKg: 75 },
    workouts: [workout(1, '2026-11-02'), workout(2, '2026-11-02'), workout(3, '2026-11-04'), workout(4, '2026-11-01')],
    meals: [
      { id: 10, date: '2026-11-04', time: '08:00', mealType: 'Desayuno', desc: 'Avena', calories: 600.4, protein: 40.24 },
      { id: 11, date: '2026-11-04', time: '13:00', mealType: 'Almuerzo', desc: 'Pollo', calories: 899.6, protein: 49.76 },
      { id: 12, date: '2026-11-03', time: '08:00', mealType: 'Desayuno', desc: 'Huevos', calories: 500, protein: 30 },
    ],
    waterLogs: [
      { id: 20, date: '2026-11-04', time: '08:00', ml: 1000, label: 'Agua' },
      { id: 21, date: '2026-11-04', time: '13:00', ml: 500, label: 'Agua' },
      { id: 22, date: '2026-11-03', time: '08:00', ml: 500, label: 'Agua' },
    ],
  } as BitacoraDB;
}

test('Home: cuatro mediciones reales, días únicos y fórmulas existentes', () => {
  const db = fixture();
  const before = JSON.stringify(db);
  const metrics = selectHomeMetrics(db, '2026-11-04');
  assert.deepEqual(metrics.map(({ id, name, value, goal, unit }) => ({ id, name, value, goal, unit })), [
    { id: 'training', name: 'Entrenamientos', value: 2, goal: 4, unit: 'días' },
    { id: 'water', name: 'Hidratación', value: 1500, goal: 1000, unit: 'ml' },
    { id: 'energy', name: 'Energía', value: 1500, goal: 2000, unit: 'kcal' },
    { id: 'protein', name: 'Proteína', value: 90, goal: 120, unit: 'g' },
  ]);
  assert.equal(JSON.stringify(db), before, 'Consultar métricas no debe mutar ni duplicar los registros');
});

test('Home: fecha seleccionada, cambio de semana y día vacío', () => {
  const db = fixture();
  assert.deepEqual(selectHomeMetrics(db, '2026-11-03').map(m => m.value), [2, 500, 500, 30]);
  assert.deepEqual(selectHomeMetrics(db, '2026-11-01').map(m => m.value), [1, 0, 0, 0]);
  assert.deepEqual(selectHomeMetrics(db, '2026-11-09').map(m => m.value), [0, 0, 0, 0]);
});

test('Home: registro nuevo y redondeo nutricional se reflejan sin caché obsoleta', () => {
  const db = fixture();
  selectHomeMetrics(db, '2026-11-04');
  const changed: BitacoraDB = {
    ...db,
    waterLogs: [...db.waterLogs, { id: 23, date: '2026-11-04', time: '15:00', ml: 250, label: 'Agua' }],
    meals: [...db.meals, { id: 13, date: '2026-11-04', time: '15:00', mealType: 'Colación / Post-entreno', desc: 'Yogur', calories: 20.6, protein: 0.16 }],
  };
  assert.deepEqual(selectHomeMetrics(changed, '2026-11-04').map(m => m.value), [2, 1750, 1521, 90.2]);
  assert.equal(db.waterLogs.length, 3);
});

test('Home: porcentaje real superior a 100 y anillo limitado a una vuelta', () => {
  assert.deepEqual(metricProgress(1500, 1000), { percent: 150, ringPercent: 100 });
  assert.deepEqual(metricProgress(0, 1000), { percent: 0, ringPercent: 0 });
  assert.deepEqual(metricProgress(2, 4), { percent: 50, ringPercent: 50 });
});

test('Home: metas cero o no configuradas no producen porcentajes inválidos', () => {
  for (const goal of [0, undefined, null, -1, NaN, Infinity]) {
    assert.deepEqual(metricProgress(1500, goal), { percent: null, ringPercent: 0 });
  }
  const db = fixture();
  for (const goals of [{}, { calories: 0, proteinG: 0, waterMl: 0, weeklyWorkoutDays: 0 }]) {
    const metrics = selectHomeMetrics({ ...db, goals: goals as DailyGoals }, '2026-11-04');
    assert.deepEqual(metrics.map(m => m.value), [2, 1500, 1500, 90]);
    for (const metric of metrics) {
      assert.equal(metric.goal, null);
      assert.deepEqual(metricProgress(metric.value, metric.goal), { percent: null, ringPercent: 0 });
    }
  }
});

test('Carrusel: cada medición sin meta presenta un estado legible y un anillo vacío', () => {
  const db = { ...fixture(), goals: {} as DailyGoals };
  for (const metric of selectHomeMetrics(db, '2026-11-04')) {
    const html = renderToStaticMarkup(createElement(MetricCarousel, { metrics: [metric], onNavigate: () => {} }));
    assert.ok(html.includes('Meta sin configurar'), metric.name);
    assert.ok(html.includes('aria-valuenow="0"'), metric.name);
    assert.ok(html.includes('Configura tu objetivo en Ajustes'), metric.name);
    assert.ok(!/NaN|Infinity|undefined/.test(html), metric.name);
  }
});
