import type { PersistedChronoState } from '../types';

export interface ChronoReading {
  elapsedMs: number;
  displayMs: number;
  progressPct: number;
  phase: 'work' | 'rest';
  round: number;
  completed: boolean;
  /** Epoch at the next phase boundary, including elapsed time before a pause. */
  nextBoundaryEpochMs: number | null;
}

/** A render interval only refreshes the display. The system clock owns elapsed time. */
export function readChrono(state: PersistedChronoState, now = Date.now()): ChronoReading {
  const elapsedMs = Math.max(0, state.accumulatedElapsedMs + (
    state.running && state.startedAtEpochMs !== null ? Math.max(0, now - state.startedAtEpochMs) : 0
  ));
  const boundaryEpoch = (boundary: number) => state.running && state.startedAtEpochMs !== null
    ? state.startedAtEpochMs + boundary - state.accumulatedElapsedMs
    : null;

  if (state.mode === 'stopwatch') {
    return { elapsedMs, displayMs: elapsedMs, progressPct: 100, phase: 'work', round: 1, completed: false, nextBoundaryEpochMs: null };
  }
  if (state.mode === 'countdown') {
    const duration = Math.max(1000, state.initialSelectedMs);
    const displayMs = Math.max(0, duration - elapsedMs);
    return { elapsedMs, displayMs, progressPct: displayMs / duration * 100, phase: 'work', round: 1, completed: elapsedMs >= duration, nextBoundaryEpochMs: boundaryEpoch(duration) };
  }

  const work = Math.max(1000, state.hiitWorkSec * 1000);
  const rest = Math.max(1000, state.hiitRestSec * 1000);
  const rounds = Math.max(1, Math.floor(state.hiitTotalRounds));
  const total = work * rounds + rest * (rounds - 1);
  if (elapsedMs >= total) {
    return { elapsedMs, displayMs: 0, progressPct: 0, phase: 'work', round: rounds, completed: true, nextBoundaryEpochMs: null };
  }
  const round = Math.min(rounds, Math.floor(elapsedMs / (work + rest)) + 1);
  const inRound = elapsedMs - (round - 1) * (work + rest);
  const phase = inRound < work ? 'work' : 'rest';
  const duration = phase === 'work' ? work : rest;
  const phaseElapsed = phase === 'work' ? inRound : inRound - work;
  const displayMs = Math.max(0, duration - phaseElapsed);
  return { elapsedMs, displayMs, progressPct: displayMs / duration * 100, phase, round, completed: false, nextBoundaryEpochMs: boundaryEpoch(elapsedMs + displayMs) };
}

export function pauseChrono(state: PersistedChronoState, now = Date.now()): PersistedChronoState {
  return { ...state, running: false, startedAtEpochMs: null, accumulatedElapsedMs: readChrono(state, now).elapsedMs };
}

export function resetChrono(state: PersistedChronoState): PersistedChronoState {
  return { ...state, running: false, startedAtEpochMs: null, accumulatedElapsedMs: 0, hiitCurrentRound: 1, hiitPhase: 'work', laps: [] };
}

export function startChrono(state: PersistedChronoState, now = Date.now()): PersistedChronoState {
  const base = readChrono(state, now).completed ? resetChrono(state) : state;
  return { ...base, running: true, startedAtEpochMs: now };
}
