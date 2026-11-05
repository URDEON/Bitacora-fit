import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MetricCarousel } from '../src/components/MetricCarousel';
import { chargeFraction, waterSurfaceY } from '../src/services/metricVisuals';
import type { HomeMetric } from '../src/services/homeMetrics';

// Independently recover the circular segment area below the rendered surface.
// This catches a linear-height fill, which would overstate low water volumes.
function waterAreaFraction(surfaceY: number): number {
  const radius = 146;
  const offset = Math.max(-radius, Math.min(radius, surfaceY - 160));
  return (radius ** 2 * Math.acos(offset / radius)
    - offset * Math.sqrt(Math.max(0, radius ** 2 - offset ** 2))) / (Math.PI * radius ** 2);
}

test('Agua: el área real del líquido representa el porcentaje, no su altura', () => {
  for (const percent of [0, 5, 25, 50, 75, 95, 100]) {
    assert.ok(Math.abs(waterAreaFraction(waterSurfaceY(percent)) - percent / 100) < 0.00001, `${percent} %`);
  }
  assert.equal(waterSurfaceY(0), 306);
  assert.equal(waterSurfaceY(50), 160);
  assert.equal(waterSurfaceY(100), 14);
});

test('Agua: sube de forma continua y se limita al recipiente por encima de la meta', () => {
  let previous = waterSurfaceY(0);
  for (let percent = 1; percent <= 100; percent += 1) {
    const current = waterSurfaceY(percent);
    assert.ok(current < previous, `El nivel debe subir al pasar a ${percent} %`);
    previous = current;
  }
  assert.equal(waterSurfaceY(-20), waterSurfaceY(0));
  assert.equal(waterSurfaceY(125), waterSurfaceY(100));
  for (const invalid of [NaN, Infinity, -Infinity]) assert.ok(Number.isFinite(waterSurfaceY(invalid)));
});

test('Carga y proteína: las fracciones conservan el progreso e incluyen valores parciales', () => {
  for (const count of [1, 4, 12, 20]) {
    for (const percent of [0, 0.5, 12.5, 25, 50, 75, 99.9, 100, 125]) {
      const fractions = Array.from({ length: count }, (_, index) => chargeFraction(percent, index, count));
      assert.ok(fractions.every(fraction => fraction >= 0 && fraction <= 1));
      assert.ok(Math.abs(fractions.reduce((sum, fraction) => sum + fraction, 0) - Math.min(100, percent) / 100 * count) < 0.000001);
      assert.ok(fractions.every((fraction, index) => index === 0 || fraction <= fractions[index - 1]));
    }
  }
  assert.equal(chargeFraction(12.5, 1, 12), 0.5, 'Una molécula parcial no puede redondearse a completa');
});

const metrics: HomeMetric[] = [
  { id: 'training', name: 'Entrenamientos', value: 2, goal: 4, unit: 'días', period: 'esta semana', tab: 'progress' },
  { id: 'water', name: 'Hidratación', value: 500, goal: 1000, unit: 'ml', period: 'en el día', tab: 'meals' },
  { id: 'energy', name: 'Energía', value: 1500, goal: 2000, unit: 'kcal', period: 'en el día', tab: 'meals' },
  { id: 'protein', name: 'Proteína', value: 90, goal: 120, unit: 'g', period: 'en el día', tab: 'meals' },
];

test('Carrusel: cuatro identidades decorativas distintas conservan el progreso accesible', () => {
  for (const metric of metrics) {
    const html = renderToStaticMarkup(createElement(MetricCarousel, { metrics: [metric], onNavigate: () => {} }));
    assert.equal((html.match(/data-visual=/g) ?? []).length, 1, metric.id);
    assert.ok(html.includes(`data-visual="${metric.id}"`), metric.id);
    assert.ok(html.includes(`aria-label="Progreso de ${metric.name}"`), metric.id);
    assert.ok(html.includes('role="progressbar"'), metric.id);
    assert.ok(!/NaN|Infinity|undefined/.test(html), metric.id);
  }
});

test('Carrusel: identidad sin meta mantiene datos reales y no inventa progreso', () => {
  for (const metric of metrics) {
    const html = renderToStaticMarkup(createElement(MetricCarousel, { metrics: [{ ...metric, goal: null }], onNavigate: () => {} }));
    assert.ok(html.includes('Meta sin configurar'), metric.id);
    assert.ok(html.includes('aria-valuenow="0"'), metric.id);
    assert.ok(html.includes(`data-visual="${metric.id}"`), metric.id);
    assert.ok(!/NaN|Infinity|undefined/.test(html), metric.id);
    if (metric.id === 'water') assert.ok(html.includes('data-fill-percent="0"'));
    if (metric.id === 'training') assert.equal((html.match(/data-segment=/g) ?? []).length, 0);
  }
});
