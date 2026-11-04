import test from 'node:test';
import assert from 'node:assert/strict';
import { BASE_FOOD_DATABASE } from '../src/data/nutrition';
import { calculateFoodNutrition, foodAmountUnit, validRecordDate, validRecordTime } from '../src/services/nutritionMath';

test('calcula por gramos y conserva los decimales de los nutrientes', () => {
  const chicken = BASE_FOOD_DATABASE.find((f) => f.id === 'pollo_cocido')!;
  assert.deepEqual(calculateFoodNutrition(chicken, 200), { calories: 330, protein: 62, carbs: 0, fat: 7.2 });
});
test('calcula fracciones de unidades sin cambiar la porción', () => {
  const egg = BASE_FOOD_DATABASE.find((f) => f.id === 'huevo_entero')!;
  assert.equal(calculateFoodNutrition(egg, 1.5).calories, 111);
  assert.equal(foodAmountUnit(egg), 'u.');
  assert.equal(foodAmountUnit(BASE_FOOD_DATABASE.find((f) => f.id === 'leche_semi')!), 'ml');
});
test('rechaza cantidades inválidas y bases que producirían NaN o infinito', () => {
  const food = BASE_FOOD_DATABASE[0];
  for (const amount of [-1, 0, NaN, Infinity, 10001]) assert.throws(() => calculateFoodNutrition(food, amount));
  assert.throws(() => calculateFoodNutrition({ ...food, baseAmount: 0 }, 100));
  assert.throws(() => calculateFoodNutrition({ ...food, protein: -1 }, 100));
});
test('las fechas y horas corregidas deben ser válidas', () => {
  assert.equal(validRecordDate('2024-02-29'), true);
  assert.equal(validRecordDate('2025-02-29'), false);
  assert.equal(validRecordDate('2026-13-01'), false);
  assert.equal(validRecordTime('23:59'), true);
  assert.equal(validRecordTime('24:00'), false);
});
