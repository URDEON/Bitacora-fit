import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calculator,
  Check,
  Copy,
  Droplets,
  Edit3,
  Plus,
  Scale,
  Trash2,
  Utensils,
  X,
} from 'lucide-react';
import { BitacoraDB, FoodReferenceItem, MealEntry, MealSlot, SavedMeal, WaterEntry } from '../types';
import { BASE_FOOD_DATABASE, QUICK_MEAL_PRESETS } from '../data/nutrition';
import { calculateFoodNutrition, foodAmountUnit, validRecordDate, validRecordTime } from '../services/nutritionMath';
import type { ViewBackController } from '../services/navigation';

interface MealsWaterViewProps {
  db: BitacoraDB;
  currentDate: string;
  onAddOrUpdateWater: (entry: Omit<WaterEntry, 'id'>, editingId: number | null) => void;
  onDeleteWater: (id: number) => void;
  onSaveMeal: (entry: Omit<MealEntry, 'id'>, editingId: number | null) => void;
  onDuplicateMeal: (entry: MealEntry) => void;
  onDeleteMeal: (id: number) => void;
  onAddCustomFood: (food: FoodReferenceItem) => void;
  onUpdateGoalsQuick: (kcal: number, proteinG: number, waterMl: number) => void;
  onSaveFrequentMeal: (meal: Omit<SavedMeal, 'id'>) => void;
  onDeleteFrequentMeal: (id: string) => void;
  registerBackController?: (controller: ViewBackController | null) => void;
}

const MEAL_SLOTS: MealSlot[] = [
  'Desayuno',
  'Almuerzo',
  'Once / Merienda',
  'Cena',
  'Colación / Post-entreno',
];

const PORTION_MULTIPLIERS = [
  { label: '0.5× Chica', val: 0.5 },
  { label: '0.75×', val: 0.75 },
  { label: '1× Normal', val: 1 },
  { label: '1.25×', val: 1.25 },
  { label: '1.5× Grande', val: 1.5 },
  { label: '2× Doble', val: 2 },
];

interface PlateBuilderItem {
  food: FoodReferenceItem;
  amount: number; // grams or units
}

