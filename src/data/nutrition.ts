import { FoodReferenceItem } from '../types';

export interface QuickMealPreset {
  label: string;
  desc: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export const QUICK_MEAL_PRESETS: QuickMealPreset[] = [
  { label: 'Pollo con arroz', desc: 'Pechuga de pollo con arroz y ensalada', kcal: 520, protein: 42, carbs: 56, fat: 11 },
  { label: 'Huevos con palta', desc: '2 Huevos revueltos con pan y palta', kcal: 410, protein: 18, carbs: 34, fat: 22 },
  { label: 'Carne con papas', desc: 'Carne magra al sartén con papas cocidas', kcal: 540, protein: 40, carbs: 52, fat: 16 },
  { label: 'Atún con arroz', desc: 'Atún al agua con ensalada y arroz', kcal: 430, protein: 32, carbs: 50, fat: 8 },
  { label: 'Avena + Plátano', desc: 'Avena con leche, plátano y proteína', kcal: 450, protein: 30, carbs: 62, fat: 8 },
  { label: 'Yogurt proteico', desc: 'Yogurt proteico con fruta', kcal: 240, protein: 18, carbs: 28, fat: 4 },
  { label: 'Batido Proteína', desc: 'Batido Whey Protein en agua/leche', kcal: 140, protein: 25, carbs: 4, fat: 2 },
  { label: 'Fideos con carne', desc: 'Fideos con salsa boloñesa de carne molida', kcal: 580, protein: 32, carbs: 68, fat: 18 },
];

export const BASE_FOOD_DATABASE: FoodReferenceItem[] = [
  // Proteínas (por 100g cocido/listo o unidad)
  { id: 'pollo_cocido', name: 'Pechuga de pollo (cocida/plancha)', category: 'Proteínas', unitLabel: '100g', baseAmount: 100, isUnit: false, kcal: 165, protein: 31, carbs: 0, fat: 3.6 },
  { id: 'pollo_crudo', name: 'Pechuga de pollo (peso en crudo)', category: 'Proteínas', unitLabel: '100g', baseAmount: 100, isUnit: false, kcal: 120, protein: 22.5, carbs: 0, fat: 2.6 },
  { id: 'posta_magra', name: 'Carne vacuno magra (posta/lomo cocido)', category: 'Proteínas', unitLabel: '100g', baseAmount: 100, isUnit: false, kcal: 195, protein: 29, carbs: 0, fat: 8 },
  { id: 'carne_molida', name: 'Carne molida 5–7% grasa (cocida)', category: 'Proteínas', unitLabel: 100 + 'g', baseAmount: 100, isUnit: false, kcal: 182, protein: 26, carbs: 0, fat: 8 },
  { id: 'atun_lata', name: 'Atún al agua drenado (1 lata = 120g)', category: 'Proteínas', unitLabel: '100g', baseAmount: 100, isUnit: false, kcal: 116, protein: 26, carbs: 0, fat: 1 },
  { id: 'salmon', name: 'Salmón o trucha a la plancha', category: 'Proteínas', unitLabel: '100g', baseAmount: 100, isUnit: false, kcal: 208, protein: 22, carbs: 0, fat: 13 },
  { id: 'reineta_merluza', name: 'Reineta / Merluza a la plancha', category: 'Proteínas', unitLabel: '100g', baseAmount: 100, isUnit: false, kcal: 105, protein: 21, carbs: 0, fat: 2 },
  { id: 'pavo_jamon', name: 'Jamón de pavo cocido', category: 'Proteínas', unitLabel: '100g', baseAmount: 100, isUnit: false, kcal: 108, protein: 18, carbs: 3, fat: 2.5 },
  { id: 'lentejas_coc', name: 'Lentejas o porotos cocidos', category: 'Proteínas', unitLabel: '100g', baseAmount: 100, isUnit: false, kcal: 116, protein: 9, carbs: 20, fat: 0.4 },

  // Lácteos, Huevos y Suplementos
  { id: 'huevo_entero', name: 'Huevo entero grande', category: 'Lácteos y Huevos', unitLabel: '1 unidad', baseAmount: 1, isUnit: true, kcal: 74, protein: 6.3, carbs: 0.5, fat: 5 },
  { id: 'clara_huevo', name: 'Clara de huevo', category: 'Lácteos y Huevos', unitLabel: '1 unidad', baseAmount: 1, isUnit: true, kcal: 17, protein: 3.6, carbs: 0.2, fat: 0.1 },
  { id: 'whey_scoop', name: 'Scoop Proteína Whey (30g)', category: 'Lácteos y Huevos', unitLabel: '1 scoop', baseAmount: 1, isUnit: true, kcal: 120, protein: 24, carbs: 3, fat: 1.5 },
  { id: 'yogurt_protein', name: 'Yogurt Protein (1 pote 155g)', category: 'Lácteos y Huevos', unitLabel: '1 pote', baseAmount: 1, isUnit: true, kcal: 105, protein: 12, carbs: 10, fat: 1.8 },
  { id: 'leche_semi', name: 'Leche descremada / proteica (ml)', category: 'Lácteos y Huevos', unitLabel: '100ml', baseAmount: 100, isUnit: false, kcal: 42, protein: 4.5, carbs: 4.8, fat: 0.5 },
  { id: 'quesillo', name: 'Quesillo / Queso fresco magro', category: 'Lácteos y Huevos', unitLabel: '100g', baseAmount: 100, isUnit: false, kcal: 118, protein: 15, carbs: 3, fat: 5 },
  { id: 'queso_mantecoso', name: 'Queso laminado / gauda (1 lámina = 25g)', category: 'Lácteos y Huevos', unitLabel: '1 lámina', baseAmount: 1, isUnit: true, kcal: 88, protein: 6, carbs: 0.5, fat: 7 },

  // Carbohidratos
  { id: 'arroz_cocido', name: 'Arroz blanco o integral (cocido)', category: 'Carbohidratos', unitLabel: '100g', baseAmount: 100, isUnit: false, kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  { id: 'fideos_cocidos', name: 'Fideos / Pasta (peso cocido)', category: 'Carbohidratos', unitLabel: '100g', baseAmount: 100, isUnit: false, kcal: 155, protein: 5.5, carbs: 31, fat: 1 },
  { id: 'papa_cocida', name: 'Papa cocida o al horno', category: 'Carbohidratos', unitLabel: '100g', baseAmount: 100, isUnit: false, kcal: 87, protein: 2, carbs: 20, fat: 0.1 },
  { id: 'camote_cocido', name: 'Camote / Batata cocida', category: 'Carbohidratos', unitLabel: '100g', baseAmount: 100, isUnit: false, kcal: 90, protein: 2, carbs: 21, fat: 0.2 },
  { id: 'avena_cruda', name: 'Avena tradicional (en seco)', category: 'Carbohidratos', unitLabel: '100g', baseAmount: 100, isUnit: false, kcal: 375, protein: 13, carbs: 66, fat: 6.5 },
  { id: 'marraqueta_mitad', name: 'Pan Marraqueta (1 mitad / 2 dientes = 50g)', category: 'Carbohidratos', unitLabel: '1 mitad', baseAmount: 1, isUnit: true, kcal: 140, protein: 4.5, carbs: 29, fat: 0.6 },
  { id: 'pan_molde', name: 'Pan de molde integral (1 rebanada)', category: 'Carbohidratos', unitLabel: '1 reb.', baseAmount: 1, isUnit: true, kcal: 72, protein: 3.2, carbs: 12.5, fat: 1.1 },
  { id: 'fajita_tortilla', name: 'Tortilla / Rapidita mediana', category: 'Carbohidratos', unitLabel: '1 unidad', baseAmount: 1, isUnit: true, kcal: 125, protein: 3.5, carbs: 21, fat: 3 },

  // Grasas saludables, Frutas y Verduras
  { id: 'palta', name: 'Palta Hass (pulpa)', category: 'Grasas y Frutas', unitLabel: '100g', baseAmount: 100, isUnit: false, kcal: 160, protein: 2, carbs: 8.5, fat: 14.7 },
  { id: 'platano', name: 'Plátano mediano', category: 'Grasas y Frutas', unitLabel: '1 unidad', baseAmount: 1, isUnit: true, kcal: 105, protein: 1.3, carbs: 27, fat: 0.4 },
  { id: 'manzana', name: 'Manzana / Pera mediana', category: 'Grasas y Frutas', unitLabel: '1 unidad', baseAmount: 1, isUnit: true, kcal: 85, protein: 0.5, carbs: 22, fat: 0.2 },
  { id: 'mantequilla_mani', name: 'Mantequilla de maní (1 cda = 15g)', category: 'Grasas y Frutas', unitLabel: '1 cda', baseAmount: 1, isUnit: true, kcal: 94, protein: 4, carbs: 3, fat: 8 },
  { id: 'aceite_oliva', name: 'Aceite de oliva (1 cdta = 5ml)', category: 'Grasas y Frutas', unitLabel: '1 cdta', baseAmount: 1, isUnit: true, kcal: 45, protein: 0, carbs: 0, fat: 5 },
  { id: 'frutos_secos', name: 'Almendras / Nueces / Maní', category: 'Grasas y Frutas', unitLabel: '100g', baseAmount: 100, isUnit: false, kcal: 590, protein: 21, carbs: 18, fat: 51 },
  { id: 'ensalada_mixta', name: 'Ensalada verde mixta (lechuga, tomate, pepino)', category: 'Grasas y Frutas', unitLabel: '100g', baseAmount: 100, isUnit: false, kcal: 22, protein: 1.2, carbs: 4, fat: 0.2 },
];
