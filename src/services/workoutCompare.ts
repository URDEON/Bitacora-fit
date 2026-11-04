import type { WorkoutEntry } from '../types';

/**
 * Registro de fuerza anterior con el que se compara una carga. Se consideran solo fechas previas;
 * si hay varios registros en la misma fecha, decide la hora y después el identificador (el más reciente).
 */
export function previousComparableWorkout(workouts: WorkoutEntry[], current: WorkoutEntry): WorkoutEntry | null {
  const name = current.name.toLowerCase();
  return workouts
    .filter((item) => item.mode === 'strength' && item.name.toLowerCase() === name && item.date < current.date)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.time || '').localeCompare(a.time || '') || b.id - a.id)[0] ?? null;
}