export const MealsWaterView: React.FC<MealsWaterViewProps> = ({
  db,
  currentDate,
  onAddOrUpdateWater,
  onDeleteWater,
  onSaveMeal,
  onDuplicateMeal,
  onDeleteMeal,
  onAddCustomFood,
  onUpdateGoalsQuick,
  onSaveFrequentMeal,
  onDeleteFrequentMeal,
  registerBackController,
}) => {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const error = (name: string) => errors[name] ? <p id={`${name}-error`} className="field-error" role="alert">{errors[name]}</p> : null;
  const describedBy = (name: string) => errors[name] ? `${name}-error` : undefined;
  const [waterDate, setWaterDate] = useState(currentDate);
  const [waterTime, setWaterTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [mealDate, setMealDate] = useState(currentDate);
  const [mealTime, setMealTime] = useState(() => new Date().toTimeString().slice(0, 5));
  // Goals mini-editor toggle
  const [editingGoals, setEditingGoals] = useState(false);
  const [goalKcal, setGoalKcal] = useState(db.goals.calories);
  const [goalProt, setGoalProt] = useState(db.goals.proteinG);
  const [goalWater, setGoalWater] = useState(db.goals.waterMl);

  // Water state
  const [customWaterMl, setCustomWaterMl] = useState('');
  const [editingWaterId, setEditingWaterId] = useState<number | null>(null);
  const [editingWaterLabel, setEditingWaterLabel] = useState('Toma personalizada');
  const customWaterRef = useRef<HTMLInputElement>(null);

  // Meal state
  const [mealType, setMealType] = useState<MealSlot>('Desayuno');
  const [nutritionMode, setNutritionMode] = useState<'quick' | 'calc'>('quick');
  const [portionMult, setPortionMult] = useState(1);
  const [basePresetValues, setBasePresetValues] = useState<{ kcal: number; prot: number; carbs: number; fat: number } | null>(null);

  const [editingMealId, setEditingMealId] = useState<number | null>(null);
  const [mealDesc, setMealDesc] = useState('');
  const [mealKcal, setMealKcal] = useState('');
  const [mealProt, setMealProt] = useState('');
  const [mealCarbs, setMealCarbs] = useState('');
  const [mealFat, setMealFat] = useState('');

  // Smart Gram Calculator state
  const allFoods = useMemo(() => [...db.customFoods, ...BASE_FOOD_DATABASE], [db.customFoods]);
  const [selectedFoodId, setSelectedFoodId] = useState<string>(BASE_FOOD_DATABASE[0].id);
  const [foodAmountInput, setFoodAmountInput] = useState<string>('150');
  const [plateItems, setPlateItems] = useState<PlateBuilderItem[]>([]);
  const [showNewFoodForm, setShowNewFoodForm] = useState(false);
  const [newFoodName, setNewFoodName] = useState('');
  const [newFoodKcal100, setNewFoodKcal100] = useState('');
  const [newFoodProt100, setNewFoodProt100] = useState('');
  const [newFoodCarbs100, setNewFoodCarbs100] = useState('');
  const [newFoodFat100, setNewFoodFat100] = useState('');

  useEffect(() => {
    if (editingMealId === null) setMealDate(currentDate);
    if (editingWaterId === null) setWaterDate(currentDate);
  }, [currentDate]);

  const dateLabel = new Date(`${currentDate}T12:00:00`).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });

  const selectedFood = useMemo(
    () => allFoods.find((f) => f.id === selectedFoodId) || allFoods[0],
    [allFoods, selectedFoodId]
  );

  // Totals for active date
  const dayMeals = useMemo(() => db.meals.filter((m) => m.date === currentDate), [db.meals, currentDate]);
  const dayWater = useMemo(() => db.waterLogs.filter((w) => w.date === currentDate), [db.waterLogs, currentDate]);

  const totalKcal = dayMeals.reduce((s, m) => s + (Number(m.calories) || 0), 0);
  const totalProt = dayMeals.reduce((s, m) => s + (Number(m.protein) || 0), 0);
  const totalCarbs = dayMeals.reduce((s, m) => s + (m.carbs || 0), 0);
  const totalFat = dayMeals.reduce((s, m) => s + (m.fat || 0), 0);
  const totalWaterMl = dayWater.reduce((s, w) => s + (Number(w.ml) || 0), 0);

  const kcalPct = Math.min(100, Math.round((totalKcal / Math.max(1, db.goals.calories)) * 100));
  const protPct = Math.min(100, Math.round((totalProt / Math.max(1, db.goals.proteinG)) * 100));
  const waterPct = Math.min(100, Math.round((totalWaterMl / Math.max(1, db.goals.waterMl)) * 100));

  const getCurrentHHMM = () => new Date().toTimeString().slice(0, 5);

  const backStateRef = useRef({ showNewFoodForm, editingGoals, editingMealId, editingWaterId, currentDate });
  backStateRef.current = { showNewFoodForm, editingGoals, editingMealId, editingWaterId, currentDate };

  useEffect(() => {
    if (!registerBackController) return;
    registerBackController({
      hasActiveEditor: () => {
        const s = backStateRef.current;
        return Boolean(s.showNewFoodForm || s.editingGoals || s.editingMealId !== null || s.editingWaterId !== null);
      },
      closeEditor: () => {
        const s = backStateRef.current;
        if (s.showNewFoodForm) {
          setShowNewFoodForm(false);
          return true;
        }
        if (s.editingGoals) {
          setEditingGoals(false);
          return true;
        }
        if (s.editingMealId !== null) {
          setEditingMealId(null);
          setMealDesc('');
          setMealKcal('');
          setMealProt('');
          setMealCarbs('');
          setMealFat('');
          setPlateItems([]);
          setBasePresetValues(null);
          setMealDate(s.currentDate);
          setMealTime(new Date().toTimeString().slice(0, 5));
          setErrors({});
          return true;
        }
        if (s.editingWaterId !== null) {
          setEditingWaterId(null);
          setCustomWaterMl('');
          setWaterDate(s.currentDate);
          setWaterTime(new Date().toTimeString().slice(0, 5));
          setErrors({});
          return true;
        }
        return false;
      },
      hasActiveSubview: () => false,
      leaveSubview: () => false,
    });
    return () => registerBackController(null);
  }, [registerBackController]);

  // Lleva al formulario real de comida (descontando la cabecera fija) en lugar de una posición fija.
  const mealFormRef = useRef<HTMLDivElement>(null);
  const scrollToMealForm = () => {
    const target = mealFormRef.current;
    if (!target) return;
    const header = document.querySelector<HTMLElement>('.app-header');
    const top = target.getBoundingClientRect().top + window.scrollY - (header?.offsetHeight ?? 0) - 8;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  };

  const quickWater = (ml: number, label: string) => {
    onAddOrUpdateWater(
      { date: currentDate, time: getCurrentHHMM(), ml, label },
      null
    );
  };

  const handleSaveCustomWater = () => {
    const ml = Number(customWaterMl);
    const nextErrors: Record<string, string> = {};
    if (!customWaterMl.trim() || !Number.isFinite(ml) || !Number.isInteger(ml) || ml < 1 || ml > 5000) nextErrors.water = 'Ingresa una cantidad entera entre 1 y 5.000 ml.';
    if (!validRecordDate(waterDate)) nextErrors.waterDate = 'Selecciona una fecha válida.';
    if (!validRecordTime(waterTime)) nextErrors.waterTime = 'Selecciona una hora válida.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    onAddOrUpdateWater(
      {
        date: waterDate,
        time: waterTime,
        ml,
        label: editingWaterId ? editingWaterLabel : 'Toma personalizada',
      },
      editingWaterId
    );
    setCustomWaterMl('');
    setEditingWaterId(null);
    setWaterDate(currentDate);
    setWaterTime(getCurrentHHMM());
  };

  const applyQuickPreset = (
    desc: string,
    kcal: number,
    prot: number,
    carbs: number,
    fat: number,
    mult = portionMult
  ) => {
    setBasePresetValues({ kcal, prot, carbs, fat });
    const suffix = mult !== 1 ? ` (${mult}× porción)` : '';
    setMealDesc(desc + suffix);
    setMealKcal(String(Math.round(kcal * mult)));
    setMealProt(String(Math.round(prot * mult)));
    setMealCarbs(String(Math.round(carbs * mult)));
    setMealFat(String(Math.round(fat * mult)));
  };

  const handlePortionChange = (mult: number) => {
    setPortionMult(mult);
    if (basePresetValues) {
      const cleanDesc = mealDesc.replace(/\s*\([\d.]+× porción\)$/, '');
      setMealDesc(mult !== 1 ? `${cleanDesc} (${mult}× porción)` : cleanDesc);
      setMealKcal(String(Math.round(basePresetValues.kcal * mult)));
      setMealProt(String(Math.round(basePresetValues.prot * mult)));
      setMealCarbs(String(Math.round(basePresetValues.carbs * mult)));
      setMealFat(String(Math.round(basePresetValues.fat * mult)));
    }
  };

  // Add ingredient to automatic plate calculator
  const addIngredientToPlate = () => {
    try {
      const amt = Number(foodAmountInput);
      calculateFoodNutrition(selectedFood, amt);
      setErrors({});
      setBasePresetValues(null);
      syncPlateToInputs([...plateItems, { food: selectedFood, amount: amt }]);
    } catch (cause) { setErrors({ amount: cause instanceof Error ? cause.message : 'Revisa la cantidad.' }); }
  };

  const removePlateIngredient = (idx: number) => {
    const next = plateItems.filter((_, i) => i !== idx);
    syncPlateToInputs(next);
  };

  const syncPlateToInputs = (items: PlateBuilderItem[]) => {
    setPlateItems(items);
    if (items.length === 0) {
      setMealDesc('');
      setMealKcal('');
      setMealProt('');
      setMealCarbs('');
      setMealFat('');
      return;
    }
    let k = 0;
    let p = 0;
    let c = 0;
    let f = 0;
    const parts: string[] = [];
    items.forEach(({ food, amount }) => {
      const nutrition = calculateFoodNutrition(food, amount);
      k += nutrition.calories;
      p += nutrition.protein;
      c += nutrition.carbs;
      f += nutrition.fat;
      parts.push(`${amount} ${foodAmountUnit(food)} ${food.name.split(' (')[0]}`);
    });
    setMealDesc(parts.join(' + '));
    setMealKcal(String(Math.round(k)));
    setMealProt(String(Number(p.toFixed(1))));
    setMealCarbs(String(Number(c.toFixed(1))));
    setMealFat(String(Number(f.toFixed(1))));
  };

  const readMeal = (): Omit<MealEntry, 'id'> | null => {
    const clean = mealDesc.trim();
    const nextErrors: Record<string, string> = {};
    if (!clean || clean.length > 2000) nextErrors.mealDesc = 'Describe la comida en un máximo de 2.000 caracteres.';
    const values = { mealKcal: [mealKcal, 20000], mealProt: [mealProt, 2000], mealCarbs: [mealCarbs, 3000], mealFat: [mealFat, 2000] } as const;
    Object.entries(values).forEach(([key, [value, max]]) => {
      if ((key === 'mealKcal' || key === 'mealProt') && !value.trim() || !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > max) nextErrors[key] = `Ingresa un valor entre 0 y ${max.toLocaleString('es')}.`;
    });
    if (!validRecordDate(mealDate)) nextErrors.mealDate = 'Selecciona una fecha válida.';
    if (!validRecordTime(mealTime)) nextErrors.mealTime = 'Selecciona una hora válida.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return null;
    return {
        date: mealDate,
        mealType,
        time: mealTime,
        desc: clean,
        calories: Number(mealKcal),
        protein: Number(mealProt),
        carbs: Number(mealCarbs),
        fat: Number(mealFat),
      };
  };

  const handleSaveMeal = () => {
    const meal = readMeal();
    if (!meal) return;
    onSaveMeal(meal, editingMealId);
    setEditingMealId(null);
    setMealDesc('');
    setMealKcal('');
    setMealProt('');
    setMealCarbs('');
    setMealFat('');
    setPlateItems([]);
    setBasePresetValues(null);
    setMealDate(currentDate);
    setMealTime(getCurrentHHMM());
  };

  return (
    <div className="fade-view">
      {/* RESUMEN DIARIO DE ENERGÍA, MACRONUTRIENTES Y METAS */}
      <section className="card-soft" aria-labelledby="nutrition-goals-title">
        <div className="block-head">
          <div>
            <h2 id="nutrition-goals-title" className="block-title">
              Balance nutricional del día
            </h2>
            <p className="block-subtitle">
              Seguimiento frente a tus objetivos personales
            </p>
          </div>
          <button
            type="button"
            className="pill-action"
            onClick={() => {
              setGoalKcal(db.goals.calories);
              setGoalProt(db.goals.proteinG);
              setGoalWater(db.goals.waterMl);
              setEditingGoals((v) => !v);
            }}
          >
            <Edit3 size={14} /> {editingGoals ? 'Cerrar' : 'Ajustar metas'}
          </button>
        </div>

        {editingGoals && (
          <div className="goals-inline-editor">
            <div className="grid-3">
              <div>
                <label className="lbl" htmlFor="nutrition-goal-kcal">Meta de calorías</label>
                <input
                  id="nutrition-goal-kcal"
                  aria-label="Meta diaria de calorías"
                  min="1"
                  max="20000"
                  type="number"
                  className="input-clean"
                  value={goalKcal}
                  onChange={(e) => setGoalKcal(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="lbl" htmlFor="nutrition-goal-protein">Proteína (g)</label>
                <input
                  id="nutrition-goal-protein"
                  aria-label="Meta diaria de proteína en gramos"
                  min="1"
                  max="1000"
                  type="number"
                  className="input-clean"
                  value={goalProt}
                  onChange={(e) => setGoalProt(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="lbl" htmlFor="nutrition-goal-water">Agua (ml)</label>
                <input
                  id="nutrition-goal-water"
                  aria-label="Meta diaria de agua en mililitros"
                  min="1"
                  max="15000"
                  type="number"
                  className="input-clean"
                  value={goalWater}
                  onChange={(e) => setGoalWater(Number(e.target.value))}
                />
              </div>
            </div>
            <button
              type="button"
              className="btn-main green"
              onClick={() => {
                if (![goalKcal, goalProt, goalWater].every(Number.isFinite) || goalKcal < 1 || goalKcal > 20000 || goalProt < 1 || goalProt > 1000 || goalWater < 1 || goalWater > 15000) {
                  setErrors({ goals: 'Revisa tus metas: calorías 1–20.000, proteína 1–1.000 g y agua 1–15.000 ml.' });
                  return;
                }
                setErrors({});
                onUpdateGoalsQuick(goalKcal, goalProt, goalWater);
                setEditingGoals(false);
              }}
            >
              Guardar objetivos diarios
            </button>
            {error('goals')}
          </div>
        )}

        <div className="macro-overview-grid">
          <div className="macro-tile">
            <div className="macro-tile-head">
              <strong style={{ color: 'var(--accent-green)' }}>Calorías</strong>
              <span className="mono-num">
                {Number(totalKcal.toFixed(1))} / {db.goals.calories} kcal
              </span>
            </div>
            <div className="water-bar-bg">
              <div
                className="water-bar-fill"
                style={{ width: `${kcalPct}%`, background: 'var(--accent-green)' }}
              />
            </div>
          </div>

          <div className="macro-tile">
            <div className="macro-tile-head">
              <strong style={{ color: 'var(--accent)' }}>Proteína</strong>
              <span className="mono-num">
                {Number(totalProt.toFixed(1))} / {db.goals.proteinG} g
              </span>
            </div>
            <div className="water-bar-bg">
              <div
                className="water-bar-fill"
                style={{ width: `${protPct}%`, background: 'var(--accent)' }}
              />
            </div>
          </div>
        </div>

        <div className="macro-secondary-strip">
          <span>
            Carbohidratos: <strong>{Number(totalCarbs.toFixed(1))} g</strong>
          </span>
          <span>
            Grasas: <strong>{Number(totalFat.toFixed(1))} g</strong>
          </span>
          <span>
            Hidratación: <strong>{(totalWaterMl / 1000).toFixed(2)} L</strong> ({waterPct}%)
          </span>
        </div>
      </section>

      {/* HIDRATACIÓN POR TOMAS SEPARADAS */}
      <section className="card-cut" aria-labelledby="water-section-title">
        <div className="block-head">
          <div>
            <h2 id="water-section-title" className="block-title" style={{ color: 'var(--accent-blue)' }}>
              <Droplets size={18} />
              Hidratación por tomas
            </h2>
            <p className="block-subtitle">
              Registra vasos o botellas con su hora exacta; puedes editar o borrar cualquier toma.
            </p>
          </div>
        </div>

        <div className="water-progress-wrap">
          <div className="macro-tile-head">
            <span className="mono-num" style={{ color: 'var(--accent-blue)' }}>
              Total: {totalWaterMl} ml ({(totalWaterMl / 1000).toFixed(2)} L)
            </span>
            <span className="text-thin">Meta: {db.goals.waterMl} ml ({waterPct}%)</span>
          </div>
          <div className="water-bar-bg">
            <div className="water-bar-fill" style={{ width: `${waterPct}%` }} />
          </div>
        </div>

        <div className="lbl"><span>Toma rápida con un toque</span></div>
        <div className="water-quick-grid">
          <button type="button" className="water-add-btn" onClick={() => quickWater(200, 'Vaso chico')}>
            +200 ml <span>Vaso chico</span>
          </button>
          <button type="button" className="water-add-btn" onClick={() => quickWater(250, 'Vaso estándar')}>
            +250 ml <span>1 Vaso</span>
          </button>
          <button type="button" className="water-add-btn" onClick={() => quickWater(500, 'Botella 500ml')}>
            +500 ml <span>Botella</span>
          </button>
          <button type="button" className="water-add-btn" onClick={() => quickWater(750, 'Shaker gym')}>
            +750 ml <span>Shaker gym</span>
          </button>
          <button type="button" className="water-add-btn" onClick={() => quickWater(1000, 'Botella 1 Litro')}>
            +1000 ml <span>1 Litro</span>
          </button>
          <button
            type="button"
            className="water-add-btn"
            onClick={() => customWaterRef.current?.focus()}
          >
            Otro ml <span>Personalizado</span>
          </button>
        </div>

        <label className="lbl" htmlFor="custom-water">Cantidad personalizada de agua (ml)</label>
        <div className="inline-input-row">
          <input
            id="custom-water"
            aria-label="Cantidad de agua en mililitros"
            min="1"
            max="5000"
            step="1"
            aria-invalid={!!errors.water}
            aria-describedby={describedBy('water')}
            ref={customWaterRef}
            type="number"
            className="input-clean"
            placeholder={editingWaterId ? 'Editar cantidad en ml…' : 'Ej. 350, 600…'}
            value={customWaterMl}
            onChange={(e) => setCustomWaterMl(e.target.value)}
          />
          <button
            type="button"
            className={`btn-main ${editingWaterId ? 'amber' : 'blue'}`}
            onClick={handleSaveCustomWater}
          >
            {editingWaterId ? 'Actualizar' : '+ Guardar ml'}
          </button>
        </div>

        {error('water')}
        <div className="grid-2">
          <div>
            <label className="lbl" htmlFor="water-date">Fecha de la toma</label>
            <input id="water-date" type="date" className="input-clean" value={waterDate} onChange={(e) => setWaterDate(e.target.value)} aria-invalid={!!errors.waterDate} aria-describedby={describedBy('waterDate')} />
            {error('waterDate')}
          </div>
          <div>
            <label className="lbl" htmlFor="water-time">Hora de la toma</label>
            <input id="water-time" type="time" className="input-clean" value={waterTime} onChange={(e) => setWaterTime(e.target.value)} aria-invalid={!!errors.waterTime} aria-describedby={describedBy('waterTime')} />
            {error('waterTime')}
          </div>
        </div>
        {editingWaterId !== null && (
          <button
            type="button"
            className="pill-action"
            onClick={() => {
              setEditingWaterId(null);
              setCustomWaterMl('');
              setWaterDate(currentDate);
              setWaterTime(getCurrentHHMM());
              setErrors({});
            }}
          >
            <X size={14} /> Cancelar edición de agua
          </button>
        )}

        <div className="lbl"><span>Tomas de agua del {dateLabel}</span></div>
        {dayWater.length === 0 ? (
          <p className="empty-inline">
            Aún no has guardado tomas de agua en esta fecha.
          </p>
        ) : (
          dayWater.map((w) => (
            <div key={w.id} className="ticket-row water">
              <div className="ticket-body">
                <span className="ticket-kicker water-tone">
                  {w.time} hrs · {w.label}
                </span>
                <div className="ticket-title">
                  +{w.ml} ml de agua
                </div>
              </div>
              <div className="row-actions">
                <button
                  type="button"
                  className="icon-btn"
                  title="Editar ml"
                  onClick={() => {
                    setEditingWaterId(w.id);
                    setEditingWaterLabel(w.label);
                    setCustomWaterMl(String(w.ml));
                    setWaterDate(w.date);
                    setWaterTime(w.time);
                    setErrors({});
                    customWaterRef.current?.focus();
                  }}
                >
                  <Edit3 size={15} />
                </button>
                <button
                  type="button"
                  className="icon-btn danger"
                  title="Eliminar toma"
                  onClick={() => onDeleteWater(w.id)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))
        )}
      </section>

      {/* REGISTRO NUTRICIONAL CON CALCULADORA AUTOMÁTICA POR GRAMOS Y PORCIONES */}
      <div ref={mealFormRef} aria-hidden="true" />
      <section className="card-soft" aria-labelledby="meal-form-title">
        <div className="block-head">
          <div>
            <h2 id="meal-form-title" className="block-title">
              {editingMealId ? (
                <>
                  <Edit3 size={17} /> Editando comida
                </>
              ) : (
                <>
                  <Utensils size={17} /> Anotar comida del día
                </>
              )}
            </h2>
            <p className="block-subtitle">
              Usa porciones frecuentes o calcula por <strong>gramos y unidades</strong>. Valores estimados según preparación.
            </p>
          </div>
          {editingMealId && (
            <button
              type="button"
              className="pill-action"
              onClick={() => {
                setEditingMealId(null);
                setMealDesc('');
                setMealKcal('');
                setMealProt('');
                setMealCarbs('');
                setMealFat('');
                setPlateItems([]);
                setBasePresetValues(null);
                setMealDate(currentDate);
                setMealTime(getCurrentHHMM());
                setErrors({});
              }}
            >
              <X size={14} /> Cancelar
            </button>
          )}
        </div>

        <div className="lbl"><span>1. Momento del día</span></div>
        <div className="cat-scroll">
          {MEAL_SLOTS.map((slot) => (
            <button
              key={slot}
              type="button"
              className={`cat-pill ${mealType === slot ? 'active' : ''}`}
              aria-pressed={mealType === slot}
              onClick={() => setMealType(slot)}
            >
              {slot}
            </button>
          ))}
        </div>

        <div className="mode-switcher">
          <button
            type="button"
            className={`mode-card green-mode ${nutritionMode === 'quick' ? 'active' : ''}`}
            aria-pressed={nutritionMode === 'quick'}
            onClick={() => setNutritionMode('quick')}
          >
            <span className="m-title">
              <Utensils size={14} /> Platos frecuentes
            </span>
            <span className="m-sub">Con multiplicador de porción</span>
          </button>
          <button
            type="button"
            className={`mode-card ${nutritionMode === 'calc' ? 'active' : ''}`}
            aria-pressed={nutritionMode === 'calc'}
            onClick={() => setNutritionMode('calc')}
          >
            <span className="m-title">
              <Calculator size={14} /> Calcular por gramos
            </span>
            <span className="m-sub">Estimación según cantidad</span>
          </button>
        </div>

        {nutritionMode === 'quick' ? (
          <>
            {db.savedMeals.length > 0 && (
              <div className="frequent-meals-box">
                <div className="lbl"><span>Tus comidas frecuentes</span></div>
                {db.savedMeals.map((meal) => (
                  <div key={meal.id} className="frequent-meal-row">
                    <button
                      type="button"
                      className="mini-chip"
                      onClick={() => {
                        setMealType(meal.mealType as MealSlot);
                        applyQuickPreset(meal.desc, meal.calories, meal.protein, meal.carbs || 0, meal.fat || 0);
                      }}
                    >
                      {meal.desc}
                    </button>
                    <button
                      type="button"
                      className="icon-btn danger"
                      aria-label={`Eliminar comida frecuente ${meal.desc}`}
                      onClick={() => onDeleteFrequentMeal(meal.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="lbl"><span>2. Tamaño de tu porción</span></div>
            <div className="preset-row">
              {PORTION_MULTIPLIERS.map((pm) => (
                <button
                  key={pm.val}
                  type="button"
                  className={`mini-chip ${portionMult === pm.val ? 'active' : ''}`}
                  aria-pressed={portionMult === pm.val}
                  onClick={() => handlePortionChange(pm.val)}
                >
                  {pm.label}
                </button>
              ))}
            </div>

            <div className="lbl"><span>3. Platos rápidos de referencia</span></div>
            <div className="preset-row">
              {QUICK_MEAL_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="mini-chip"
                  onClick={() => applyQuickPreset(p.desc, p.kcal, p.protein, p.carbs, p.fat)}
                >
                  {p.label} ({Math.round(p.kcal * portionMult)} kcal)
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="plate-builder">
            <div className="lbl">
              <span>
                <Scale size={14} /> Armador de plato por gramos / unidades
              </span>
              <button
                type="button"
                className="text-button"
                onClick={() => setShowNewFoodForm((v) => !v)}
              >
                {showNewFoodForm ? 'Cerrar' : '+ Nuevo alimento'}
              </button>
            </div>

            {showNewFoodForm && (
              <div className="new-food-box">
                <label className="lbl" htmlFor="new-food-name">Nombre del alimento (por 100 g)</label>
                <input id="new-food-name" type="text" className="input-clean" value={newFoodName} onChange={(e) => setNewFoodName(e.target.value)} maxLength={200} aria-invalid={!!errors.newFoodName} aria-describedby={describedBy('newFoodName')} />
                {error('newFoodName')}
                <div className="grid-2">
                  {[
                    { id: 'newFoodKcal', label: 'Calorías / 100 g', value: newFoodKcal100, set: setNewFoodKcal100, max: 1000 },
                    { id: 'newFoodProt', label: 'Proteína g / 100 g', value: newFoodProt100, set: setNewFoodProt100, max: 100 },
                    { id: 'newFoodCarbs', label: 'Carbohidratos g / 100 g', value: newFoodCarbs100, set: setNewFoodCarbs100, max: 100 },
                    { id: 'newFoodFat', label: 'Grasas g / 100 g', value: newFoodFat100, set: setNewFoodFat100, max: 100 },
                  ].map((field) => (
                    <div key={field.id}>
                      <label className="lbl" htmlFor={field.id}>{field.label}</label>
                      <input id={field.id} type="number" min="0" max={field.max} step="any" className="input-clean" value={field.value} onChange={(e) => field.set(e.target.value)} aria-invalid={!!errors[field.id]} aria-describedby={describedBy(field.id)} />
                      {error(field.id)}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn-main green"
                  onClick={() => {
                    const nextErrors: Record<string, string> = {};
                    if (!newFoodName.trim() || newFoodName.trim().length > 200) nextErrors.newFoodName = 'Ingresa un nombre de hasta 200 caracteres.';
                    const fields = { newFoodKcal: [newFoodKcal100, 1000], newFoodProt: [newFoodProt100, 100], newFoodCarbs: [newFoodCarbs100, 100], newFoodFat: [newFoodFat100, 100] } as const;
                    Object.entries(fields).forEach(([key, [value, max]]) => { if (!value.trim() || !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > max) nextErrors[key] = `Ingresa un valor entre 0 y ${max}.`; });
                    setErrors(nextErrors);
                    if (Object.keys(nextErrors).length) return;
                    const id = 'custom_' + crypto.randomUUID();
                    onAddCustomFood({ id, name: newFoodName.trim(), category: 'Platos Preparados', unitLabel: '100g', baseAmount: 100, isUnit: false, kcal: Number(newFoodKcal100), protein: Number(newFoodProt100), carbs: Number(newFoodCarbs100), fat: Number(newFoodFat100) });
                    setSelectedFoodId(id);
                    setNewFoodName(''); setNewFoodKcal100(''); setNewFoodProt100(''); setNewFoodCarbs100(''); setNewFoodFat100(''); setShowNewFoodForm(false);
                  }}
                >
                  Crear alimento
                </button>
              </div>
            )}

            <label className="lbl" htmlFor="food-selector">Alimento de la tabla</label>
            <select
              id="food-selector"
              className="select-clean"
              value={selectedFoodId}
              onChange={(e) => {
                const f = allFoods.find((x) => x.id === e.target.value);
                setSelectedFoodId(e.target.value);
                if (f) setFoodAmountInput(f.isUnit ? '2' : '150');
              }}
            >
              {allFoods.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} — ({f.kcal} kcal, {f.protein}g prot / {f.unitLabel})
                </option>
              ))}
            </select>

            <label className="lbl" htmlFor="food-amount">Cantidad ({foodAmountUnit(selectedFood)})</label>
            <div className="inline-input-row">
              <input
                id="food-amount"
                min="0.01"
                max={selectedFood.isUnit ? 100 : 10000}
                step="any"
                aria-invalid={!!errors.amount}
                aria-describedby={describedBy('amount')}
                type="number"
                className="input-clean"
                placeholder={selectedFood.isUnit ? 'Cantidad (unidades)…' : 'Gramos o ml (ej. 180)…'}
                value={foodAmountInput}
                onChange={(e) => setFoodAmountInput(e.target.value)}
              />
              <button
                type="button"
                className="btn-main"
                onClick={addIngredientToPlate}
              >
                + Sumar al plato
              </button>
            </div>

            {error('amount')}
            {plateItems.length > 0 && (
              <div className="plate-list">
                {plateItems.map((it, idx) => {
                  const ratio = it.amount / it.food.baseAmount;
                  return (
                    <div key={idx} className="plate-item-row">
                      <span>
                        <strong>
                          {it.amount} {foodAmountUnit(it.food)}
                        </strong>{' '}
                        {it.food.name.split(' (')[0]} ({Math.round(it.food.kcal * ratio)} kcal ·{' '}
                        {Math.round(it.food.protein * ratio)}g P)
                      </span>
                      <button
                        type="button"
                        className="plate-remove-btn"
                        aria-label={`Quitar ${it.food.name} del plato`}
                        onClick={() => removePlateIngredient(idx)}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="grid-2">
          <div>
            <label className="lbl" htmlFor="meal-date">Fecha de la comida</label>
            <input id="meal-date" type="date" className="input-clean" value={mealDate} onChange={(e) => setMealDate(e.target.value)} aria-invalid={!!errors.mealDate} aria-describedby={describedBy('mealDate')} />
            {error('mealDate')}
          </div>
          <div>
            <label className="lbl" htmlFor="meal-time">Hora de la comida</label>
            <input id="meal-time" type="time" className="input-clean" value={mealTime} onChange={(e) => setMealTime(e.target.value)} aria-invalid={!!errors.mealTime} aria-describedby={describedBy('mealTime')} />
            {error('mealTime')}
          </div>
        </div>
        <label className="lbl" htmlFor="meal-description">Descripción de la comida</label>
        <input id="meal-description" type="text" className="input-clean" placeholder="Ej. 200 g de pollo con 180 g de arroz" maxLength={2000} value={mealDesc} onChange={(e) => { setMealDesc(e.target.value); setBasePresetValues(null); }} aria-invalid={!!errors.mealDesc} aria-describedby={describedBy('mealDesc')} />
        {error('mealDesc')}
        <div className="grid-2">
          {[
            { id: 'mealKcal', label: 'Calorías (kcal)', value: mealKcal, set: setMealKcal, max: 20000 },
            { id: 'mealProt', label: 'Proteína (g)', value: mealProt, set: setMealProt, max: 2000 },
            { id: 'mealCarbs', label: 'Carbohidratos (g, opcional)', value: mealCarbs, set: setMealCarbs, max: 3000 },
            { id: 'mealFat', label: 'Grasas (g, opcional)', value: mealFat, set: setMealFat, max: 2000 },
          ].map((field) => (
            <div key={field.id}>
              <label className="lbl" htmlFor={field.id}>{field.label}</label>
              <input id={field.id} type="number" min="0" max={field.max} step="any" className="input-clean" value={field.value} onChange={(e) => { field.set(e.target.value); setBasePresetValues(null); }} aria-invalid={!!errors[field.id]} aria-describedby={describedBy(field.id)} />
              {error(field.id)}
            </div>
          ))}
        </div>
        <button
          type="button"
          className="pill-action"
          onClick={() => {
            const meal = readMeal();
            if (!meal) return;
            const { date, time, ...frequent } = meal;
            onSaveFrequentMeal(frequent);
          }}
        >
          Guardar como comida frecuente
        </button>

        <button
          type="button"
          className={`btn-main ${editingMealId ? 'amber' : 'green'}`}
          onClick={handleSaveMeal}
        >
          {editingMealId ? (
            <>
              <Check size={17} /> Actualizar comida
            </>
          ) : (
            <>
              <Plus size={17} /> Guardar comida del día
            </>
          )}
        </button>
      </section>

      {/* LISTA DE COMIDAS DEL DÍA */}
      <section className="card-cut" aria-labelledby="meals-list-title">
        <div className="block-head">
          <div>
            <h3 id="meals-list-title" className="block-title">
              Comidas del {dateLabel}
            </h3>
            <p className="block-subtitle">
              {Number(totalKcal.toFixed(1))} kcal · {Number(totalProt.toFixed(1))} g proteína · {Number(totalCarbs.toFixed(1))} g C · {Number(totalFat.toFixed(1))} g G
            </p>
          </div>
        </div>

        {dayMeals.length === 0 ? (
          <p className="empty-inline">
            No hay comidas registradas en esta fecha.
          </p>
        ) : (
          dayMeals.map((m) => (
            <div key={m.id} className="ticket-row meal">
              <div className="ticket-body">
                <span className="ticket-kicker meal-tone">
                  {m.mealType} {m.time ? `· ${m.time}` : ''}
                </span>
                <div className="ticket-title">
                  {m.desc}
                </div>
                <div className="ticket-meta">
                  <strong>{m.calories || 0} kcal</strong> · <strong>{m.protein || 0} g proteína</strong>
                  {m.carbs ? ` · ${m.carbs} g C` : ''}
                  {m.fat ? ` · ${m.fat} g G` : ''}
                </div>
              </div>
              <div className="row-actions">
                <button
                  type="button"
                  className="icon-btn"
                  title="Editar comida"
                  onClick={() => {
                    setEditingMealId(m.id);
                    setMealType(m.mealType as MealSlot);
                    setMealDesc(m.desc);
                    setMealKcal(String(m.calories));
                    setMealProt(String(m.protein));
                    setMealCarbs(String(m.carbs || ''));
                    setMealFat(String(m.fat ?? ''));
                    setMealDate(m.date);
                    setMealTime(m.time);
                    setBasePresetValues(null);
                    setPlateItems([]);
                    setErrors({});
                    scrollToMealForm();
                  }}
                >
                  <Edit3 size={15} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title="Duplicar comida"
                  onClick={() => onDuplicateMeal(m)}
                >
                  <Copy size={15} />
                </button>
                <button
                  type="button"
                  className="icon-btn danger"
                  title="Eliminar comida"
                  onClick={() => onDeleteMeal(m.id)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
};
