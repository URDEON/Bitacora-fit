import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commitPersonalUpdate, emptyPersonalData, mergePersonalData, parsePersonalBackup, personalBackupJSON, personalSummary, validatePersonalData, MAX_PERSONAL_TIMESTAMP, type PersonalData, type PersonalTransaction } from '../src/services/personalData';
const transaction = (id: string, kind: PersonalTransaction['kind'], amount: number, date = '2026-11-05'): PersonalTransaction => ({ id, kind, amount, date, time: '10:00', category: 'General', description: '', createdAt: 1, updatedAt: 2 });
function seeded(): PersonalData { return { ...emptyPersonalData(), updatedAt: 10, transactions: [transaction('income', 'income', 1_000_001), transaction('expense-a', 'expense', 400_003), transaction('expense-old', 'expense', 200_007, '2026-10-31')], notes: [{ id: 'note', kind: 'task', title: 'Lista personal', body: '<script>texto literal</script>', favorite: true, tasks: [{ id: 'task', text: 'Primera tarea', done: false }], createdAt: 1, updatedAt: 2 }] }; }

test('Finanzas: saldo global y resumen mensual conservan pesos exactos y fechas reales', () => {
  const summary = personalSummary(seeded(), '2026-11');
  assert.equal(summary.balance, 399_991);
  assert.equal(summary.income, 1_000_001);
  assert.equal(summary.expense, 400_003);
  assert.equal(summary.transactions.length, 2);
  assert.deepEqual(summary.categories, [['General', 400_003]]);
  const empty = personalSummary(seeded(), '2025-01');
  assert.equal(empty.income, 0); assert.equal(empty.expense, 0); assert.deepEqual(empty.categories, []);
});
test('Respaldo personal: ida y vuelta conserva notas, tareas y movimientos sin formato Fit', () => {
  const data = seeded();
  const encoded = personalBackupJSON(data);
  assert.deepEqual(parsePersonalBackup(encoded), data);
  assert.throws(() => parsePersonalBackup(JSON.stringify({ version: 5, workouts: [] })));
  assert.throws(() => parsePersonalBackup(JSON.stringify(data)));
  assert.throws(() => parsePersonalBackup('{ archivo roto'));
  assert.equal(parsePersonalBackup(encoded).notes[0].body, '<script>texto literal</script>');
});
test('Datos personales: rechaza dinero fraccionario/negativo/infinito, fechas inválidas e IDs repetidos', () => {
  for (const amount of [0, -1, 1.5, Infinity, NaN, 10_000_000_001]) {
    const data = seeded(); data.transactions[0].amount = amount;
    assert.throws(() => validatePersonalData(data));
  }
  const dates = ['2026-02-30', '2026-13-01', 'hola', '2026-1-01'];
  for (const date of dates) { const data = seeded(); data.transactions[0].date = date; assert.throws(() => validatePersonalData(data)); }
  const duplicate = seeded(); duplicate.transactions.push({ ...duplicate.transactions[0] }); assert.throws(() => validatePersonalData(duplicate));
  const tasks = seeded(); tasks.notes[0].tasks.push({ ...tasks.notes[0].tasks[0] }); assert.throws(() => validatePersonalData(tasks));
  const injected = JSON.parse(personalBackupJSON(seeded())); injected.data.deleted.notes = JSON.parse('{"__proto__":123}');
  assert.throws(() => parsePersonalBackup(JSON.stringify(injected)));
});
test('Combinación personal: idempotente, elige la edición más reciente sin duplicar registros', () => {
  const old = seeded(); const newer = seeded(); newer.updatedAt = 20; newer.notes[0] = { ...newer.notes[0], title: 'Título actualizado', updatedAt: 20 };
  const merged = mergePersonalData(old, newer);
  assert.equal(merged.notes[0].title, 'Título actualizado');
  assert.deepEqual(mergePersonalData(merged, newer), merged);
  assert.equal(merged.transactions.length, old.transactions.length);
  assert.equal(merged.notes.length, 1);
});
test('Eliminaciones personales: una copia antigua no resucita movimientos ni notas eliminados', () => {
  const original = seeded();
  const removed = commitPersonalUpdate(original, { ...original, transactions: original.transactions.filter(item => item.id !== 'expense-a'), notes: [] }, 100);
  assert.equal(removed.deleted.transactions['expense-a'], 100);
  assert.equal(removed.deleted.notes.note, 100);
  const merged = mergePersonalData(removed, original);
  assert.equal(merged.notes.length, 0);
  assert.equal(merged.transactions.some(item => item.id === 'expense-a'), false);
  assert.deepEqual(mergePersonalData(merged, original), merged);
  assert.equal(original.notes.length, 1, 'No muta el snapshot anterior');
});

test('Concurrencia: la unión canónica es conmutativa, estable e incluye las dos pestañas', () => {
  const base = emptyPersonalData();
  const left = commitPersonalUpdate(base, { ...base, transactions: [transaction('b', 'income', 100)], notes: [] }, 100);
  const right = commitPersonalUpdate(base, { ...base, transactions: [transaction('a', 'income', 200)], notes: [] }, 100);
  const both = mergePersonalData(left, right);
  assert.equal(JSON.stringify(both), JSON.stringify(mergePersonalData(right, left)));
  assert.deepEqual(both.transactions.map(item => item.id), ['a', 'b']);
  assert.equal(personalSummary(both, '2026-11').balance, 300);
  assert.equal(JSON.stringify(mergePersonalData(both, left)), JSON.stringify(both));
  const edited = structuredClone(left); edited.transactions[0].description = 'Cambio concurrente';
  assert.equal(JSON.stringify(mergePersonalData(left, edited)), JSON.stringify(mergePersonalData(edited, left)), 'Empates de edición no producen ecos entre pestañas');
});
test('Respaldo personal: rechaza timestamps fuera del rango Date para no romper Notas', () => {
  for (const field of ['createdAt', 'updatedAt'] as const) {
    const data = seeded(); data.notes[0][field] = Number.MAX_SAFE_INTEGER;
    assert.throws(() => validatePersonalData(data));
  }
  const updated = seeded(); updated.updatedAt = MAX_PERSONAL_TIMESTAMP + 1; assert.throws(() => validatePersonalData(updated));
  const removed = seeded(); removed.deleted.notes.note = Number.MAX_SAFE_INTEGER; assert.throws(() => validatePersonalData(removed));
});

test('Los identificadores reservados no entran al almacén ni a los índices de eliminación', () => {
  for (const id of ['__proto__', 'prototype', 'constructor']) {
    const data = seeded(); data.notes[0].id = id; assert.throws(() => validatePersonalData(data));
    const movement = seeded(); movement.transactions[0].id = id; assert.throws(() => validatePersonalData(movement));
    const task = seeded(); task.notes[0].tasks[0].id = id; assert.throws(() => validatePersonalData(task));
  }
});

test('Restaurar una copia antigua no rebaja las marcas de eliminación anteriores', () => {
  const latest = { ...emptyPersonalData(), updatedAt: 100, deleted: { transactions: {}, notes: { removed: 100 } } };
  const oldBackup = { ...emptyPersonalData(), updatedAt: 10, deleted: { transactions: {}, notes: { removed: 10 } } };
  const replacement = commitPersonalUpdate(latest, oldBackup, 200);
  assert.equal(replacement.deleted.notes.removed, 100);
  const stale = seeded(); stale.updatedAt = 50; stale.notes[0] = { ...stale.notes[0], id: 'removed', updatedAt: 50 };
  assert.equal(mergePersonalData(replacement, stale).notes.length, 0);
});
