import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PersistedChronoState } from '../src/types';
import { pauseChrono, readChrono, resetChrono, startChrono } from '../src/services/chronoEngine';

const initial = (patch: Partial<PersistedChronoState> = {}): PersistedChronoState => ({
  mode: 'countdown', running: false, startedAtEpochMs: null, accumulatedElapsedMs: 0,
  initialSelectedMs: 90000, laps: [], hiitWorkSec: 40, hiitRestSec: 20, hiitTotalRounds: 3,
  hiitCurrentRound: 1, hiitPhase: 'work', autoStartOnSet: false, keepScreenAwake: false, ...patch,
});

test('countdown uses timestamps after long background suspension', () => {
  const state = startChrono(initial(), 1000);
  assert.equal(readChrono(state, 31000).displayMs, 60000);
  assert.equal(readChrono(state, 91000).completed, true);
  assert.equal(readChrono(state, 900000).displayMs, 0);
  assert.equal(readChrono(state, 1000).nextBoundaryEpochMs, 91000);
});

test('pause and resume preserve elapsed time without counting the pause', () => {
  const paused = pauseChrono(startChrono(initial({ mode: 'stopwatch' }), 1000), 12000);
  assert.equal(readChrono(paused, 999999).displayMs, 11000);
  const resumed = startChrono(paused, 20000);
  assert.equal(readChrono(resumed, 23000).displayMs, 14000);
  assert.equal(resetChrono(resumed).accumulatedElapsedMs, 0);
});

test('HIIT skips every elapsed phase on resume and has no trailing rest', () => {
  const state = startChrono(initial({ mode: 'hiit' }), 1000);
  assert.deepEqual([readChrono(state, 41000).phase, readChrono(state, 41000).displayMs], ['rest', 20000]);
  const resumed = readChrono(state, 131000);
  assert.deepEqual([resumed.round, resumed.phase, resumed.displayMs], [3, 'work', 30000]);
  assert.equal(readChrono(state, 161000).completed, true);
  assert.equal(readChrono(state, 160999).completed, false);
});

test('paused HIIT resumes within the same phase and boundary stays correct', () => {
  const paused = pauseChrono(startChrono(initial({ mode: 'hiit' }), 1000), 46000);
  const resumed = startChrono(paused, 90000);
  assert.equal(readChrono(resumed, 95000).displayMs, 10000);
  assert.equal(readChrono(resumed, 95000).nextBoundaryEpochMs, 105000);
});

test('a completed HIIT can start from round one and a single round ends after work', () => {
  const completed = initial({ mode: 'hiit', accumulatedElapsedMs: 160000, hiitCurrentRound: 3 });
  const restarted = startChrono(completed, 1000);
  assert.equal(readChrono(restarted, 1000).round, 1);
  assert.equal(readChrono(restarted, 1000).displayMs, 40000);
  assert.equal(readChrono(startChrono(initial({ mode: 'hiit', hiitTotalRounds: 1 }), 1000), 41000).completed, true);
});
