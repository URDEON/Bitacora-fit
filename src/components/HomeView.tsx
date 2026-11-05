import { useMemo } from 'react';
import { ArrowRight, ChartNoAxesColumn, Dumbbell, Droplets, NotebookPen, Timer, Utensils, Play, History } from 'lucide-react';
import type { ActiveTab, BitacoraDB, WorkoutEntry } from '../types';
import { dateLabel, localDate } from '../services/dates';
import { selectHomeMetrics } from '../services/homeMetrics';
import { selectMetricHistories } from '../services/metricHistory';
import { personalSummary, type PersonalData } from '../services/personalData';
import { MetricCarousel } from './MetricCarousel';

interface Props {
  db: BitacoraDB;
  currentDate: string;
  onNavigate: (tab: ActiveTab) => void;
  onWater: () => void;
  onRest: () => void;
  personalData?: PersonalData;
}
function workoutDetail(workout: WorkoutEntry): string {
  if (workout.mode === 'cardio') return `${workout.minutes ?? 0} min · ${workout.distanceKm ?? 0} km`;
  if (workout.mode === 'time') return `${workout.sets ?? 0} series · ${workout.seconds ?? 0} s`;
  return `${workout.sets ?? 0} series · ${workout.reps ?? 0} rep · ${workout.weight ?? 0} kg`;
}

export function HomeView({ db, currentDate, onNavigate, onWater, onRest, personalData }: Props) {
  const metrics = useMemo(() => selectHomeMetrics(db, currentDate), [db, currentDate]);
  const histories = useMemo(() => selectMetricHistories(db, currentDate), [db, currentDate]);
  const workouts = db.workouts.filter(workout => workout.date === currentDate);
  const last = useMemo(() => [...db.workouts]
    .filter(workout => workout.date <= currentDate)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.time || '').localeCompare(a.time || '') || b.id - a.id)[0], [db.workouts, currentDate]);
  const session = db.activeSession;
  const personal = useMemo(() => personalData ? personalSummary(personalData, currentDate.slice(0, 7)) : null, [personalData, currentDate]);
  const pendingTasks = personalData?.notes.flatMap(note => note.tasks.filter(task => !task.done).map(task => ({ ...task, note: note.title }))) ?? [];
  const heroState = session ? 'active' : last ? 'recent' : 'empty';
  const title = session ? session.title : last ? last.name : 'Tu próxima sesión';
  const detail = session
    ? `${session.completedIds.length} de ${session.exercises.length} ejercicios registrados`
    : last ? `${dateLabel(last.date)} · ${workoutDetail(last)}` : 'Elige un ejercicio o una de tus rutinas.';
  return (
    <div className="fade-view home-view home-redesign">
      <div className="page-heading">
        <p className="eyebrow">BITÁCORA PERSONAL</p>
        <h1>{currentDate === localDate() ? 'Tu día.' : 'Tu bitácora.'}</h1>
        <p className="home-date">{dateLabel(currentDate)} · {workouts.length} {workouts.length === 1 ? 'ejercicio registrado' : 'ejercicios registrados'}</p>
      </div>
      <div className="home-focus">
        <div className="home-measurements">
          <div className="section-heading">
            <h2 id="day-progress">El día en números</h2>
            <button className="text-button" onClick={() => onNavigate('export')}>Editar objetivos</button>
          </div>
          <MetricCarousel metrics={metrics} histories={histories} onNavigate={onNavigate} />
        </div>
        <section className="home-hero home-training" data-state={heroState} aria-labelledby="hero-title">
          <div className="home-training-label">
            {session ? <Play size={18} aria-hidden="true" /> : last ? <History size={18} aria-hidden="true" /> : <Dumbbell size={18} aria-hidden="true" />}
            <p className="eyebrow">{session ? 'Sesión en curso' : last ? 'Último entrenamiento' : 'Entrenamiento'}</p>
          </div>
          <h2 id="hero-title">{title}</h2>
          <p className="home-training-detail">{detail}</p>
          {session && session.exercises.length > 0 && <progress className="home-session-progress" aria-label="Ejercicios registrados en la sesión" max={session.exercises.length} value={session.completedIds.length} />}
          <button className="hero-action" onClick={() => onNavigate('exercises')}>
            <span>{session ? 'Continuar sesión' : last ? 'Registrar ejercicio' : 'Comenzar a entrenar'}</span><ArrowRight size={19} aria-hidden="true" />
          </button>
          {last && <button className="text-button home-history-link" onClick={() => onNavigate('progress')}>Ver progreso <ArrowRight size={14} aria-hidden="true" /></button>}
        </section>
      </div>
      {personalData && <section className="home-personal" aria-label="Finanzas y notas">
        <button type="button" className="home-personal-row" data-module="finance" onClick={() => onNavigate('finance')}><ChartNoAxesColumn size={21} aria-hidden="true" /><span><strong>Finanzas</strong><small>{personalData.transactions.length ? `Balance · ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(personal?.balance ?? 0)}` : 'Ingresos, gastos y movimientos'}</small></span><ArrowRight size={18} aria-hidden="true" /></button>
        <button type="button" className="home-personal-row" data-module="notes" onClick={() => onNavigate('notes')}><NotebookPen size={21} aria-hidden="true" /><span><strong>Notas y tareas</strong><small>{personalData.notes.length ? `${personalData.notes.length} notas · ${pendingTasks.length} pendientes` : 'Un lugar para tus ideas y pendientes'}</small></span><ArrowRight size={18} aria-hidden="true" /></button>
        {pendingTasks.length > 0 && <ul className="home-pending-tasks">{pendingTasks.slice(0, 3).map(task => <li key={task.id}><span aria-hidden="true" className="home-task-dot" /><span>{task.text}</span></li>)}</ul>}
      </section>}
      <section className="home-band" aria-labelledby="quick-title">
        <h2 id="quick-title" className="section-title">Anotar ahora</h2>
        <div className="quick-actions home-quick-actions">
          <button onClick={() => onNavigate('exercises')}><Dumbbell aria-hidden="true" /><span>Ejercicio</span></button>
          <button onClick={() => onNavigate('meals')}><Utensils aria-hidden="true" /><span>Comida</span></button>
          <button onClick={onWater}><Droplets aria-hidden="true" /><span>Agua +250 ml</span></button>
          <button onClick={onRest}><Timer aria-hidden="true" /><span>Descanso 90 s</span></button>
        </div>
      </section>
      <p className="local-note">Tus registros se guardan en este dispositivo. Crea una copia de seguridad desde Ajustes.</p>
    </div>
  );
}
