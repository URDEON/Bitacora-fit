import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RoutineEditor } from './RoutineEditor';
import { useDialog } from './ConfirmDialog';
import { stepValue } from '../services/stepper';
import { activeSeriesDetails, ensureSeriesDetails, restoreSeriesDetails } from '../services/seriesDetails';
import { previousComparableWorkout } from '../services/workoutCompare';
import type { ViewBackController } from '../services/navigation';
import '../styles/training.css';
import {
  Camera,
  Check,
  Copy,
  Dumbbell,
  Edit3,
  Eye,
  Flame,
  FolderHeart,
  Grid,
  List,
  Plus,
  Search,
  Star,
  Play,
  Timer,
  Trash2,
  TrendingUp,
  Trophy,
  X,
} from 'lucide-react';
import {
  BitacoraDB,
  CategoryName,
  EquipmentType,
  ExerciseMode,
  ExerciseVisualInfo,
  SavedRoutine,
  RoutineExerciseItem,
  WorkoutEntry,
} from '../types';
import {
  CATEGORIES,
  EXERCISE_CATALOG,
  getExerciseVisualInfo,
  MUSCLE_LABELS_ES,
} from '../data/exercises';

interface ExercisesViewProps {
  db: BitacoraDB;
  currentDate: string;
  onSaveWorkout: (entry: Omit<WorkoutEntry, 'id'>, editingId: number | null) => void;
  onDeleteWorkout: (id: number) => void;
  onDuplicateWorkout: (entry: WorkoutEntry) => void;
  onSaveCustomExercise: (category: string, name: string) => void;
  onOpenVisualModal: (info: ExerciseVisualInfo) => void;
  onLoadRoutineToDay: (routine: SavedRoutine) => void | Promise<boolean>;
  onSaveTodayAsRoutine: (title: string) => void;
  onDeleteRoutine: (routineId: string) => void;
  onToggleAutoRest: (enabled: boolean) => void;
  onSaveRoutine?: (routine: SavedRoutine) => void;
  onToggleFavorite?: (exerciseName: string) => void;
  onUpdateSession?: (session: BitacoraDB['activeSession']) => void;
  onFinishSession?: () => void;
  externalSelection?: ExerciseVisualInfo | null;
  onConsumeSelection?: () => void;
  prefillCardioMinutes?: number | null;
  onConsumePrefillCardio?: () => void;
  onOpenChrono?: () => void;
  onStartGuidedWorkout?: (entry: Omit<WorkoutEntry, 'id'>) => void;
  registerBackController?: (controller: ViewBackController | null) => void;
}

const EQUIPMENT_FILTERS: Array<'Todos' | EquipmentType> = [
  'Todos',
  'Máquina',
  'Polea',
  'Mancuernas',
  'Barra',
  'Peso Corporal',
  'Cardio / Bici',
];

