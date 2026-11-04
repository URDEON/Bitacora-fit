import assert from 'node:assert/strict';
import test from 'node:test';
import { activeSeriesDetails, ensureSeriesDetails, restoreSeriesDetails } from '../src/services/seriesDetails';
const defaults = { reps: 10, weight: 40 };
test('editing a multi-digit count preserves customized hidden series', () => {
  const rows = Array.from({ length: 12 }, (_, i) => ({ reps: i + 1, weight: i * 2.5 }));
  assert.equal(ensureSeriesDetails(rows, 1, defaults), rows);
  assert.equal(ensureSeriesDetails(rows, Number.NaN, defaults), rows);
  assert.equal(ensureSeriesDetails(rows, 12, defaults), rows);
  assert.deepEqual(activeSeriesDetails(rows, 2), rows.slice(0, 2));
  assert.equal(rows.length, 12);
});
test('growing initializes distinct row objects and limits allocation', () => {
  const first = { reps: 8, weight: 30 };
  const rows = ensureSeriesDetails([first], 3, defaults);
  assert.deepEqual(rows, [first, defaults, defaults]);
  assert.notEqual(rows[1], rows[2]);
  assert.equal(ensureSeriesDetails(rows, 31, defaults), rows);
  assert.deepEqual(activeSeriesDetails(rows, 31), []);
});
test('draft restore preserves blank inputs and rejects malformed rows', () => {
  const blank = [{ reps: Number.NaN, weight: 25 }];
  const restored = restoreSeriesDetails(JSON.parse(JSON.stringify(blank)));
  assert.ok(Number.isNaN(restored?.[0].reps));
  assert.equal(restored?.[0].weight, 25);
  assert.equal(restoreSeriesDetails([{ reps: '8', weight: 30 }]), null);
  assert.equal(restoreSeriesDetails(Array(31).fill(defaults)), null);
});
