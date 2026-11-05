import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MetricCarousel } from '../src/components/MetricCarousel';
import { selectHomeMetrics } from '../src/services/homeMetrics';
import { selectMetricHistories } from '../src/services/metricHistory';
import type { BitacoraDB, WorkoutEntry } from '../src/types';

const workout = (id: number, date: string): WorkoutEntry => ({ id, date, name: 'Press', category: 'Pecho', mode: 'strength', sets: 3, reps: 8, weight: 40 });
const fixture = (): BitacoraDB => ({
  goals: { calories: 2000, proteinG: 120, waterMl: 1000, weeklyWorkoutDays: 4, targetWeightKg: 75 },
  workouts: [workout(1, '2026-10-28'), workout(2, '2026-10-29'), workout(3, '2026-10-29'), workout(4, '2026-11-04'), workout(5, '2026-11-05')],
  meals: [
    { id: 6, date: '2026-11-04', time: '08:00', mealType: 'Desayuno', desc: 'Avena', calories: 600.4, protein: 40.24 },
    { id: 7, date: '2026-11-04', time: '13:00', mealType: 'Almuerzo', desc: 'Pollo', calories: 899.6, protein: 49.76 },
    { id: 8, date: '2026-11-03', time: '08:00', mealType: 'Desayuno', desc: 'Huevos', calories: 500, protein: 30 },
    { id: 9, date: '2026-11-05', time: '08:00', mealType: 'Desayuno', desc: 'Yogur', calories: 400, protein: 20 },
  ],
  waterLogs: [
    { id: 10, date: '2026-11-04', time: '08:00', ml: 1000, label: 'Agua' },
    { id: 11, date: '2026-11-04', time: '13:00', ml: 500, label: 'Agua' },
    { id: 12, date: '2026-11-03', time: '08:00', ml: 500, label: 'Agua' },
  ],
} as BitacoraDB);

test('Historial: siete días exactos hasta la fecha seleccionada, sin incluir días posteriores', () => {
  const db = fixture();
  const before = JSON.stringify(db);
  const histories = selectMetricHistories(db, '2026-11-04');
  assert.deepEqual(histories.map(series => series.id), ['training', 'water', 'energy', 'protein']);
  for (const series of histories) {
    assert.deepEqual(series.points.map(point => point.date), ['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04']);
  }
  assert.deepEqual(histories[0].points.map(point => point.value), [1, 0, 0, 0, 0, 0, 1], 'Varios ejercicios en el mismo día no duplican los días entrenados');
  assert.deepEqual(histories.slice(1).map(series => series.points.map(point => point.value)), [
    [0, 0, 0, 0, 0, 500, 1500], [0, 0, 0, 0, 0, 500, 1500], [0, 0, 0, 0, 0, 30, 90],
  ]);
  assert.equal(JSON.stringify(db), before);
});

test('Historial: cambiar fecha o datos recalcula con las mismas fórmulas del círculo', () => {
  const db = fixture();
  const changed = { ...db, meals: [...db.meals, { id: 13, date: '2026-11-04', time: '15:00', mealType: 'Colación', desc: 'Yogur', calories: 20.6, protein: .16 }] };
  const history = selectMetricHistories(changed, '2026-11-04');
  const metrics = selectHomeMetrics(changed, '2026-11-04');
  for (const series of history.filter(item => item.id !== 'training')) {
    assert.equal(series.points[6].value, metrics.find(metric => metric.id === series.id)!.value);
  }
  assert.equal(history[2].points[6].value, 1521);
  assert.equal(history[3].points[6].value, 90.2);
  const next = selectMetricHistories(changed, '2026-11-05');
  assert.equal(next[2].points[6].value, 400);
  assert.equal(next[2].points[5].value, 1521);
});

test('Historial: fechas de año bisiesto y días vacíos mantienen siete valores reales', () => {
  const db = { ...fixture(), workouts: [], meals: [], waterLogs: [] };
  const history = selectMetricHistories(db, '2024-03-01');
  assert.deepEqual(history[0].points.map(point => point.date), ['2024-02-24', '2024-02-25', '2024-02-26', '2024-02-27', '2024-02-28', '2024-02-29', '2024-03-01']);
  assert.ok(history.every(series => series.points.every(point => point.value === 0)));
});

test('Historial: muestra únicamente la serie de la medición actual y una tabla accesible', () => {
  const db = fixture();
  const histories = selectMetricHistories(db, '2026-11-04');
  for (const metric of selectHomeMetrics(db, '2026-11-04')) {
    const html = renderToStaticMarkup(createElement(MetricCarousel, { metrics: [metric], histories, onNavigate: () => {} }));
    assert.ok(html.includes(`data-history="${metric.id}"`));
    assert.equal((html.match(/data-history=/g) || []).length, 1);
    assert.ok(html.includes('Ver los 7 días'));
    assert.ok(html.includes(`Historial de ${metric.name}`));
    assert.ok(html.includes('aria-current="date"'));
    assert.ok(!/NaN|Infinity|undefined/.test(html));
  }
});