export const ExercisesView: React.FC<ExercisesViewProps> = ({
  db,
  currentDate,
  onSaveWorkout,
  onDeleteWorkout,
  onDuplicateWorkout,
  onSaveCustomExercise,
  onOpenVisualModal,
  onLoadRoutineToDay,
  onSaveTodayAsRoutine,
  onDeleteRoutine,
  onToggleAutoRest,
  prefillCardioMinutes,
  onConsumePrefillCardio,
  onSaveRoutine,
  onToggleFavorite,
  onUpdateSession,
  onFinishSession,
  externalSelection,
  onConsumeSelection,
  onOpenChrono,
  onStartGuidedWorkout,
  registerBackController,
}) => {
  const [subView, setSubView] = useState<'logger' | 'routines'>('logger');
  const { alert: showAlert } = useDialog();
  const [activeCategory, setActiveCategory] = useState<CategoryName>('Pecho');
  const [equipFilter, setEquipFilter] = useState<'Todos' | EquipmentType>('Todos');
  const [visualGridMode, setVisualGridMode] = useState<boolean>(true);
  const [catalogCollapsed, setCatalogCollapsed] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [exName, setExName] = useState('Press de banca plano con barra');
  const [mode, setMode] = useState<ExerciseMode>('strength');
  const [strSets, setStrSets] = useState(4);
  const [strReps, setStrReps] = useState(10);
  const [strWeight, setStrWeight] = useState(40);
  const [carMins, setCarMins] = useState(30);
  const [carKm, setCarKm] = useState(8);
  const [carIntensity, setCarIntensity] = useState('Moderado');
  const [timeSets, setTimeSets] = useState(3);
  const [timeSecs, setTimeSecs] = useState(45);
  const [notes, setNotes] = useState('');

  const [newRoutineTitle, setNewRoutineTitle] = useState('');
  const [routineDraft, setRoutineDraft] = useState<SavedRoutine | null>(null);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [individualSets, setIndividualSets] = useState(false);
  const [setDetails, setSetDetails] = useState<Array<{ reps: number; weight: number }>>([]);
  const [restSeconds, setRestSeconds] = useState(90);
  const [recordDate, setRecordDate] = useState(currentDate);
  const [recordTime, setRecordTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [sessionExerciseIndex, setSessionExerciseIndex] = useState<number | undefined>(undefined);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [draftRestored, setDraftRestored] = useState(false);

  const backStateRef = useRef({ routineDraft, editingId, subView, currentDate });
  backStateRef.current = { routineDraft, editingId, subView, currentDate };

  useEffect(() => {
    if (!registerBackController) return;
    registerBackController({
      hasActiveEditor: () =>
        backStateRef.current.routineDraft !== null || backStateRef.current.editingId !== null,
      closeEditor: () => {
        if (backStateRef.current.routineDraft !== null) {
          setRoutineDraft(null);
          return true;
        }
        if (backStateRef.current.editingId !== null) {
          setEditingId(null);
          setNotes('');
          setRecordDate(backStateRef.current.currentDate);
          setRecordTime(new Date().toTimeString().slice(0, 5));
          setSessionExerciseIndex(undefined);
          setFormErrors({});
          return true;
        }
        return false;
      },
      hasActiveSubview: () => backStateRef.current.subView !== 'logger',
      leaveSubview: () => {
        if (backStateRef.current.subView !== 'logger') {
          setSubView('logger');
          return true;
        }
        return false;
      },
    });
    return () => registerBackController(null);
  }, [registerBackController]);

  useEffect(() => {
    try {
      const text = localStorage.getItem('bitacora_fit_training_draft');
      if (text) {
        const draft = JSON.parse(text);
        if (draft && typeof draft.exName === 'string' && typeof draft.notes === 'string') {
          setExName(draft.exName); setNotes(draft.notes);
          if (CATEGORIES.includes(draft.activeCategory)) setActiveCategory(draft.activeCategory);
          if (['strength', 'cardio', 'time'].includes(draft.mode)) setMode(draft.mode);
          const setters = { strSets: setStrSets, strReps: setStrReps, strWeight: setStrWeight, carMins: setCarMins, carKm: setCarKm, timeSets: setTimeSets, timeSecs: setTimeSecs, restSeconds: setRestSeconds };
          for (const [key, setter] of Object.entries(setters)) {
            if (draft[key] === null) setter(Number.NaN);
            else if (typeof draft[key] === 'number' && Number.isFinite(draft[key])) setter(draft[key]);
          }
          const restoredDetails = restoreSeriesDetails(draft.setDetails);
          if (restoredDetails) setSetDetails(restoredDetails);
          setIndividualSets(draft.individualSets === true);
        }
      }
    } catch { /* A damaged form draft must not prevent access to saved records. */ }
    setDraftRestored(true);
  }, []);
  useEffect(() => {
    if (!draftRestored || editingId !== null) return;
    try { localStorage.setItem('bitacora_fit_training_draft', JSON.stringify({ exName, activeCategory, mode, strSets, strReps, strWeight, carMins, carKm, timeSets, timeSecs, notes, restSeconds, individualSets, setDetails })); } catch { /* Saved records use the persistent database. */ }
  }, [draftRestored, editingId, exName, activeCategory, mode, strSets, strReps, strWeight, carMins, carKm, timeSets, timeSecs, notes, restSeconds, individualSets, setDetails]);
  useEffect(() => { if (editingId === null) setRecordDate(currentDate); }, [currentDate]);
  useEffect(() => {
    if (!individualSets) return;
    setSetDetails(previous => ensureSeriesDetails(previous, strSets, { reps: strReps, weight: strWeight }));
  }, [strSets, individualSets, strReps, strWeight]);
  const visibleSetDetails = Number.isInteger(strSets) && strSets >= 1 && strSets <= 30
    ? setDetails.slice(0, strSets) : setDetails;
  useEffect(() => {
    if (!externalSelection) return;
    setSubView('logger'); setExName(externalSelection.name); setMode(externalSelection.mode); setActiveCategory(externalSelection.category); setFormErrors({});
    onConsumeSelection?.();
  }, [externalSelection, onConsumeSelection]);
  useEffect(() => { if (!db.activeSession) setSessionExerciseIndex(undefined); }, [db.activeSession?.id]);


  // Handle prefill from Stopwatch -> Cardio
  React.useEffect(() => {
    if (prefillCardioMinutes && prefillCardioMinutes > 0) {
      setSubView('logger');
      setActiveCategory('Cardio y Bici');
      setMode('cardio');
      setCarMins(prefillCardioMinutes);
      if (!exName.trim() || mode !== 'cardio') {
        setExName('Bicicleta estática');
      }
      onConsumePrefillCardio?.();
    }
  }, [prefillCardioMinutes, exName, mode, onConsumePrefillCardio]);

  // Catalog items merged with custom user exercises
  const filteredCatalog = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const customEntries: ExerciseVisualInfo[] = [];
    Object.entries(db.customCatalog || {}).forEach(([cat, names]) => {
      names.forEach((n) => {
        if (!EXERCISE_CATALOG.some((b) => b.name.toLowerCase() === n.toLowerCase())) {
          customEntries.push(
            getExerciseVisualInfo(
              n,
              cat,
              cat === 'Cardio y Bici' ? 'cardio' : cat === 'Abdomen y Tiempo' ? 'time' : 'strength'
            )
          );
        }
      });
    });

    const combined = [...customEntries, ...EXERCISE_CATALOG];
    return combined.filter((item) => {
      const matchesCat = q.length > 0 ? true : item.category === activeCategory;
      const matchesEquip = equipFilter === 'Todos' ? true : item.equipment === equipFilter;
      const matchesSearch =
        q.length === 0 ||
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.equipment.toLowerCase().includes(q) ||
        item.detectionHint.toLowerCase().includes(q);
      return matchesCat && matchesEquip && matchesSearch && (!onlyFavorites || db.favoriteExercises.includes(item.name));
    });
  }, [activeCategory, equipFilter, searchQuery, db.customCatalog, onlyFavorites, db.favoriteExercises]);

  // Active Exercise Visual Info + Custom Photos
  const activeVisual = useMemo(
    () => getExerciseVisualInfo(exName, activeCategory, mode),
    [exName, activeCategory, mode]
  );

  const activePhotos = useMemo(() => {
    const custom = db.customExercisePhotos?.[activeVisual.name] || [];
    return [...custom, ...activeVisual.images];
  }, [db.customExercisePhotos, activeVisual]);

  // Load Comparison ("Comparación de cargas entre entrenamientos" + Personal Record)
  const previousStats = useMemo(() => {
    const clean = exName.trim().toLowerCase();
    if (!clean) return null;
    const history = db.workouts
      .filter((w) => w.name.trim().toLowerCase() === clean && w.id !== editingId && w.date <= currentDate)
      .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

    if (history.length === 0) return null;
    const last = history[0];
    const prWeight = history.reduce((max, w) => Math.max(max, ...(w.setDetails?.map(set => set.weight) || [Number(w.weight) || 0])), 0);
    const prMins = history.reduce((max, w) => Math.max(max, Number(w.minutes) || 0), 0);
    return { last, prWeight, prMins, count: history.length };
  }, [db.workouts, exName, editingId, currentDate]);

  const dayWorkouts = useMemo(
    () => db.workouts.filter((w) => w.date === currentDate),
    [db.workouts, currentDate]
  );

  const selectCategory = (cat: CategoryName) => {
    setActiveCategory(cat);
    const first = EXERCISE_CATALOG.find((e) => e.category === cat);
    if (first) {
      setExName(first.name);
      setMode(first.mode);
    }
  };

  const pickExercise = (item: ExerciseVisualInfo) => {
    setExName(item.name);
    setMode(item.mode);
    setActiveCategory(item.category);
    setFormErrors({});
    setSessionExerciseIndex(undefined);
    setCatalogCollapsed(true);
  };

  const prepareSessionExercise = (exercise: RoutineExerciseItem, index: number) => {
    setSubView('logger'); setEditingId(null); setExName(exercise.name); setMode(exercise.mode);
    setActiveCategory(exercise.category as CategoryName); setSessionExerciseIndex(index); setNotes(''); setFormErrors({});
    setStrSets(exercise.sets ?? 3); setStrReps(exercise.reps ?? 10); setStrWeight(exercise.weight ?? 0);
    setCarMins(exercise.minutes ?? 20); setCarKm(exercise.distanceKm ?? 0); setTimeSets(exercise.sets ?? 3); setTimeSecs(exercise.seconds ?? 30);
    setRestSeconds(exercise.restSeconds ?? 90); setIndividualSets(Boolean(exercise.setDetails?.length)); setSetDetails(exercise.setDetails || []);
    setRecordDate(currentDate); setRecordTime(new Date().toTimeString().slice(0, 5));
    document.getElementById('exercise-name')?.focus();
  };

  const handleStep = (
    setter: React.Dispatch<React.SetStateAction<number>>,
    delta: number,
    min = 0,
    max = Number.POSITIVE_INFINITY
  ) => {
    setter((prev) => stepValue(Number(prev || 0), delta, min, max));
  };

  const handleSubmit = (startGuided = false) => {
    const cleanName = exName.trim();
    const errors: Record<string, string> = {};
    const valid = (key: string, value: number, min: number, max: number, integer = false) => {
      if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) errors[key] = `Ingresa ${integer ? 'un número entero' : 'un número'} entre ${min} y ${max}.`;
    };
    if (!cleanName || cleanName.length > 160) errors.name = 'Escribe un nombre de 1 a 160 caracteres.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(recordDate) || Number.isNaN(new Date(recordDate + 'T12:00:00').getTime())) errors.date = 'Selecciona una fecha válida.';
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(recordTime)) errors.time = 'Selecciona una hora válida.';
    valid('rest', restSeconds, 0, 3600, true);
    const existing = editingId === null ? undefined : db.workouts.find(workout => workout.id === editingId);
    const base: Omit<WorkoutEntry, 'id'> = {
      date: recordDate, time: recordTime, category: activeCategory, name: cleanName, mode, notes: notes.trim(), restSeconds,
      ...(existing?.sessionId ? { sessionId: existing.sessionId, sessionExerciseIndex: existing.sessionExerciseIndex } : db.activeSession && sessionExerciseIndex !== undefined ? { sessionId: db.activeSession.id, sessionExerciseIndex } : {}),
    };
    if (mode === 'strength') {
      valid('sets', strSets, 1, 30, true);
      if (individualSets) {
        const activeDetails = activeSeriesDetails(setDetails, strSets);
        if (activeDetails.length !== strSets) errors.details = 'Revisa la cantidad de series.';
        activeDetails.forEach((set, index) => { valid(`reps-${index}`, set.reps, 1, 1000, true); valid(`weight-${index}`, set.weight, 0, 1500); });
        base.setDetails = activeDetails;
        base.sets = strSets; base.reps = activeDetails[0]?.reps; base.weight = Math.max(0, ...activeDetails.map(set => set.weight));
      } else {
        valid('reps', strReps, 1, 1000, true); valid('weight', strWeight, 0, 1500);
        base.sets = strSets; base.reps = strReps; base.weight = strWeight;
      }
    } else if (mode === 'cardio') {
      valid('minutes', carMins, 0.1, 1440); valid('distance', carKm, 0, 1000);
      base.minutes = carMins; base.distanceKm = carKm; base.intensity = carIntensity.trim();
    } else {
      valid('sets', timeSets, 1, 30, true); valid('seconds', timeSecs, 1, 86400, true);
      base.sets = timeSets; base.seconds = timeSecs;
    }
    setFormErrors(errors);
    if (Object.keys(errors).length) return;
    if (startGuided && mode !== 'cardio' && editingId === null && onStartGuidedWorkout) {
      onStartGuidedWorkout(base);
      return;
    }
    onSaveWorkout(base, editingId);
    setNotes(''); setEditingId(null); setSessionExerciseIndex(undefined); setRecordTime(new Date().toTimeString().slice(0, 5));
  };

  const startEditing = (w: WorkoutEntry) => {
    setSubView('logger');
    setEditingId(w.id);
    if (CATEGORIES.includes(w.category as CategoryName)) {
      setActiveCategory(w.category as CategoryName);
    }
    setExName(w.name);
    setMode(w.mode);
    setRecordDate(w.date); setRecordTime(w.time || new Date().toTimeString().slice(0, 5));
    setRestSeconds(w.restSeconds ?? 90); setIndividualSets(Boolean(w.setDetails?.length)); setSetDetails(w.setDetails || []);
    setSessionExerciseIndex(w.sessionExerciseIndex); setFormErrors({});
    if (w.mode === 'strength') {
      setStrSets(w.sets || 4);
      setStrReps(w.reps || 10);
      setStrWeight(w.weight || 0);
    } else if (w.mode === 'cardio') {
      setCarMins(w.minutes || 30);
      setCarKm(w.distanceKm || 0);
      setCarIntensity(w.intensity || 'Moderado');
    } else {
      setTimeSets(w.sets || 3);
      setTimeSecs(w.seconds || 45);
    }
    setNotes(w.notes || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const sessionCompletedCount = db.activeSession
    ? db.activeSession.exercises.filter((_, index) =>
        db.workouts.some(
          (workout) =>
            workout.sessionId === db.activeSession!.id &&
            workout.sessionExerciseIndex === index,
        ),
      ).length
    : 0;
  const sessionProgressPct =
    db.activeSession && db.activeSession.exercises.length > 0
      ? Math.round((sessionCompletedCount / db.activeSession.exercises.length) * 100)
      : 0;

  return (
    <div className="fade-view">
      {db.activeSession && (
        <section className="card-soft session-banner" aria-label="Sesión en curso">
          <div className="routine-heading">
            <div>
              <h2 className="block-title">{db.activeSession.title}</h2>
              <p className="block-subtitle">
                {sessionCompletedCount} de {db.activeSession.exercises.length} ejercicios completados
              </p>
            </div>
            <span className="s20-badge">Sesión en curso</span>
          </div>
          <div className="session-progress-bar" aria-hidden="true">
            <span style={{ width: `${sessionProgressPct}%` }} />
          </div>
          {db.activeSession.exercises.map((exercise, index) => {
            const completed = db.workouts.some(
              (workout) =>
                workout.sessionId === db.activeSession!.id &&
                workout.sessionExerciseIndex === index,
            );
            return (
              <div className="session-item" key={index}>
                <span>
                  <strong>{index + 1}.</strong> {exercise.name}
                  {completed ? ' · Registrado' : ''}
                </span>
                <button
                  type="button"
                  className="pill-action"
                  onClick={() => prepareSessionExercise(exercise, index)}
                >
                  {completed ? 'Repetir' : 'Registrar'}
                </button>
              </div>
            );
          })}
          <div className="routine-actions">
            <button type="button" className="btn-main green" onClick={onFinishSession}>
              Finalizar sesión
            </button>
          </div>
        </section>
      )}
      {routineDraft && onSaveRoutine && (
        <RoutineEditor
          key={routineDraft.id}
          routine={routineDraft}
          db={db}
          onSave={onSaveRoutine}
          onClose={() => setRoutineDraft(null)}
        />
      )}

      {/* Selector rápido entre Anotar Ejercicio y Rutinas Guardadas */}
      <div className="mode-switcher">
        <button
          type="button"
          className={`mode-card ${subView === 'logger' ? 'active' : ''}`}
          aria-pressed={subView === 'logger'}
          onClick={() => setSubView('logger')}
        >
          <span className="m-title">
            <Dumbbell size={14} /> Catálogo y registro
          </span>
          <span className="m-sub">{EXERCISE_CATALOG.length} ejercicios y guías</span>
        </button>
        <button
          type="button"
          className={`mode-card cardio-mode ${subView === 'routines' ? 'active' : ''}`}
          aria-pressed={subView === 'routines'}
          onClick={() => setSubView('routines')}
        >
          <span className="m-title">
            <FolderHeart size={14} /> Rutinas guardadas ({db.routines.length})
          </span>
          <span className="m-sub">Plantillas y sesiones</span>
        </button>
      </div>

      {subView === 'routines' ? (
        <section className="card-soft" aria-labelledby="routines-section-title">
          <div className="block-head">
            <div>
              <h2 id="routines-section-title" className="block-title">
                Mis rutinas de entrenamiento
              </h2>
              <p className="block-subtitle">
                Crea una plantilla, inicia una sesión y registra lo que completes. Tus resultados se guardan por separado.
              </p>
            </div>
          </div>

          {onSaveRoutine && (
            <button
              type="button"
              className="btn-main"
              onClick={() =>
                setRoutineDraft({
                  id: crypto.randomUUID(),
                  title: '',
                  subtitle: '',
                  color: '#C84B24',
                  exercises: [],
                })
              }
            >
              <Plus size={17} /> Crear rutina desde cero
            </button>
          )}

          <div className="sub-panel">
            <div className="lbl">
              <span>Guardar los {dayWorkouts.length} ejercicios del {currentDate} como rutina</span>
            </div>
            <div className="inline-input-row">
              <input
                type="text"
                className="input-clean"
                aria-label="Nombre de la rutina con registros del día"
                placeholder="Ej. Torso A / Pierna pesada…"
                value={newRoutineTitle}
                onChange={(e) => setNewRoutineTitle(e.target.value)}
              />
              <button
                type="button"
                className="btn-main green"
                onClick={async () => {
                  if (dayWorkouts.length === 0) {
                    await showAlert({
                      title: 'Sin ejercicios en la fecha',
                      message:
                        'Primero registra al menos 1 ejercicio en la fecha seleccionada para guardarlo como rutina.',
                    });
                    return;
                  }
                  const title = newRoutineTitle.trim() || `Rutina ${currentDate}`;
                  onSaveTodayAsRoutine(title);
                  setNewRoutineTitle('');
                }}
              >
                + Guardar
              </button>
            </div>
          </div>

          {db.routines.length === 0 ? (
            <p className="empty-inline">
              Todavía no tienes rutinas guardadas. Crea una plantilla para iniciar sesiones con un toque.
            </p>
          ) : (
            db.routines.map((rt) => (
              <div
                key={rt.id}
                className="ticket-row routine-card"
                style={{ borderLeftColor: rt.color || 'var(--accent)' }}
              >
                <div className="routine-heading">
                  <div>
                    <div className="ticket-title">{rt.title}</div>
                    <div className="ticket-meta">{rt.subtitle}</div>
                  </div>
                  <div className="routine-actions">
                    {onSaveRoutine && (
                      <>
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Editar rutina ${rt.title}`}
                          onClick={() => setRoutineDraft(rt)}
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Duplicar rutina ${rt.title}`}
                          onClick={() =>
                            onSaveRoutine({
                              ...structuredClone(rt),
                              id: crypto.randomUUID(),
                              title: `${rt.title} (copia)`,
                            })
                          }
                        >
                          <Copy size={16} />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="icon-btn danger"
                      onClick={() => onDeleteRoutine(rt.id)}
                      title="Eliminar rutina"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div className="routine-chip-list">
                  {rt.exercises.map((ex, idx) => (
                    <button
                      type="button"
                      key={idx}
                      className="routine-ex-chip"
                      onClick={() => {
                        const vis = getExerciseVisualInfo(ex.name, ex.category, ex.mode);
                        onOpenVisualModal(vis);
                      }}
                    >
                      <Eye size={13} />
                      <span>{ex.name}</span>
                      <strong className="mono-num">
                        {ex.mode === 'cardio'
                          ? `${ex.minutes}m`
                          : ex.mode === 'time'
                            ? `${ex.sets}×${ex.seconds}s`
                            : `${ex.sets}×${ex.reps}`}
                      </strong>
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className="btn-main"
                  onClick={async () => {
                    const started = await onLoadRoutineToDay(rt);
                    if (started !== false) setSubView('logger');
                  }}
                >
                  <Play size={16} /> INICIAR SESIÓN · {rt.exercises.length} EJERCICIOS
                </button>
              </div>
            ))
          )}
        </section>
      ) : (
        <section className="card-soft" aria-labelledby="workout-logger-title">
          <div className="block-head">
            <div>
              <h2 id="workout-logger-title" className="block-title">
                {editingId ? (
                  <>
                    <Edit3 size={17} /> Editando ejercicio
                  </>
                ) : (
                  <>
                    <Dumbbell size={17} /> Registrar ejercicio
                  </>
                )}
              </h2>
              <p className="block-subtitle">
                Selecciona del catálogo o escribe un ejercicio propio y anota tus series reales.
              </p>
            </div>
            {editingId && (
              <button
                type="button"
                className="pill-action"
                onClick={() => {
                  setEditingId(null);
                  setNotes('');
                  setRecordDate(currentDate);
                  setRecordTime(new Date().toTimeString().slice(0, 5));
                  setSessionExerciseIndex(undefined);
                  setFormErrors({});
                }}
              >
                <X size={14} /> Cancelar
              </button>
            )}
          </div>

          {/* 1. Categoría muscular + Catálogo plegable */}
          <div className="lbl">
            <span>1. Grupo muscular o cardio</span>
            <button
              type="button"
              className="text-button"
              aria-expanded={!catalogCollapsed}
              aria-controls="exercise-catalog"
              onClick={() => setCatalogCollapsed((v) => !v)}
            >
              {catalogCollapsed ? `Mostrar catálogo (${filteredCatalog.length})` : 'Ocultar catálogo'}
            </button>
          </div>
          <div className="cat-scroll">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`cat-pill ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => {
                  selectCategory(cat);
                  setCatalogCollapsed(false);
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {!catalogCollapsed && (
            <div className="catalog-drawer" id="exercise-catalog">
              <div className="search-input-wrap">
                <Search size={16} />
                <input
                  type="text"
                  className="input-clean"
                  aria-label="Buscar ejercicio o máquina"
                  placeholder="Buscar ejercicio o máquina (ej. Prensa, Polea, Banca)…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="equip-filter-row">
                {EQUIPMENT_FILTERS.map((eq) => (
                  <button
                    key={eq}
                    type="button"
                    className={`equip-chip ${equipFilter === eq ? 'active' : ''}`}
                    onClick={() => setEquipFilter(eq)}
                  >
                    {eq === 'Todos' ? 'Todo equipo' : eq}
                  </button>
                ))}
              </div>

              <div className="catalog-toolbar">
                <span className="text-thin">
                  <strong>{filteredCatalog.length}</strong> ejercicios disponibles
                </span>
                <div className="catalog-view-toggle">
                  {onToggleFavorite && (
                    <button
                      type="button"
                      className={`pill-action ${onlyFavorites ? 'active' : ''}`}
                      aria-pressed={onlyFavorites}
                      onClick={() => setOnlyFavorites((value) => !value)}
                    >
                      <Star size={14} fill={onlyFavorites ? 'currentColor' : 'none'} />
                      {onlyFavorites ? 'Todos' : 'Favoritos'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="pill-action"
                    onClick={() => setVisualGridMode((v) => !v)}
                  >
                    {visualGridMode ? <List size={14} /> : <Grid size={14} />}
                    {visualGridMode ? 'Compacto' : 'Con fotos'}
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={async () => {
                      if (!exName.trim()) {
                        setFormErrors((prev) => ({
                          ...prev,
                          name: 'Escribe abajo el nombre del ejercicio personalizado primero.',
                        }));
                        await showAlert({
                          title: 'Falta el nombre del ejercicio',
                          message: 'Escribe abajo el nombre del ejercicio personalizado primero.',
                        });
                        window.setTimeout(() => document.getElementById('exercise-name')?.focus(), 0);
                        return;
                      }
                      onSaveCustomExercise(activeCategory, exName.trim());
                    }}
                  >
                    + Guardar escrito
                  </button>
                </div>
              </div>

              {!filteredCatalog.length && (
                <p className="empty-inline">
                  No hay ejercicios que coincidan. Prueba otro nombre, equipo o grupo muscular.
                </p>
              )}
              {visualGridMode ? (
                <div className="visual-catalog-grid">
                  {filteredCatalog.map((item) => {
                    const customImgs = db.customExercisePhotos?.[item.name] || [];
                    const thumb = customImgs[0] || item.images[0];
                    const isSel = exName.trim().toLowerCase() === item.name.toLowerCase();
                    return (
                      <div
                        key={`${item.category}-${item.name}`}
                        className={`ex-visual-card ${isSel ? 'selected' : ''}`}
                      >
                        <button
                          type="button"
                          className="exercise-select-area"
                          aria-pressed={isSel}
                          onClick={() => pickExercise(item)}
                        >
                          <div className="ex-card-thumb-wrap">
                            {thumb ? (
                              <img src={thumb} alt={item.name} className="ex-card-thumb" loading="lazy" />
                            ) : (
                              <span className="exercise-no-photo">Sin imagen específica</span>
                            )}
                            <span className="ex-equip-tag">{item.equipment}</span>
                          </div>
                          <div className="ex-card-body">
                            <div className="ex-card-title">{item.name}</div>
                            <div className="ex-card-muscle">
                              {item.primaryMuscles.map((muscle) => MUSCLE_LABELS_ES[muscle]).join(' · ')}
                            </div>
                          </div>
                        </button>
                        {onToggleFavorite && (
                          <button
                            type="button"
                            className="icon-btn exercise-favorite"
                            aria-label={`${db.favoriteExercises.includes(item.name) ? 'Quitar de' : 'Agregar a'} favoritos: ${item.name}`}
                            aria-pressed={db.favoriteExercises.includes(item.name)}
                            onClick={() => onToggleFavorite(item.name)}
                          >
                            <Star size={16} fill={db.favoriteExercises.includes(item.name) ? 'currentColor' : 'none'} />
                          </button>
                        )}
                        <div>
                          <button
                            type="button"
                            className="ex-info-eye-btn"
                            title="Ver todas las imágenes y músculos"
                            onClick={(e) => {
                              e.stopPropagation();
                              pickExercise(item);
                              onOpenVisualModal(item);
                            }}
                          >
                            <Eye size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="exercise-chips-wrap">
                  {filteredCatalog.map((item) => (
                    <button
                      key={`${item.category}-${item.name}`}
                      type="button"
                      className={`ex-chip ${
                        exName.trim().toLowerCase() === item.name.toLowerCase() ? 'selected' : ''
                      }`}
                      onClick={() => pickExercise(item)}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 2. Nombre del ejercicio + Vista Previa Multi-Imagen en Vivo */}
          <div className="lbl">
            <span>2. Ejercicio seleccionado</span>
            <button
              type="button"
              className="pill-action"
              onClick={() => onOpenVisualModal(activeVisual)}
            >
              <Camera size={14} /> Ver {activePhotos.length} fotos y mapa muscular
            </button>
          </div>
          <input
            type="text"
            className="input-clean"
            id="exercise-name"
            aria-label="Nombre del ejercicio"
            aria-invalid={Boolean(formErrors.name)}
            placeholder="Ej. Bicicleta estática, Press de banca…"
            value={exName}
            onChange={(e) => {
              setExName(e.target.value);
              const exact = EXERCISE_CATALOG.find(
                (item) => item.name.toLocaleLowerCase('es') === e.target.value.trim().toLocaleLowerCase('es'),
              );
              if (exact) {
                setActiveCategory(exact.category);
                setMode(exact.mode);
              }
            }}
          />

          <div className="selected-ex-banner">
            <div className="dual-photo-strip">
              <button
                type="button"
                className="photo-frame"
                aria-label={`Abrir guía de ${activeVisual.name}`}
                onClick={() => onOpenVisualModal(activeVisual)}
              >
                {activePhotos[0] ? (
                  <img src={activePhotos[0]} alt="Posición inicial" />
                ) : (
                  <span className="exercise-no-photo">Agrega una foto propia</span>
                )}
                <span className="photo-step-badge">1. INICIO</span>
              </button>
              <button
                type="button"
                className="photo-frame"
                aria-label={`Abrir guía de ${activeVisual.name}`}
                onClick={() => onOpenVisualModal(activeVisual)}
              >
                {activePhotos[1] || activePhotos[0] ? (
                  <img src={activePhotos[1] || activePhotos[0]} alt="Posición final" />
                ) : (
                  <span className="exercise-no-photo">Sin imagen específica</span>
                )}
                <span className="photo-step-badge">2. EJECUCIÓN</span>
              </button>
            </div>
            <div className="detection-hint-row">
              <span>
                <strong style={{ color: 'var(--text-main)' }}>{activeVisual.equipment}:</strong>{' '}
                {activeVisual.detectionHint}
              </span>
            </div>
          </div>

          {/* Comparación de Cargas Automática con Entrenamientos Anteriores */}
          {previousStats && (
            <div className="load-compare-strip">
              <div className="ticket-meta">
                <div className="ticket-kicker" style={{ color: 'var(--accent-amber)' }}>
                  <Trophy size={14} /> Referencia previa ({previousStats.count} sesiones)
                </div>
                <div style={{ color: 'var(--text-main)', marginTop: 2 }}>
                  Última ({previousStats.last.date}):{' '}
                  {previousStats.last.mode === 'cardio' ? (
                    <strong>
                      {previousStats.last.minutes} min · {previousStats.last.distanceKm || 0} km
                    </strong>
                  ) : previousStats.last.mode === 'time' ? (
                    <strong>
                      {previousStats.last.sets} × {previousStats.last.seconds} seg
                    </strong>
                  ) : (
                    <>
                      <strong>
                        {previousStats.last.setDetails?.length
                          ? previousStats.last.setDetails
                              .map((set, index) => `S${index + 1}: ${set.reps}×${set.weight} kg`)
                              .join(' · ')
                          : `${previousStats.last.sets}×${previousStats.last.reps} con ${previousStats.last.weight || 0} kg`}
                      </strong>{' '}
                      · PR: <strong>{previousStats.prWeight} kg</strong>
                    </>
                  )}
                </div>
              </div>
              {previousStats.last.mode === 'strength' && (
                <button
                  type="button"
                  className="pill-action"
                  onClick={() => {
                    setStrSets(previousStats.last.sets || 4);
                    setStrReps(previousStats.last.reps || 10);
                    setStrWeight(previousStats.last.weight || 0);
                    setIndividualSets(Boolean(previousStats.last.setDetails?.length));
                    setSetDetails(previousStats.last.setDetails || []);
                  }}
                >
                  Usar carga
                </button>
              )}
            </div>
          )}

          {/* 3. Tipo de registro polimórfico */}
          <div className="lbl">
            <span>3. Modo de medición</span>
          </div>
          <div className="mode-switcher">
            <button
              type="button"
              className={`mode-card ${mode === 'strength' ? 'active' : ''}`}
              onClick={() => setMode('strength')}
            >
              <span className="m-title">Pesas</span>
              <span className="m-sub">Series × Reps × Kg</span>
            </button>
            <button
              type="button"
              className={`mode-card cardio-mode ${mode === 'cardio' ? 'active' : ''}`}
              onClick={() => setMode('cardio')}
            >
              <span className="m-title">Cardio / Bici</span>
              <span className="m-sub">Minutos y Km</span>
            </button>
            <button
              type="button"
              className={`mode-card ${mode === 'time' ? 'active' : ''}`}
              onClick={() => setMode('time')}
            >
              <span className="m-title">Tiempo / Abs</span>
              <span className="m-sub">Series × Seg</span>
            </button>
          </div>

          {/* Campos Polimórficos */}
          {mode === 'strength' && (
            <div className="grid-3">
              <div className="number-stepper">
                <div className="lbl">
                  <span>Series</span>
                </div>
                <div className="stepper-row">
                  <button type="button" className="step-circle" aria-label="Quitar serie de fuerza" disabled={strSets <= 1} onClick={() => handleStep(setStrSets, -1, 1, 30)}>
                    -
                  </button>
                  <input
                    type="number"
                    className="step-val-input"
                    aria-label="Series de fuerza"
                    aria-invalid={Boolean(formErrors.sets)}
                    aria-describedby={formErrors.sets ? 'exercise-error-strSets' : undefined}
                    max={30}
                    value={Number.isNaN(strSets) ? '' : strSets}
                    min={1}
                    onChange={(e) => setStrSets(e.target.value === '' ? Number.NaN : Number(e.target.value))}
                  />
                  <button type="button" className="step-circle" aria-label="Añadir serie de fuerza" disabled={strSets >= 30} onClick={() => handleStep(setStrSets, 1, 1, 30)}>
                    +
                  </button>
                </div>
                {formErrors.sets && <p id="exercise-error-strSets" className="field-error">Series: {formErrors.sets}</p>}
              </div>
              <div className="number-stepper">
                <div className="lbl">
                  <span>{individualSets ? 'Reps base' : 'Reps'}</span>
                </div>
                <div className="stepper-row">
                  <button type="button" className="step-circle" onClick={() => handleStep(setStrReps, -1, 1, 1000)}>
                    -
                  </button>
                  <input
                    type="number"
                    className="step-val-input"
                    aria-label="Repeticiones de fuerza"
                    aria-invalid={Boolean(formErrors.reps)}
                    aria-describedby={formErrors.reps ? 'exercise-error-strReps' : undefined}
                    max={1000}
                    value={Number.isNaN(strReps) ? '' : strReps}
                    min={1}
                    onChange={(e) => setStrReps(e.target.value === '' ? Number.NaN : Number(e.target.value))}
                  />
                  <button type="button" className="step-circle" onClick={() => handleStep(setStrReps, 1, 1, 1000)}>
                    +
                  </button>
                </div>
                {formErrors.reps && <p id="exercise-error-strReps" className="field-error">Repeticiones: {formErrors.reps}</p>}
              </div>
              <div className="number-stepper">
                <div className="lbl">
                  <span>{individualSets ? 'Peso base (kg)' : 'Peso (kg)'}</span>
                </div>
                <div className="stepper-row">
                  <button type="button" className="step-circle" onClick={() => handleStep(setStrWeight, -2.5, 0, 1500)}>
                    -
                  </button>
                  <input
                    type="number"
                    className="step-val-input"
                    aria-label="Peso de fuerza en kg"
                    aria-invalid={Boolean(formErrors.weight)}
                    aria-describedby={formErrors.weight ? 'exercise-error-strWeight' : undefined}
                    max={1500}
                    value={Number.isNaN(strWeight) ? '' : strWeight}
                    step={0.5}
                    min={0}
                    onChange={(e) => setStrWeight(e.target.value === '' ? Number.NaN : Number(e.target.value))}
                  />
                  <button type="button" className="step-circle" onClick={() => handleStep(setStrWeight, 2.5, 0, 1500)}>
                    +
                  </button>
                </div>
                {formErrors.weight && <p id="exercise-error-strWeight" className="field-error">Peso: {formErrors.weight}</p>}
              </div>
            </div>
          )}

          {mode === 'strength' && (
            <div className="strength-details">
              <label className="lbl">
                <input
                  type="checkbox"
                  checked={individualSets}
                  onChange={(event) => setIndividualSets(event.target.checked)}
                />{' '}
                Registrar peso y repeticiones por serie
              </label>
              {individualSets && (
                <>
                  <div className="strength-set" aria-hidden="true">
                    <span>Serie</span>
                    <span>Repeticiones</span>
                    <span>Peso (kg)</span>
                  </div>
                  {visibleSetDetails.map((set, index) => (
                    <div key={index}>
                      <div className="strength-set">
                        <strong>{index + 1}</strong>
                        <input
                          type="number"
                          aria-label={`Repeticiones serie ${index + 1}`}
                          aria-invalid={Boolean(formErrors[`reps-${index}`])}
                          min={1}
                          max={1000}
                          step={1}
                          value={Number.isNaN(set.reps) ? '' : set.reps}
                          onChange={(event) =>
                            setSetDetails((previous) =>
                              previous.map((item, i) =>
                                i === index
                                  ? { ...item, reps: event.target.value === '' ? Number.NaN : Number(event.target.value) }
                                  : item,
                              ),
                            )
                          }
                        />
                        <input
                          type="number"
                          aria-label={`Peso en kg serie ${index + 1}`}
                          aria-invalid={Boolean(formErrors[`weight-${index}`])}
                          min={0}
                          max={1500}
                          step="any"
                          value={Number.isNaN(set.weight) ? '' : set.weight}
                          onChange={(event) =>
                            setSetDetails((previous) =>
                              previous.map((item, i) =>
                                i === index
                                  ? { ...item, weight: event.target.value === '' ? Number.NaN : Number(event.target.value) }
                                  : item,
                              ),
                            )
                          }
                        />
                      </div>
                      {formErrors[`reps-${index}`] && (
                        <p className="field-error">
                          Serie {index + 1}, repeticiones: {formErrors[`reps-${index}`]}
                        </p>
                      )}
                      {formErrors[`weight-${index}`] && (
                        <p className="field-error">
                          Serie {index + 1}, peso: {formErrors[`weight-${index}`]}
                        </p>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {mode === 'cardio' && (
            <>
              <div className="preset-row">
                {[15, 20, 30, 45, 60].map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`mini-chip ${carMins === m ? 'active' : ''}`}
                    onClick={() => setCarMins(m)}
                  >
                    {m} min
                  </button>
                ))}
              </div>
              <div className="grid-3">
                <div className="number-stepper">
                  <div className="lbl">
                    <span>Minutos</span>
                  </div>
                  <div className="stepper-row">
                    <button type="button" className="step-circle" onClick={() => handleStep(setCarMins, -5, 1, 1440)}>
                      -
                    </button>
                    <input
                      type="number"
                      className="step-val-input"
                      aria-label="Minutos de cardio"
                      aria-invalid={Boolean(formErrors.minutes)}
                      aria-describedby={formErrors.minutes ? 'exercise-error-carMins' : undefined}
                      max={1440}
                      value={Number.isNaN(carMins) ? '' : carMins}
                      min={1}
                      onChange={(e) => setCarMins(e.target.value === '' ? Number.NaN : Number(e.target.value))}
                    />
                    <button type="button" className="step-circle" onClick={() => handleStep(setCarMins, 5, 1, 1440)}>
                      +
                    </button>
                  </div>
                  {formErrors.minutes && <p id="exercise-error-carMins" className="field-error">Minutos: {formErrors.minutes}</p>}
                </div>
                <div className="number-stepper">
                  <div className="lbl">
                    <span>Km (opc.)</span>
                  </div>
                  <div className="stepper-row">
                    <button type="button" className="step-circle" onClick={() => handleStep(setCarKm, -0.5, 0, 1000)}>
                      -
                    </button>
                    <input
                      type="number"
                      className="step-val-input"
                      aria-label="Distancia de cardio en km"
                      aria-invalid={Boolean(formErrors.distance)}
                      aria-describedby={formErrors.distance ? 'exercise-error-carKm' : undefined}
                      max={1000}
                      value={Number.isNaN(carKm) ? '' : carKm}
                      step={0.5}
                      min={0}
                      onChange={(e) => setCarKm(e.target.value === '' ? Number.NaN : Number(e.target.value))}
                    />
                    <button type="button" className="step-circle" onClick={() => handleStep(setCarKm, 0.5, 0, 1000)}>
                      +
                    </button>
                  </div>
                  {formErrors.distance && <p id="exercise-error-carKm" className="field-error">Distancia: {formErrors.distance}</p>}
                </div>
                <div className="number-stepper">
                  <div className="lbl">
                    <span>Ritmo</span>
                  </div>
                  <div className="stepper-row">
                    <input
                      type="text"
                      className="step-val-input"
                      aria-label="Intensidad del cardio"
                      value={carIntensity}
                      onChange={(e) => setCarIntensity(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {mode === 'time' && (
            <div className="grid-2">
              <div className="number-stepper">
                <div className="lbl">
                  <span>Series</span>
                </div>
                <div className="stepper-row">
                  <button type="button" className="step-circle" aria-label="Quitar serie por tiempo" disabled={timeSets <= 1} onClick={() => handleStep(setTimeSets, -1, 1, 30)}>
                    -
                  </button>
                  <input
                    type="number"
                    className="step-val-input"
                    aria-label="Series por duración"
                    aria-invalid={Boolean(formErrors.sets)}
                    aria-describedby={formErrors.sets ? 'exercise-error-timeSets' : undefined}
                    max={30}
                    value={Number.isNaN(timeSets) ? '' : timeSets}
                    min={1}
                    onChange={(e) => setTimeSets(e.target.value === '' ? Number.NaN : Number(e.target.value))}
                  />
                  <button type="button" className="step-circle" aria-label="Añadir serie por tiempo" disabled={timeSets >= 30} onClick={() => handleStep(setTimeSets, 1, 1, 30)}>
                    +
                  </button>
                </div>
                {formErrors.sets && <p id="exercise-error-timeSets" className="field-error">Series: {formErrors.sets}</p>}
              </div>
              <div className="number-stepper">
                <div className="lbl">
                  <span>Segundos</span>
                </div>
                <div className="stepper-row">
                  <button type="button" className="step-circle" onClick={() => handleStep(setTimeSecs, -15, 5, 86400)}>
                    -
                  </button>
                  <input
                    type="number"
                    className="step-val-input"
                    aria-label="Segundos por serie"
                    aria-invalid={Boolean(formErrors.seconds)}
                    aria-describedby={formErrors.seconds ? 'exercise-error-timeSecs' : undefined}
                    max={86400}
                    value={Number.isNaN(timeSecs) ? '' : timeSecs}
                    min={5}
                    onChange={(e) => setTimeSecs(e.target.value === '' ? Number.NaN : Number(e.target.value))}
                  />
                  <button type="button" className="step-circle" onClick={() => handleStep(setTimeSecs, 15, 5, 86400)}>
                    +
                  </button>
                </div>
                {formErrors.seconds && <p id="exercise-error-timeSecs" className="field-error">Segundos: {formErrors.seconds}</p>}
              </div>
            </div>
          )}

          <input
            type="text"
            className="input-clean"
            aria-label="Notas del ejercicio"
            maxLength={2000}
            placeholder="Nota opcional (ej. asiento nivel 4, subí 2.5 kg, buena técnica…)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div className="routine-values">
            <label>
              Fecha del registro
              <input
                type="date"
                value={recordDate}
                aria-invalid={Boolean(formErrors.date)}
                onChange={(event) => setRecordDate(event.target.value)}
              />
            </label>
            <label>
              Hora del registro
              <input
                type="time"
                value={recordTime}
                aria-invalid={Boolean(formErrors.time)}
                onChange={(event) => setRecordTime(event.target.value)}
              />
            </label>
            <label>
              Descanso (segundos)
              <input
                type="number"
                min={0}
                max={3600}
                step={1}
                value={Number.isNaN(restSeconds) ? '' : restSeconds}
                aria-invalid={Boolean(formErrors.rest)}
                onChange={(event) =>
                  setRestSeconds(event.target.value === '' ? Number.NaN : Number(event.target.value))
                }
              />
            </label>
          </div>
          {Object.keys(formErrors).length > 0 && (
            <div role="alert">
              {Object.entries(formErrors)
                .filter(([key]) => !key.startsWith('reps-') && !key.startsWith('weight-'))
                .map(([key, message]) => (
                  <p className="field-error" key={key}>
                    {(
                      {
                        name: 'Nombre',
                        date: 'Fecha',
                        time: 'Hora',
                        rest: 'Descanso',
                        sets: 'Series',
                        reps: 'Repeticiones',
                        weight: 'Peso',
                        minutes: 'Minutos',
                        distance: 'Distancia',
                        seconds: 'Segundos',
                        details: 'Detalle de series',
                      } as Record<string, string>
                    )[key]}
                    : {message}
                  </p>
                ))}
            </div>
          )}

          {mode !== 'cardio' && !editingId && (
            <div className="rest-toolbar" style={{ marginTop: 'var(--space-3)' }}>
              <label className="switch-row">
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Timer size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  Iniciar descanso al guardar manualmente
                </span>
                <input
                  type="checkbox"
                  checked={db.chrono.autoStartOnSet}
                  onChange={(e) => onToggleAutoRest(e.target.checked)}
                />
              </label>
              {onOpenChrono && (
                <button type="button" className="pill-action" onClick={onOpenChrono}>
                  <Timer size={15} /> Abrir reloj
                </button>
              )}
            </div>
          )}

          {mode !== 'cardio' && editingId === null && onStartGuidedWorkout && (
            <div className="guided-workout-start">
              <button type="button" className="btn-main" onClick={() => handleSubmit(true)}>
                <Play size={17} /> Iniciar entrenamiento guiado
              </button>
              <p className="block-subtitle">10 s de preparación. Confirma cada serie para iniciar su descanso. El ejercicio se guarda al completar todas las series.</p>
            </div>
          )}

          <button
            type="button"
            className={`btn-main ${mode === 'cardio' ? 'blue' : editingId ? 'amber' : onStartGuidedWorkout ? 'manual-save' : ''}`}
            onClick={() => handleSubmit()}
          >
            {editingId ? (
              <>
                <Check size={17} /> Guardar cambios del ejercicio
              </>
            ) : mode === 'cardio' ? (
              <>
                <Flame size={17} /> Guardar cardio / bici
              </>
            ) : (
              <>
                <Plus size={17} /> Guardar ejercicio
              </>
            )}
          </button>
        </section>
      )}

      {/* Lista de Ejercicios Registrados en el Día Activo */}
      <section className="card-cut" aria-labelledby="day-workouts-title">
        <div className="block-head">
          <div>
            <h3 id="day-workouts-title" className="block-title">
              Ejercicios registrados ({currentDate})
            </h3>
            <p className="block-subtitle">
              {dayWorkouts.length} {dayWorkouts.length === 1 ? 'registro' : 'registros'} en esta fecha
            </p>
          </div>
        </div>

        {dayWorkouts.length === 0 ? (
          <p className="empty-inline">
            Aún no hay ejercicios en esta fecha. Elige uno del catálogo o inicia una rutina para registrar tus resultados.
          </p>
        ) : (
          dayWorkouts.map((w) => {
            const vis = getExerciseVisualInfo(w.name, w.category, w.mode);
            const thumb = (db.customExercisePhotos?.[w.name] || [])[0] || vis.images[0];

            const prevWeight = previousComparableWorkout(db.workouts, w)?.weight ?? null;
            const deltaKg =
              w.mode === 'strength' && prevWeight !== null && typeof w.weight === 'number'
                ? Number((w.weight - prevWeight).toFixed(1))
                : null;

            return (
              <div
                key={w.id}
                className={`ticket-row ${w.mode === 'cardio' ? 'cardio' : ''}`}
              >
                <div className="workout-row-main">
                  <button
                    type="button"
                    className="workout-thumb-btn"
                    aria-label={`Ver guía de ${w.name}`}
                    onClick={() => onOpenVisualModal(vis)}
                  >
                    {thumb ? <img src={thumb} alt="" /> : <Dumbbell size={20} />}
                  </button>
                  <div className="ticket-body">
                    <div className="ticket-kicker">
                      <span>{w.category}</span>
                      {deltaKg !== null && deltaKg > 0 && (
                        <span className="overload-badge">
                          <TrendingUp size={11} /> +{deltaKg} kg
                        </span>
                      )}
                    </div>
                    <div className="ticket-title">{w.name}</div>
                    <div className="ticket-meta">
                      {w.mode === 'cardio' ? (
                        <>
                          <strong>{w.minutes} min</strong>
                          {w.distanceKm ? (
                            <>
                              {' '}
                              · <strong>{w.distanceKm} km</strong>
                            </>
                          ) : null}{' '}
                          · {w.intensity || 'Moderado'}
                        </>
                      ) : w.mode === 'time' ? (
                        <>
                          <strong>{w.sets} series</strong> × <strong>{w.seconds} seg</strong>
                        </>
                      ) : (
                        <>
                          {w.setDetails?.length ? (
                            <strong>{w.setDetails.length} series con cargas individuales</strong>
                          ) : (
                            <>
                              <strong>{w.sets} series</strong> × <strong>{w.reps} reps</strong>{' '}
                              {w.weight ? (
                                <>
                                  con <strong>{w.weight} kg</strong>
                                </>
                              ) : (
                                '(Corporal)'
                              )}
                            </>
                          )}
                        </>
                      )}
                      {w.setDetails?.length ? (
                        <div className="text-thin">
                          {w.setDetails.map((set, index) => (
                            <span key={index}>
                              Serie {index + 1}: {set.reps} × {set.weight} kg
                              {index < w.setDetails!.length - 1 ? ' · ' : ''}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {w.time && (
                        <div className="text-thin">
                          {w.time}
                          {w.restSeconds !== undefined ? ` · Descanso ${w.restSeconds} s` : ''}
                        </div>
                      )}
                      {w.notes ? <div className="ticket-notes">Nota: {w.notes}</div> : null}
                    </div>
                  </div>
                </div>

                <div className="row-actions">
                  <button
                    type="button"
                    className="icon-btn"
                    title="Editar registro"
                    onClick={() => startEditing(w)}
                  >
                    <Edit3 size={15} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Repetir / Duplicar"
                    onClick={() => onDuplicateWorkout(w)}
                  >
                    <Copy size={15} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn danger"
                    title="Eliminar"
                    onClick={() => onDeleteWorkout(w.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
};
