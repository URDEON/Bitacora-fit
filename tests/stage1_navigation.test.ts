import test from 'node:test';
import assert from 'node:assert/strict';
import {
  popSubviewHistory,
  pushSubviewHistory,
  pushTabHistory,
  resolveBackNavigation,
} from '../src/services/navigation';
import type { ActiveTab } from '../src/types';

test('C-08 respeta estrictamente la jerarquía: diálogo -> modal -> editor -> subvista -> historial -> salida', () => {
  const base = {
    hasOpenDialog: true,
    hasVisualModal: true,
    hasActiveEditor: true,
    hasActiveSubview: true,
    currentTab: 'exercises' as ActiveTab,
    tabHistory: ['home', 'meals'] as ActiveTab[],
  };

  assert.deepEqual(resolveBackNavigation(base), { type: 'dismiss-dialog' });

  const step2 = { ...base, hasOpenDialog: false };
  assert.deepEqual(resolveBackNavigation(step2), { type: 'close-visual-modal' });

  const step3 = { ...step2, hasVisualModal: false };
  assert.deepEqual(resolveBackNavigation(step3), { type: 'close-editor' });

  const step4 = { ...step3, hasActiveEditor: false };
  assert.deepEqual(resolveBackNavigation(step4), { type: 'leave-subview' });

  const step5 = { ...step4, hasActiveSubview: false };
  assert.deepEqual(resolveBackNavigation(step5), {
    type: 'navigate-tab',
    tab: 'meals',
    nextHistory: ['home'],
  });

  const step6 = { ...step5, currentTab: 'meals' as ActiveTab, tabHistory: ['home'] as ActiveTab[] };
  assert.deepEqual(resolveBackNavigation(step6), {
    type: 'navigate-tab',
    tab: 'home',
    nextHistory: [],
  });

  const step7 = { ...step6, currentTab: 'home' as ActiveTab, tabHistory: [] as ActiveTab[] };
  assert.deepEqual(resolveBackNavigation(step7), { type: 'exit-app' });
});

test('C-08 y C-09 el historial de pestañas permite volver a Progreso tras inspeccionar un día en Inicio y limpia al tocar Inicio en la barra', () => {
  let history: ActiveTab[] = [];
  // Inicio -> Progreso
  history = pushTabHistory(history, 'home', 'progress');
  assert.deepEqual(history, ['home']);

  // Desde Progreso (Historial/Calendario) se abre una fecha en Inicio sin forzar Entrenar
  history = pushTabHistory(history, 'progress', 'home', { resetOnHome: false });
  assert.deepEqual(history, ['home', 'progress']);

  // Al pulsar Atrás desde el resumen del día en Inicio, regresa a Progreso
  const backFromDay = resolveBackNavigation({
    hasOpenDialog: false,
    hasVisualModal: false,
    hasActiveEditor: false,
    hasActiveSubview: false,
    currentTab: 'home',
    tabHistory: history,
  });
  assert.deepEqual(backFromDay, {
    type: 'navigate-tab',
    tab: 'progress',
    nextHistory: ['home'],
  });

  // Si el usuario toca explícitamente Inicio en la barra inferior, limpia la pila para permitir salir luego
  const reset = pushTabHistory(['home', 'exercises', 'meals'], 'meals', 'home', { resetOnHome: true });
  assert.deepEqual(reset, []);
});

test('C-08 las subvistas recuerdan el recorrido interno antes de abandonar la pestaña', () => {
  type Section = 'weight' | 'charts' | 'calendar' | 'history';
  let stack: Section[] = [];
  stack = pushSubviewHistory(stack, 'weight', 'calendar', 'weight');
  stack = pushSubviewHistory(stack, 'calendar', 'history', 'weight');
  assert.deepEqual(stack, ['weight', 'calendar']);

  const firstBack = popSubviewHistory(stack, 'history', 'weight');
  assert.deepEqual(firstBack, { handled: true, nextView: 'calendar', nextHistory: ['weight'] });

  const secondBack = popSubviewHistory(firstBack.nextHistory, firstBack.nextView, 'weight');
  assert.deepEqual(secondBack, { handled: true, nextView: 'weight', nextHistory: [] });

  const thirdBack = popSubviewHistory(secondBack.nextHistory, secondBack.nextView, 'weight');
  assert.deepEqual(thirdBack, { handled: false, nextView: 'weight', nextHistory: [] });
});
