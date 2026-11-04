import type { WorkoutEntry } from '../types';
import { validateDB } from './dbValidation';

export const GUIDED_WORKOUT_KEY = 'bitacora_fit_guided_workout_v1';
export interface GuidedWorkout {
  entry: WorkoutEntry;
  phase: 'preparing' | 'work' | 'rest' | 'complete';
  /** One-based index of the set being performed, or the next set during rest. */
  set: number;
  phaseStartedAt: number;
  deadline: number | null;
  pausedAt: number | null;
  recorded?: boolean;
}

export function createGuidedWorkout(entry: WorkoutEntry, now = Date.now()): GuidedWorkout {
  validateDB({ workouts: [entry] });
  if (entry.mode === 'cardio' || !Number.isInteger(entry.sets) || entry.sets! < 1 || entry.sets! > 30) {
    throw new Error('El entrenamiento guiado necesita entre 1 y 30 series.');
  }
  return { entry, phase: 'preparing', set: 1, phaseStartedAt: now, deadline: now + 10_000, pausedAt: null };
}

/** Expired rests lead to work; a clock can never confirm a performed set. */
export function advanceGuidedWorkout(state: GuidedWorkout, now = Date.now()): GuidedWorkout {
  if (state.pausedAt !== null || state.deadline === null || now < state.deadline) return state;
  return { ...state, phase: 'work', phaseStartedAt: state.deadline, deadline: null };
}

export function finishGuidedSet(state: GuidedWorkout, now = Date.now()): GuidedWorkout {
  if (state.phase !== 'work' || state.pausedAt !== null) return state;
  if (state.set === state.entry.sets) {
    return { ...state, phase: 'complete', phaseStartedAt: now, deadline: null };
  }
  const restMs = (state.entry.restSeconds ?? 90) * 1000;
  return { ...state, set: state.set + 1, phase: restMs > 0 ? 'rest' : 'work', phaseStartedAt: now, deadline: restMs > 0 ? now + restMs : null };
}

export function toggleGuidedPause(state: GuidedWorkout, now = Date.now()): GuidedWorkout {
  if (state.phase === 'complete') return state;
  if (state.pausedAt === null) return { ...state, pausedAt: now };
  const pausedMs = Math.max(0, now - state.pausedAt);
  return { ...state, pausedAt: null, phaseStartedAt: state.phaseStartedAt + pausedMs, deadline: state.deadline === null ? null : state.deadline + pausedMs };
}

export function guidedDisplayMs(state: GuidedWorkout, now = Date.now()): number {
  const clock = state.pausedAt ?? now;
  if (state.phase === 'complete') return 0;
  return Math.max(0, state.deadline === null ? clock - state.phaseStartedAt : state.deadline - clock);
}

/** A damaged local draft must never prevent opening the app or create a record. */
export function parseGuidedWorkout(text: string | null): GuidedWorkout | null {
  if (!text) return null;
  try {
    const state: GuidedWorkout = JSON.parse(text);
    createGuidedWorkout(state.entry);
    if (state.recorded !== undefined && typeof state.recorded !== 'boolean') return null;
    if (!['preparing', 'work', 'rest', 'complete'].includes(state.phase) || !Number.isInteger(state.set) || state.set < 1 || state.set > state.entry.sets!) return null;
    if (!Number.isFinite(state.phaseStartedAt) || state.phaseStartedAt < 0) return null;
    if (state.pausedAt !== null && (!Number.isFinite(state.pausedAt) || state.pausedAt < state.phaseStartedAt)) return null;
    if (state.phase === 'preparing' || state.phase === 'rest') {
      if (state.deadline === null || !Number.isFinite(state.deadline) || state.deadline < state.phaseStartedAt) return null;
    } else if (state.deadline !== null) return null;
    if (state.phase === 'complete' && state.set !== state.entry.sets) return null;
    return state;
  } catch { return null; }
}
