import type { PersistedChronoState } from '../types';

/** Texto del aviso de reloj activo según el modo y, en HIIT, la fase real. */
export function runningChronoLabel(chrono: Pick<PersistedChronoState, 'mode' | 'hiitPhase'>): string {
  if (chrono.mode === 'stopwatch') return 'Cronómetro';
  if (chrono.mode === 'hiit') return chrono.hiitPhase === 'work' ? 'Trabajo HIIT' : 'Descanso HIIT';
  return 'Descanso';
}
