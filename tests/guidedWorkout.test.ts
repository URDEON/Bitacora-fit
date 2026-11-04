import assert from 'node:assert/strict';
import { advanceGuidedWorkout, createGuidedWorkout, finishGuidedSet, guidedDisplayMs, parseGuidedWorkout, toggleGuidedPause } from '../src/services/guidedWorkout';
import type { WorkoutEntry } from '../src/types';

const entry = (patch: Partial<WorkoutEntry> = {}): WorkoutEntry => ({
  id: 123, date: '2026-11-04', time: '09:30', name: 'Press de banca', category: 'Pecho', mode: 'strength',
  sets: 3, reps: 10, weight: 40, restSeconds: 60, ...patch,
});

// Preparation expires into manual work, even after a long background suspension.
const preparing = createGuidedWorkout(entry(), 1000);
assert.equal(preparing.phase, 'preparing');
assert.equal(guidedDisplayMs(preparing, 6000), 5000);
assert.equal(advanceGuidedWorkout(preparing, 10999), preparing);
const work = advanceGuidedWorkout(preparing, 11000);
assert.equal(work.phase, 'work');
assert.equal(work.deadline, null);
assert.equal(advanceGuidedWorkout(work, 99999999), work);
assert.equal(finishGuidedSet(preparing, 6000), preparing);

// Every confirmed set rests except the last; clocks never finish sets themselves.
const rest = finishGuidedSet(work, 20000);
assert.equal(rest.phase, 'rest');
assert.equal(rest.set, 2);
assert.equal(rest.deadline, 80000);
assert.equal(finishGuidedSet(rest, 21000), rest); // duplicate click cannot consume another set
assert.equal(advanceGuidedWorkout(rest, 79999), rest);
const second = advanceGuidedWorkout(rest, 90000);
assert.equal(second.phase, 'work');
assert.equal(second.set, 2);
const third = advanceGuidedWorkout(finishGuidedSet(second, 100000), 200000);
const complete = finishGuidedSet(third, 210000);
assert.equal(complete.phase, 'complete');
assert.equal(complete.set, 3);
assert.equal(complete.deadline, null);
assert.equal(finishGuidedSet(complete, 220000), complete);

// Pause preserves both countdowns and elapsed work through reloads.
const pausedPreparation = toggleGuidedPause(preparing, 6000);
assert.equal(guidedDisplayMs(pausedPreparation, 999999), 5000);
assert.equal(advanceGuidedWorkout(pausedPreparation, 999999), pausedPreparation);
const resumedPreparation = toggleGuidedPause(pausedPreparation, 16000);
assert.equal(resumedPreparation.deadline, 21000);
assert.equal(advanceGuidedWorkout(resumedPreparation, 21000).phase, 'work');
const pausedWork = toggleGuidedPause(work, 15000);
assert.equal(finishGuidedSet(pausedWork, 16000), pausedWork);
assert.equal(guidedDisplayMs(toggleGuidedPause(pausedWork, 25000), 26000), 5000);
const pausedRest = toggleGuidedPause(rest, 30000);
assert.equal(toggleGuidedPause(pausedRest, 90000).deadline, 140000);

// A single set has no trailing rest; zero rests start the next set immediately.
assert.equal(finishGuidedSet(advanceGuidedWorkout(createGuidedWorkout(entry({ sets: 1 }), 1000), 11000), 12000).phase, 'complete');
const zero = finishGuidedSet(advanceGuidedWorkout(createGuidedWorkout(entry({ restSeconds: 0 }), 1000), 11000), 12000);
assert.equal(zero.phase, 'work');
assert.equal(zero.set, 2);
assert.equal(zero.deadline, null);
const timed = advanceGuidedWorkout(createGuidedWorkout(entry({ mode: 'time', seconds: 30 }), 1000), 11000);
assert.equal(advanceGuidedWorkout(timed, 999999), timed); // timed target is also confirmed manually

// Persisted data is validated rather than blindly trusted after restoring a draft.
for (const state of [preparing, work, rest, pausedWork, complete]) assert.deepEqual(parseGuidedWorkout(JSON.stringify(state)), state);
for (const text of ['bad json', 'null', '{}', JSON.stringify({ ...rest, deadline: null }), JSON.stringify({ ...work, set: 99 }), JSON.stringify({ ...work, phase: 'invalid' }), JSON.stringify({ ...work, entry: entry({ sets: 0 }) })]) {
  assert.equal(parseGuidedWorkout(text), null);
}
assert.throws(() => createGuidedWorkout(entry({ sets: 1.5 })));
assert.throws(() => createGuidedWorkout(entry({ mode: 'cardio' })));
console.log('Entrenamiento guiado: ciclo, pausas, segundo plano, límites y restauración verificados.');
