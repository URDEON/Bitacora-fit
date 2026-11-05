import type { BitacoraDB } from '../types';
import { shiftDate } from './dates';
import { selectHomeMetrics, type HomeMetric } from './homeMetrics';

export interface MetricHistoryPoint { date: string; value: number; }
export interface MetricHistorySeries {
  id: HomeMetric['id'];
  name: string;
  unit: string;
  points: MetricHistoryPoint[];
}

/** Seven actual calendar days ending on the selected day, using the Home's totals. */
export function selectMetricHistories(db: BitacoraDB, currentDate: string): MetricHistorySeries[] {
  const days = Array.from({ length: 7 }, (_, index) => shiftDate(currentDate, index - 6));
  const values = days.map(date => ({ date, metrics: selectHomeMetrics(db, date) }));
  const workoutDays = new Set(db.workouts.map(workout => workout.date));
  return values[0].metrics.map(metric => ({
    id: metric.id,
    name: metric.name,
    unit: metric.unit,
    points: values.map(day => ({
      date: day.date,
      // A daily training mark is binary; the circle keeps its existing weekly total.
      value: metric.id === 'training' ? Number(workoutDays.has(day.date)) : day.metrics.find(item => item.id === metric.id)!.value,
    })),
  }));
}
