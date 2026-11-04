export type ExerciseMode = 'strength' | 'cardio' | 'time';

export type CategoryName =
  | 'Cardio y Bici'
  | 'Pecho'
  | 'Espalda'
  | 'Piernas y Glúteos'
  | 'Hombros'
  | 'Bíceps y Tríceps'
  | 'Abdomen y Tiempo';

export type EquipmentType =
  | 'Máquina'
  | 'Polea'
  | 'Barra'
  | 'Mancuernas'
  | 'Peso Corporal'
  | 'Cardio / Bici'
  | 'Banda / Accesorio';

export type MuscleZone =
  | 'chest'
  | 'upper_chest'
  | 'lats'
  | 'mid_back'
  | 'lower_back'
  | 'traps'
  | 'front_delts'
  | 'side_delts'
  | 'rear_delts'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'adductors'
  | 'cardio_heart';

export interface ExerciseVisualInfo {
  name: string;
  category: CategoryName;
  mode: ExerciseMode;
  equipment: EquipmentType;
  primaryMuscles: MuscleZone[];
  secondaryMuscles: MuscleZone[];
  /** Local offline-bundled or remote real exercise photo URLs (Start position, End/Contraction position, etc.) */
  images: string[];
  /** Short machine/posture identifier to help find it in the gym */
  detectionHint: string;
  /** Step-by-step execution cues in Spanish */
  cues: string[];
  /** Common mistake to avoid */
  avoid?: string;
}

export interface WorkoutEntry {
  id: number;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  category: CategoryName | string;
  name: string;
  mode: ExerciseMode;
  notes?: string;
  // Strength
  sets?: number;
  reps?: number;
  weight?: number;
  setDetails?: { reps: number; weight: number }[];
  restSeconds?: number;
  sessionId?: string;
  sessionExerciseIndex?: number;
  // Cardio
  minutes?: number;
  distanceKm?: number;
  intensity?: string;
  // Isometric / Time
  seconds?: number;
}

export type MealSlot =
  | 'Desayuno'
  | 'Almuerzo'
  | 'Once / Merienda'
  | 'Cena'
  | 'Colación / Post-entreno';

export interface MealEntry {
  id: number;
  date: string;
  mealType: MealSlot | string;
  time: string;
  desc: string;
  calories: number;
  protein: number;
  carbs?: number;
  fat?: number;
}

export interface WaterEntry {
  id: number;
  date: string;
  time: string;
  ml: number;
  label: string;
}

export interface BodyMetricEntry {
  id: number;
  date: string;
  time: string;
  weightKg: number;
  bodyFatPct?: number;
  waistCm?: number;
  notes?: string;
}

export interface RoutineExerciseItem {
  category: CategoryName | string;
  name: string;
  mode: ExerciseMode;
  sets?: number;
  reps?: number;
  weight?: number;
  setDetails?: { reps: number; weight: number }[];
  restSeconds?: number;
  minutes?: number;
  distanceKm?: number;
  seconds?: number;
}

export interface SavedRoutine {
  id: string;
  title: string;
  subtitle: string;
  color: string;
  exercises: RoutineExerciseItem[];
}

export interface WorkoutSession {
  id: string;
  title: string;
  startedAt: string;
  finishedAt?: string;
  exercises: RoutineExerciseItem[];
  completedIds: number[];
}

export interface SavedMeal {
  id: string;
  mealType: string;
  desc: string;
  calories: number;
  protein: number;
  carbs?: number;
  fat?: number;
}

export interface DailyGoals {
  calories: number;
  proteinG: number;
  waterMl: number;
  targetWeightKg: number;
  weeklyWorkoutDays: number;
}

export type AlarmSoundType = 'bell' | 'digital' | 'zen' | 'siren' | 'pulse';

export interface PersistedChronoState {
  mode: 'countdown' | 'stopwatch' | 'hiit';
  running: boolean;
  /** Epoch timestamp (Date.now()) when current run started, adjusted for prior elapsed time */
  startedAtEpochMs: number | null;
  /** Accumulated ms when paused */
  accumulatedElapsedMs: number;
  /** Initial countdown target in ms (e.g., 90000 for 1:30) */
  initialSelectedMs: number;
  /** Stopwatch laps in ms */
  laps: number[];
  /** HIIT settings */
  hiitWorkSec: number;
  hiitRestSec: number;
  hiitTotalRounds: number;
  hiitCurrentRound: number;
  hiitPhase: 'work' | 'rest';
  /** Auto-start rest timer when logging a strength/time exercise */
  autoStartOnSet: boolean;
  /** Keep screen awake during workouts */
  keepScreenAwake: boolean;
}

export interface BitacoraDB {
  version: number;
  updatedAt: number;
  darkMode: boolean;
  alarmType: AlarmSoundType;
  goals: DailyGoals;
  workouts: WorkoutEntry[];
  meals: MealEntry[];
  waterLogs: WaterEntry[];
  bodyMetrics: BodyMetricEntry[];
  routines: SavedRoutine[];
  customCatalog: Record<string, string[]>;
  /** Custom user-captured photos per exercise name (array of dataURLs) */
  customExercisePhotos: Record<string, string[]>;
  /** Custom user foods added to nutrition calculator */
  customFoods: FoodReferenceItem[];
  favoriteExercises: string[];
  savedMeals: SavedMeal[];
  activeSession: WorkoutSession | null;
  workoutSessions: WorkoutSession[];
  chrono: PersistedChronoState;
}

export interface FoodReferenceItem {
  id: string;
  name: string;
  category: 'Proteínas' | 'Carbohidratos' | 'Lácteos y Huevos' | 'Grasas y Frutas' | 'Platos Preparados';
  unitLabel: string; // e.g. '100g' or '1 unidad (55g)' or '1 scoop (30g)'
  baseAmount: number; // e.g. 100 for 100g, or 1 for 1 unit
  isUnit: boolean;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export type ActiveTab = 'home' | 'exercises' | 'meals' | 'chrono' | 'progress' | 'export';
