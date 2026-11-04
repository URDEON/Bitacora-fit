import type { FoodReferenceItem } from '../types';

/** Los resultados son estimaciones basadas en la tabla nutricional del alimento. */
export function calculateFoodNutrition(food: FoodReferenceItem, amount: number) {
  if (!Number.isFinite(amount) || amount <= 0 || amount > (food.isUnit ? 100 : 10000)) {
    throw new Error(food.isUnit ? 'Ingresa una cantidad entre 0 y 100 unidades.' : 'Ingresa una cantidad entre 0 y 10.000 gramos o ml.');
  }
  if (!Number.isFinite(food.baseAmount) || food.baseAmount <= 0) throw new Error('El alimento no tiene una porción base válida.');
  const values = [food.kcal, food.protein, food.carbs, food.fat];
  if (values.some((value) => !Number.isFinite(value) || value < 0)) throw new Error('Los valores nutricionales del alimento no son válidos.');
  const ratio = amount / food.baseAmount;
  return { calories: food.kcal * ratio, protein: food.protein * ratio, carbs: food.carbs * ratio, fat: food.fat * ratio };
}

export function foodAmountUnit(food: FoodReferenceItem): string {
  return food.isUnit ? 'u.' : /ml/i.test(food.unitLabel) ? 'ml' : 'g';
}

export function validRecordDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && date.getFullYear() >= 1900 && date.getFullYear() <= 2100 &&
    date.getFullYear() === Number(value.slice(0, 4)) && date.getMonth() + 1 === Number(value.slice(5, 7)) && date.getDate() === Number(value.slice(8, 10));
}

export function validRecordTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
