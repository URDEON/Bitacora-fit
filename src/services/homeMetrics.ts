import type { ActiveTab, BitacoraDB } from '../types';
import { shiftDate, weekStart } from './dates';

export interface HomeMetric {
  id: 'training' | 'water' | 'energy' | 'protein';
  name: string;
  value: number;
  goal: number | null;
  unit: string;
  period: string;
  tab: ActiveTab;
}

const configuredGoal = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;

/** Presentation only: preserve the real percentage and cap only the drawn ring. */
export function metricProgress(value: number, goal: unknown): { percent: number | null; ringPercent: number } {
  const target = configuredGoal(goal);
  const percent = target === null ? null : value / target * 100;
  return percent === null || !Number.isFinite(percent)
    ? { percent: null, ringPercent: 0 }
    : { percent, ringPercent: Math.min(100, Math.max(0, percent)) };
}

/** The existing Home calculations, extracted without changing their formulas or data. */
export function selectHomeMetrics(db: BitacoraDB, currentDate: string): HomeMetric[] {
  const meals = db.meals.filter(meal => meal.date === currentDate);
  const water = db.waterLogs.filter(log => log.date === currentDate).reduce((sum, log) => sum + log.ml, 0);
  const kcal = meals.reduce((sum, meal) => sum + meal.calories, 0);
  const protein = meals.reduce((sum, meal) => sum + meal.protein, 0);
  const start = weekStart(currentDate);
  const end = shiftDate(start, 7);
  const days = new Set(db.workouts.filter(workout => workout.date >= start && workout.date < end).map(workout => workout.date)).size;
  return [
    { id: 'training', name: 'Entrenamientos', value: days, goal: configuredGoal(db.goals?.weeklyWorkoutDays), unit: 'días', period: 'esta semana', tab: 'progress' },
    { id: 'water', name: 'Hidratación', value: water, goal: configuredGoal(db.goals?.waterMl), unit: 'ml', period: 'en el día', tab: 'meals' },
    { id: 'energy', name: 'Energía', value: Math.round(kcal), goal: configuredGoal(db.goals?.calories), unit: 'kcal', period: 'en el día', tab: 'meals' },
    { id: 'protein', name: 'Proteína', value: Math.round(protein * 10) / 10, goal: configuredGoal(db.goals?.proteinG), unit: 'g', period: 'en el día', tab: 'meals' },
  ];
}
