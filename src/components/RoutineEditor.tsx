import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react';
import type { BitacoraDB, ExerciseVisualInfo, RoutineExerciseItem, SavedRoutine } from '../types';
import { EXERCISE_CATALOG, getExerciseVisualInfo } from '../data/exercises';

interface Props {
  routine: SavedRoutine;
  db: BitacoraDB;
  onSave: (routine: SavedRoutine) => void;
  onClose: () => void;
}

export const RoutineEditor: React.FC<Props> = ({ routine, db, onSave, onClose }) => {
  const [draft, setDraft] = useState<SavedRoutine>(() => structuredClone(routine));
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const catalog = useMemo(() => {
    const custom = Object.entries(db.customCatalog).flatMap(([category, names]) => names.map(name => getExerciseVisualInfo(name, category, category === 'Cardio y Bici' ? 'cardio' : category === 'Abdomen y Tiempo' ? 'time' : 'strength')));
    return [...EXERCISE_CATALOG, ...custom].filter((item, index, items) => items.findIndex(other => other.name === item.name) === index);
  }, [db.customCatalog]);
  const matches = catalog.filter(item => `${item.name} ${item.category}`.toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es')));
  const changeExercise = (index: number, values: Partial<RoutineExerciseItem>) => setDraft(prev => ({ ...prev, exercises: prev.exercises.map((item, i) => i === index ? { ...item, ...values } : item) }));
  const move = (index: number, delta: number) => setDraft(prev => {
    const exercises = [...prev.exercises];
    [exercises[index], exercises[index + delta]] = [exercises[index + delta], exercises[index]];
    return { ...prev, exercises };
  });
  const add = (item: ExerciseVisualInfo) => setDraft(prev => ({ ...prev, exercises: [...prev.exercises, {
    category: item.category, name: item.name, mode: item.mode, restSeconds: 90,
    ...(item.mode === 'cardio' ? { minutes: 20, distanceKm: 0 } : item.mode === 'time' ? { sets: 3, seconds: 30 } : { sets: 3, reps: 10, weight: 0 }),
  }] }));
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.title.trim()) return setError('Escribe un nombre para la rutina.');
    if (!draft.exercises.length) return setError('Agrega al menos un ejercicio.');
    const validNumber = (value: number | undefined, min: number, max: number, integer = false) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max && (!integer || Number.isInteger(value));
    for (const exercise of draft.exercises) {
      if (!validNumber(exercise.restSeconds ?? 90, 0, 3600, true)) return setError(`Revisa el descanso de ${exercise.name}: entre 0 y 3600 segundos.`);
      if (exercise.mode === 'cardio' && (!validNumber(exercise.minutes, 0.1, 1440) || !validNumber(exercise.distanceKm ?? 0, 0, 1000))) return setError(`Revisa los minutos y la distancia de ${exercise.name}.`);
      if (exercise.mode === 'time' && (!validNumber(exercise.sets, 1, 30, true) || !validNumber(exercise.seconds, 1, 86400, true))) return setError(`Revisa las series y segundos de ${exercise.name}.`);
      if (exercise.mode === 'strength' && (!validNumber(exercise.sets, 1, 30, true) || !validNumber(exercise.reps, 1, 1000, true) || !validNumber(exercise.weight ?? 0, 0, 1500))) return setError(`Revisa las series, repeticiones y peso de ${exercise.name}.`);
    }
    onSave({ ...draft, title: draft.title.trim(), subtitle: draft.subtitle.trim() || `${draft.exercises.length} ejercicios · Plantilla personal` });
    onClose();
  };
  return <section className="card-soft routine-editor" aria-label="Editor de rutina">
    <div className="routine-heading"><h3 className="title-heavy">Editar rutina</h3><button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar editor de rutina"><X size={18}/></button></div>
    <form onSubmit={submit}>
      <label className="lbl" htmlFor="routine-title">Nombre</label>
      <input id="routine-title" className="input-clean" maxLength={120} required value={draft.title} onChange={event => setDraft(prev => ({ ...prev, title: event.target.value }))}/>
      <label className="lbl" htmlFor="routine-description">Descripción opcional</label>
      <input id="routine-description" className="input-clean" maxLength={500} value={draft.subtitle} onChange={event => setDraft(prev => ({ ...prev, subtitle: event.target.value }))}/>
      <p className="text-thin">Estas cantidades son una planificación. Los resultados se registran durante la sesión.</p>
      {draft.exercises.map((exercise, index) => <fieldset key={index} className="routine-exercise">
        <legend>{index + 1}. {exercise.name}</legend>
        <div className="routine-actions">
          <button type="button" className="icon-btn" disabled={index === 0} aria-label={`Subir ${exercise.name}`} onClick={() => move(index, -1)}><ArrowUp size={17}/></button>
          <button type="button" className="icon-btn" disabled={index === draft.exercises.length - 1} aria-label={`Bajar ${exercise.name}`} onClick={() => move(index, 1)}><ArrowDown size={17}/></button>
          <button type="button" className="icon-btn danger" aria-label={`Quitar ${exercise.name}`} onClick={() => setDraft(prev => ({ ...prev, exercises: prev.exercises.filter((_, i) => i !== index) }))}><Trash2 size={17}/></button>
        </div>
        <div className="routine-values">
          {exercise.mode !== 'cardio' && <label>Series<input type="number" min={1} max={30} step={1} required value={Number.isNaN(exercise.sets) ? '' : exercise.sets ?? ''} onChange={event => changeExercise(index, { sets: (event.target.value === '' ? Number.NaN : Number(event.target.value)), setDetails: undefined })}/></label>}
          {exercise.mode === 'strength' && <>
            <label>Repeticiones<input type="number" min={1} max={1000} step={1} required value={Number.isNaN(exercise.reps) ? '' : exercise.reps ?? ''} onChange={event => changeExercise(index, { reps: (event.target.value === '' ? Number.NaN : Number(event.target.value)), setDetails: undefined })}/></label>
            <label>Peso (kg)<input type="number" min={0} max={1500} step="any" required value={Number.isNaN(exercise.weight) ? '' : exercise.weight ?? 0} onChange={event => changeExercise(index, { weight: (event.target.value === '' ? Number.NaN : Number(event.target.value)), setDetails: undefined })}/></label>
          </>}
          {exercise.mode === 'time' && <label>Segundos<input type="number" min={1} max={86400} step={1} required value={Number.isNaN(exercise.seconds) ? '' : exercise.seconds ?? ''} onChange={event => changeExercise(index, { seconds: (event.target.value === '' ? Number.NaN : Number(event.target.value)) })}/></label>}
          {exercise.mode === 'cardio' && <>
            <label>Minutos<input type="number" min={0.1} max={1440} step="any" required value={Number.isNaN(exercise.minutes) ? '' : exercise.minutes ?? ''} onChange={event => changeExercise(index, { minutes: (event.target.value === '' ? Number.NaN : Number(event.target.value)) })}/></label>
            <label>Distancia (km)<input type="number" min={0} max={1000} step="any" required value={Number.isNaN(exercise.distanceKm) ? '' : exercise.distanceKm ?? 0} onChange={event => changeExercise(index, { distanceKm: (event.target.value === '' ? Number.NaN : Number(event.target.value)) })}/></label>
          </>}
          <label>Descanso (s)<input type="number" min={0} max={3600} step={1} required value={Number.isNaN(exercise.restSeconds) ? '' : exercise.restSeconds ?? 90} onChange={event => changeExercise(index, { restSeconds: (event.target.value === '' ? Number.NaN : Number(event.target.value)) })}/></label>
        </div>
      </fieldset>)}
      <label className="lbl" htmlFor="routine-search">Agregar ejercicios del catálogo</label>
      <input id="routine-search" className="input-clean" placeholder="Buscar por nombre o grupo muscular" value={query} onChange={event => setQuery(event.target.value)}/>
      <div className="routine-picker">{matches.map(item => <button type="button" className="pill-action" key={item.name} onClick={() => add(item)}><Plus size={15}/>{item.name}</button>)}</div>
      {!matches.length && <p>No se encontraron ejercicios.</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
      <button className="btn-main" type="submit">Guardar rutina</button>
    </form>
  </section>;
};
