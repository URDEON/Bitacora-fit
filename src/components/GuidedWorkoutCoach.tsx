import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { AlarmSoundType, WorkoutEntry } from '../types';
import { App as NativeApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useDialog } from './ConfirmDialog';
import { useTicker } from '../hooks/useTicker';
import { fireWebNotificationIfHidden, playAlarmSound, unlockAudioContext } from '../services/audioAndNotifications';
import { advanceGuidedWorkout, createGuidedWorkout, finishGuidedSet, GUIDED_WORKOUT_KEY, guidedDisplayMs, parseGuidedWorkout, toggleGuidedPause, type GuidedWorkout } from '../services/guidedWorkout';

export interface GuidedWorkoutHandle { start: (entry: WorkoutEntry) => Promise<void>; }
interface Props {
  alarmType: AlarmSoundType;
  onBegin: () => void;
  onComplete: (entry: WorkoutEntry) => void;
}
const labels = { preparing: 'Preparación', work: 'Haga el ejercicio', rest: 'Descanso', complete: 'Entrenamiento completo' };

export const GuidedWorkoutCoach = forwardRef<GuidedWorkoutHandle, Props>(function GuidedWorkoutCoach({ alarmType, onBegin, onComplete }, ref) {
  const [state, setState] = useState<GuidedWorkout | null>(() => {
    try { return parseGuidedWorkout(localStorage.getItem(GUIDED_WORKOUT_KEY)); } catch { return null; }
  });
  const [storageWarning, setStorageWarning] = useState(false);
  const current = useRef(state);
  const completedId = useRef<number | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const { confirm } = useDialog();
  const commit = useCallback((next: GuidedWorkout | null) => {
    current.current = next;
    setState(next);
    try {
      if (next) localStorage.setItem(GUIDED_WORKOUT_KEY, JSON.stringify(next));
      else localStorage.removeItem(GUIDED_WORKOUT_KEY);
      setStorageWarning(false);
    } catch { setStorageWarning(true); }
  }, []);

  useImperativeHandle(ref, () => ({
    async start(entry) {
      unlockAudioContext();
      if (current.current && current.current.phase !== 'complete' && !await confirm({
        title: 'Hay un entrenamiento en curso',
        message: '¿Reemplazarlo? Las series de este entrenamiento no se guardarán.',
        confirmLabel: 'Reemplazar entrenamiento', tone: 'danger',
      })) return;
      onBegin();
      commit(createGuidedWorkout(entry));
      // Wait for React to mount the heading before moving focus to the coach.
      requestAnimationFrame(() => {
        heading.current?.focus({ preventScroll: true });
        heading.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    },
  }), [commit, confirm, onBegin]);

  useTicker(Boolean(state && state.phase !== 'complete' && state.pausedAt === null), 200);
  useEffect(() => {
    if (!state || state.phase === 'complete' || state.pausedAt !== null) return;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const settle = () => {
      const previous = current.current;
      if (!previous) return;
      const next = advanceGuidedWorkout(previous);
      if (next !== previous) {
        commit(next);
        void playAlarmSound(alarmType);
        fireWebNotificationIfHidden('Bitácora Fit Pro', 'Haga el ejercicio. Confirma cuando termines la serie.');
      }
    };
    settle();
    if (state.deadline !== null) timeout = setTimeout(settle, Math.max(0, state.deadline - Date.now()) + 5);
    document.addEventListener('visibilitychange', settle);
    let disposed = false;
    let removeNative: (() => Promise<void>) | undefined;
    if (Capacitor.isNativePlatform()) void NativeApp.addListener('appStateChange', settle).then(handle => {
      if (disposed) void handle.remove(); else removeNative = () => handle.remove();
    });
    return () => {
      disposed = true;
      clearTimeout(timeout);
      document.removeEventListener('visibilitychange', settle);
      void removeNative?.();
    };
  }, [state, commit, alarmType]);

  useEffect(() => {
    if (state?.phase === 'complete' && !state.recorded && completedId.current !== state.entry.id) {
      completedId.current = state.entry.id;
      onComplete(state.entry);
      commit({ ...state, recorded: true });
    }
  }, [state, onComplete, commit]);

  if (!state) return null;
  const paused = state.pausedAt !== null;
  const seconds = state.deadline === null ? Math.floor(guidedDisplayMs(state) / 1000) : Math.ceil(guidedDisplayMs(state) / 1000);
  const digits = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  const target = state.entry.setDetails?.[state.set - 1];
  const finish = () => {
    const previous = current.current;
    if (!previous) return;
    const next = finishGuidedSet(previous);
    if (next === previous) return;
    commit(next);
    if (next.phase === 'complete') void playAlarmSound(alarmType);
  };
  return (
    <section className="guided-workout" data-phase={state.phase} aria-labelledby="guided-title">
      <div className="guided-workout-heading">
        <p className="eyebrow">ENTRENAMIENTO GUIADO</p>
        <h2 id="guided-title" ref={heading} tabIndex={-1} aria-live="polite">{paused ? 'Entrenamiento en pausa' : labels[state.phase]}</h2>
        <p>{state.entry.name}</p>
      </div>
      <div className="guided-workout-readout">
        <strong role="timer" aria-label={state.phase === 'work' ? 'Tiempo en ejercicio' : 'Tiempo restante de la fase'}>{state.phase === 'complete' ? 'LISTO' : digits}</strong>
        <span>Serie {state.set} de {state.entry.sets}</span>
      </div>
      <div className="guided-set-track" aria-label={`${state.phase === 'complete' ? state.set : state.set - 1} series terminadas de ${state.entry.sets}`}>
        {Array.from({ length: state.entry.sets! }, (_, i) => <span key={i} data-done={state.phase === 'complete' || i < state.set - 1} data-current={state.phase !== 'complete' && i === state.set - 1} />)}
      </div>
      <p>{state.phase === 'preparing' ? 'Ponte en posición. El ejercicio comienza al terminar la preparación.'
        : state.phase === 'rest' ? 'Recupera el aire. La siguiente serie empieza al terminar el descanso.'
        : state.phase === 'complete' ? 'Todas las series terminadas. El ejercicio se ha añadido a tu bitácora.'
        : state.entry.mode === 'strength' ? `${target?.reps ?? state.entry.reps} repeticiones · ${target?.weight ?? state.entry.weight ?? 0} kg. Pulsa «Terminé la serie» cuando acabes.`
        : `Objetivo: ${state.entry.seconds} segundos. Pulsa «Terminé la serie» cuando acabes.`}</p>
      {storageWarning && <p role="alert">No pudimos conservar el entrenamiento en este dispositivo. No cierres la app hasta terminar.</p>}
      <div className="guided-workout-actions">
        {state.phase === 'work' && <button className="btn-main" disabled={paused} onClick={finish}>Terminé la serie</button>}
        {state.phase !== 'complete' && <button className="pill-action" onClick={() => {
          const previous = current.current;
          if (previous) commit(toggleGuidedPause(advanceGuidedWorkout(previous)));
        }}>{paused ? 'Reanudar entrenamiento' : 'Pausar entrenamiento'}</button>}
        {state.phase === 'rest' && !paused && <button className="pill-action" onClick={() => {
          const previous = current.current;
          if (previous?.phase === 'rest') commit({ ...previous, phase: 'work', phaseStartedAt: Date.now(), deadline: null });
        }}>Omitir descanso</button>}
        <button className="text-button" onClick={async () => {
          if (state.phase === 'complete' || await confirm({ title: 'Cancelar entrenamiento', message: 'Las series de este entrenamiento no se guardarán. ¿Quieres cancelarlo?', confirmLabel: 'Cancelar entrenamiento', tone: 'danger' })) commit(null);
        }}>{state.phase === 'complete' ? 'Cerrar entrenamiento' : 'Cancelar entrenamiento'}</button>
      </div>
    </section>
  );
});
