import { useMemo } from 'react';
import { ArrowRight, Dumbbell, Droplets, Timer, Utensils, Play, History } from 'lucide-react';
import type { ActiveTab, BitacoraDB, WorkoutEntry } from '../types';
import { dateLabel, localDate } from '../services/dates';
import { selectHomeMetrics } from '../services/homeMetrics';
import { MetricCarousel } from './MetricCarousel';

interface Props {
  db: BitacoraDB;
  currentDate: string;
  onNavigate: (tab: ActiveTab) => void;
  onWater: () => void;
  onRest: () => void;
}
function workoutDetail(workout: WorkoutEntry): string {
  if (workout.mode === 'cardio') return `${workout.minutes ?? 0} min · ${workout.distanceKm ?? 0} km`;
  if (workout.mode === 'time') return `${workout.sets ?? 0} series · ${workout.seconds ?? 0} s`;
  return `${workout.sets ?? 0} series · ${workout.reps ?? 0} rep · ${workout.weight ?? 0} kg`;
}

export function HomeView({ db, currentDate, onNavigate, onWater, onRest }: Props) {
  const metrics = useMemo(() => selectHomeMetrics(db, currentDate), [db, currentDate]);
  const workouts = db.workouts.filter(workout => workout.date === currentDate);
  const last = useMemo(() => [...db.workouts]
    .filter(workout => workout.date <= currentDate)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.time || '').localeCompare(a.time || '') || b.id - a.id)[0], [db.workouts, currentDate]);
  const session = db.activeSession;
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
          <MetricCarousel metrics={metrics} onNavigate={onNavigate} />
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
