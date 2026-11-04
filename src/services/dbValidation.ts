import type { BitacoraDB } from '../types';

const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
function fail(path: string): never { throw new Error(`El respaldo contiene un valor inválido en «${path}». No se ha modificado ningún dato.`); }
const number = (v: unknown, path: string, min = 0, max = 1e9, optional = false) => {
  if (optional && v === undefined) return;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) fail(path);
};
const text = (v: unknown, path: string, optional = false, max = 20000) => {
  if (optional && v === undefined) return;
  if (typeof v !== 'string' || v.length > max) fail(path);
};
const date = (v: unknown, path: string) => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || (!Number.isFinite(Date.parse(`${v}T12:00:00Z`)) || new Date(`${v}T12:00:00Z`).toISOString().slice(0, 10) !== v)) fail(path);
};
const time = (v: unknown, path: string, optional = false) => {
  if (optional && v === undefined) return;
  if (typeof v !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) fail(path);
};
function array(v: unknown, path: string, visit: (item: Record<string, unknown>, path: string) => void) {
  if (!Array.isArray(v) || v.length > 200000) fail(path);
  (v as unknown[]).forEach((item, i) => { if (!isObject(item)) fail(`${path}[${i}]`); visit(item as Record<string, unknown>, `${path}[${i}]`); });
}
function id(v: unknown, path: string, kind: 'number' | 'string' = 'number') {
  if (kind === 'number') { number(v, path, 0, Number.MAX_SAFE_INTEGER); if (!Number.isSafeInteger(v)) fail(path); }
  else { text(v, path, false, 200); if (!(v as string).length) fail(path); }
}
function record(v: Record<string, unknown>, path: string, optionalTime = false) {
  id(v.id, `${path}.id`); date(v.date, `${path}.date`); time(v.time, `${path}.time`, optionalTime);
}
function exercise(v: Record<string, unknown>, path: string, routine = false) {
  text(v.name, `${path}.name`, false, 500); if (!(v.name as string).trim()) fail(`${path}.name`);
  text(v.category, `${path}.category`, false, 200);
  if (!['strength', 'cardio', 'time'].includes(String(v.mode))) fail(`${path}.mode`);
  text(v.notes, `${path}.notes`, true);
  for (const key of ['sets', 'reps', 'weight', 'minutes', 'distanceKm', 'seconds', 'restSeconds']) number(v[key], `${path}.${key}`, 0, key === 'seconds' ? 86400 : 100000, true);
  for (const key of ['sets', 'reps']) if (v[key] !== undefined && !Number.isInteger(v[key])) fail(`${path}.${key}`);
  if (Array.isArray(v.setDetails) && (v.setDetails.length > 100 || v.setDetails.length === 0 || (v.sets !== undefined && v.sets !== v.setDetails.length))) fail(`${path}.setDetails`);
  if (v.setDetails !== undefined) array(v.setDetails, `${path}.setDetails`, (s, p) => { number(s.reps, `${p}.reps`, 1, 1000); if (!Number.isInteger(s.reps)) fail(`${p}.reps`); number(s.weight, `${p}.weight`, 0, 2000); });
  number(v.sessionExerciseIndex, `${path}.sessionExerciseIndex`, 0, 10000, true);
  text(v.intensity, `${path}.intensity`, true, 500); text(v.sessionId, `${path}.sessionId`, true, 200);
  if (!routine) {
    if (v.mode === 'cardio') number(v.minutes, `${path}.minutes`, .01, 1440);
    if (v.mode === 'time') { number(v.sets, `${path}.sets`, 1, 100); number(v.seconds, `${path}.seconds`, 1, 86400); }
    if (v.mode === 'strength' && !(Array.isArray(v.setDetails) && v.setDetails.length)) {
      number(v.sets, `${path}.sets`, 1, 100); number(v.reps, `${path}.reps`, 1, 1000); number(v.weight, `${path}.weight`, 0, 2000);
    }
  }
}
function meal(v: Record<string, unknown>, path: string) {
  text(v.mealType, `${path}.mealType`, false, 200); text(v.desc, `${path}.desc`);
  number(v.calories, `${path}.calories`, 0, 100000); number(v.protein, `${path}.protein`, 0, 10000);
  number(v.carbs, `${path}.carbs`, 0, 10000, true); number(v.fat, `${path}.fat`, 0, 10000, true);
}
function session(v: Record<string, unknown>, path: string) {
  id(v.id, `${path}.id`, 'string'); text(v.title, `${path}.title`, false, 500);
  for (const key of ['startedAt', 'finishedAt']) { if (key === 'finishedAt' && v[key] === undefined) continue; if (typeof v[key] !== 'string' || !Number.isFinite(Date.parse(v[key] as string))) fail(`${path}.${key}`); }
  array(v.exercises, `${path}.exercises`, (e, p) => exercise(e, p, true));
  if (!Array.isArray(v.completedIds) || !v.completedIds.every(x => Number.isSafeInteger(x) && x >= 0)) fail(`${path}.completedIds`);
}
function assertSafeKeys(v: unknown, path = 'archivo', depth = 0) {
  if (depth > 30) fail(path);
  if (!v || typeof v !== 'object') return;
  for (const [k, value] of Object.entries(v)) { if (forbidden.has(k)) fail(`${path}.${k}`); assertSafeKeys(value, `${path}.${k}`, depth + 1); }
}
/** Strict validation shared by imported files and persisted snapshots. Missing v4/v5 fields migrate later. */
export function validateDB(raw: unknown): asserts raw is Partial<BitacoraDB> {
  if (!isObject(raw) || !['workouts', 'meals', 'waterLogs', 'bodyMetrics'].some(k => Array.isArray(raw[k]))) fail('archivo');
  assertSafeKeys(raw);
  if (raw.version !== undefined) { number(raw.version, 'version', 4, 5); if (!Number.isInteger(raw.version)) fail('version'); }
  if (raw.updatedAt !== undefined) number(raw.updatedAt, 'updatedAt', 0, Number.MAX_SAFE_INTEGER);
  if (raw.darkMode !== undefined && typeof raw.darkMode !== 'boolean') fail('darkMode');
  if (raw.alarmType !== undefined && !['bell','digital','zen','siren','pulse'].includes(String(raw.alarmType))) fail('alarmType');
  if (raw.goals !== undefined) {
    if (!isObject(raw.goals)) fail('goals');
    for (const [key, min, max] of [['calories', 1, 20000], ['proteinG', 1, 2000], ['waterMl', 1, 30000], ['targetWeightKg', 1, 700], ['weeklyWorkoutDays', 1, 7]] as const) number((raw.goals as Record<string, unknown>)[key], `goals.${key}`, min, max, true);
  }
  if (isObject(raw.goals) && raw.goals.weeklyWorkoutDays !== undefined && !Number.isInteger(raw.goals.weeklyWorkoutDays)) fail('goals.weeklyWorkoutDays');
  if (raw.workouts !== undefined) array(raw.workouts, 'workouts', (v,p) => { record(v,p,true); exercise(v,p); });
  if (raw.meals !== undefined) array(raw.meals, 'meals', (v,p) => { record(v,p); meal(v,p); });
  if (raw.waterLogs !== undefined) array(raw.waterLogs, 'waterLogs', (v,p) => { record(v,p); number(v.ml, `${p}.ml`, 1, 30000); text(v.label, `${p}.label`, true, 500); });
  if (raw.bodyMetrics !== undefined) array(raw.bodyMetrics, 'bodyMetrics', (v,p) => { record(v,p); number(v.weightKg, `${p}.weightKg`, 1, 700); number(v.bodyFatPct, `${p}.bodyFatPct`, 0, 100, true); number(v.waistCm, `${p}.waistCm`, 1, 400, true); text(v.notes, `${p}.notes`, true); });
  if (raw.routines !== undefined) array(raw.routines, 'routines', (v,p) => { id(v.id, `${p}.id`, 'string'); text(v.title, `${p}.title`, false, 500); text(v.subtitle, `${p}.subtitle`, true, 1000); text(v.color, `${p}.color`, true, 100); array(v.exercises, `${p}.exercises`, (e,ep) => exercise(e,ep,true)); });
  for (const key of ['customCatalog', 'customExercisePhotos']) {
    if (raw[key] === undefined) continue;
    if (!isObject(raw[key])) fail(key);
    for (const [k, values] of Object.entries(raw[key] as Record<string, unknown>)) {
      if (k.length > 500 || !Array.isArray(values) || values.length > 10000) fail(`${key}.${k}`);
      (values as unknown[]).forEach(v => { text(v, `${key}.${k}`, false, key === 'customExercisePhotos' ? 10e6 : 500); if (key === 'customExercisePhotos' && !/^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(String(v))) fail(`${key}.${k}`); });
    }
  }
  if (raw.customFoods !== undefined) array(raw.customFoods, 'customFoods', (v,p) => {
    id(v.id, `${p}.id`, 'string'); text(v.name, `${p}.name`, false, 500); text(v.unitLabel, `${p}.unitLabel`, false, 200);
    if (!['Proteínas','Carbohidratos','Lácteos y Huevos','Grasas y Frutas','Platos Preparados'].includes(String(v.category))) fail(`${p}.category`);
    number(v.baseAmount, `${p}.baseAmount`, .001, 100000); if (typeof v.isUnit !== 'boolean') fail(`${p}.isUnit`);
    for (const key of ['kcal','protein','carbs','fat']) number(v[key], `${p}.${key}`, 0, 100000);
  });
  if (raw.favoriteExercises !== undefined && (!Array.isArray(raw.favoriteExercises) || !raw.favoriteExercises.every(v=>typeof v === 'string' && v.length <= 500))) fail('favoriteExercises');
  if (raw.savedMeals !== undefined) array(raw.savedMeals, 'savedMeals', (v,p) => { id(v.id,`${p}.id`,'string'); meal(v,p); });
  if (raw.activeSession !== undefined && raw.activeSession !== null) { if (!isObject(raw.activeSession)) fail('activeSession'); session(raw.activeSession as Record<string,unknown>,'activeSession'); }
  if (raw.workoutSessions !== undefined) array(raw.workoutSessions, 'workoutSessions', session);
  if (raw.chrono !== undefined) {
    if (!isObject(raw.chrono)) fail('chrono');
    const c = raw.chrono as Record<string,unknown>;
    if (c.mode !== undefined && !['countdown','stopwatch','hiit'].includes(String(c.mode))) fail('chrono.mode');
    for (const key of ['running','autoStartOnSet','keepScreenAwake']) if(c[key] !== undefined && typeof c[key] !== 'boolean') fail(`chrono.${key}`);
    number(c.accumulatedElapsedMs,'chrono.accumulatedElapsedMs',0,Number.MAX_SAFE_INTEGER,true);
    number(c.initialSelectedMs,'chrono.initialSelectedMs',1000,86400000,true);
    for(const key of ['hiitWorkSec','hiitRestSec']) number(c[key],`chrono.${key}`,1,3600,true);
    for(const key of ['hiitTotalRounds','hiitCurrentRound']) { number(c[key],`chrono.${key}`,1,100,true); if(c[key] !== undefined && !Number.isInteger(c[key])) fail(`chrono.${key}`); }
    if(c.running === true && (typeof c.startedAtEpochMs !== 'number' || c.startedAtEpochMs <= 0)) fail('chrono.startedAtEpochMs');
    if(c.startedAtEpochMs !== null) number(c.startedAtEpochMs,'chrono.startedAtEpochMs',0,Number.MAX_SAFE_INTEGER,true);
    if(c.hiitPhase !== undefined && !['work','rest'].includes(String(c.hiitPhase))) fail('chrono.hiitPhase');
    if(c.laps !== undefined && (!Array.isArray(c.laps) || !c.laps.every(v=>typeof v === 'number' && Number.isFinite(v) && v >= 0))) fail('chrono.laps');
  }
}
