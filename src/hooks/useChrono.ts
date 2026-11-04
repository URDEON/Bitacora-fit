import { useCallback, useEffect, useRef, useState } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import type { AlarmSoundType, PersistedChronoState } from '../types';
import { pauseChrono, readChrono, resetChrono, startChrono } from '../services/chronoEngine';
import { cancelBackgroundTimerAlarm, fireWebNotificationIfHidden, playAlarmSound, scheduleBackgroundTimerAlarm, setScreenWakeLock, unlockAudioContext } from '../services/audioAndNotifications';

interface Options {
  chrono: PersistedChronoState;
  alarmType: AlarmSoundType;
  onChange: (next: PersistedChronoState) => void;
  onNotify?: (message: string) => void;
}

/**
 * Lógica del reloj. No renderiza con frecuencia: las transiciones (fin de descanso, cambio de fase HIIT)
 * se programan con un temporizador hacia el próximo límite calculado con el reloj del sistema, y se
 * reevalúan al volver a primer plano. La lectura visual del tiempo vive en los componentes que la muestran
 * (ver `useTicker`), por lo que el componente raíz no se renderiza diez veces por segundo.
 */
export function useChrono({ chrono, alarmType, onChange, onNotify }: Options) {
  const [alarmFlash, setAlarmFlash] = useState(false);
  const [message, setMessage] = useState('');
  const current = useRef(chrono);
  const notify = useRef(onNotify);
  const update = useRef(onChange);
  const alarm = useRef(alarmType);
  const settleRef = useRef<() => void>(() => {});
  const flashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  current.current = chrono;
  notify.current = onNotify;
  update.current = onChange;
  alarm.current = alarmType;

  const commit = useCallback((next: PersistedChronoState) => {
    current.current = next;
    update.current(next);
  }, []);

  // Evalúa el estado con el reloj actual y programa la próxima transición.
  useEffect(() => {
    if (!chrono.running) { settleRef.current = () => {}; return; }
    let timer: number | undefined;
    let disposed = false;
    const settle = () => {
      if (disposed) return;
      window.clearTimeout(timer);
      const state = current.current;
      if (!state.running) return;
      const now = Date.now();
      const reading = readChrono(state, now);
      if (reading.completed) {
        const next = state.mode === 'countdown' ? resetChrono(state) : pauseChrono(state, now);
        commit({ ...next, hiitCurrentRound: reading.round, hiitPhase: reading.phase });
        const text = state.mode === 'hiit' ? 'Sesión HIIT terminada.' : 'Descanso terminado. Listo para repetir.';
        setMessage(text);
        notify.current?.(text);
        void playAlarmSound(alarm.current);
        fireWebNotificationIfHidden('Bitácora Fit Pro', text);
        setAlarmFlash(true);
        if (flashTimeout.current) clearTimeout(flashTimeout.current);
        flashTimeout.current = setTimeout(() => setAlarmFlash(false), 2500);
        return;
      }
      if (state.mode === 'hiit' && (state.hiitPhase !== reading.phase || state.hiitCurrentRound !== reading.round)) {
        commit({ ...state, hiitPhase: reading.phase, hiitCurrentRound: reading.round });
        void playAlarmSound(alarm.current);
        return; // el nuevo estado vuelve a ejecutar este efecto y reprograma
      }
      if (reading.nextBoundaryEpochMs !== null) {
        timer = window.setTimeout(settle, Math.max(0, reading.nextBoundaryEpochMs - Date.now()) + 5);
      }
    };
    settleRef.current = settle;
    settle();
    return () => { disposed = true; window.clearTimeout(timer); };
  }, [chrono, commit]);

  // Al volver a primer plano se reevalúa de inmediato (los temporizadores pueden retrasarse en segundo plano).
  useEffect(() => {
    if (!chrono.running) return;
    const onVisibility = () => {
      settleRef.current();
      if (!document.hidden && current.current.keepScreenAwake) void setScreenWakeLock(true);
    };
    document.addEventListener('visibilitychange', onVisibility);
    let removeNative: (() => Promise<void>) | undefined;
    let disposed = false;
    if (Capacitor.isNativePlatform()) {
      void App.addListener('appStateChange', ({ isActive }) => {
        settleRef.current();
        if (isActive && current.current.keepScreenAwake) void setScreenWakeLock(true);
      }).then(handle => { if (disposed) void handle.remove(); else removeNative = () => handle.remove(); });
    }
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void removeNative?.();
    };
  }, [chrono.running]);

  // Program only on a state transition, never on a display tick. Android may delay
  // delivery during battery restrictions; the clock still catches up on resume.
  useEffect(() => {
    const value = readChrono(chrono, Date.now());
    if (chrono.running && value.nextBoundaryEpochMs) {
      void scheduleBackgroundTimerAlarm(value.nextBoundaryEpochMs, 'Bitácora Fit Pro', chrono.mode === 'hiit' ? 'Cambio de intervalo HIIT' : 'Tu descanso ha terminado.');
    } else {
      void cancelBackgroundTimerAlarm();
    }
    void setScreenWakeLock(chrono.keepScreenAwake && chrono.running);
  }, [chrono.running, chrono.mode, chrono.startedAtEpochMs, chrono.accumulatedElapsedMs, chrono.initialSelectedMs, chrono.hiitPhase, chrono.hiitCurrentRound, chrono.hiitWorkSec, chrono.hiitRestSec, chrono.hiitTotalRounds, chrono.keepScreenAwake]);

  useEffect(() => () => {
    if (flashTimeout.current) clearTimeout(flashTimeout.current);
    void setScreenWakeLock(false);
  }, []);

  const clearFeedback = () => { setMessage(''); setAlarmFlash(false); };
  const onToggleStartPause = () => {
    unlockAudioContext();
    clearFeedback();
    const state = current.current;
    commit(state.running ? pauseChrono(state) : startChrono(state));
  };
  const onReset = () => { clearFeedback(); commit(resetChrono(current.current)); };
  const onSwitchMode = (mode: PersistedChronoState['mode']) => {
    clearFeedback(); commit({ ...resetChrono(current.current), mode });
  };
  const onSelectInitialSeconds = (seconds: number) => {
    if (!Number.isInteger(seconds) || seconds < 1 || seconds > 5999) {
      notify.current?.('El descanso debe durar entre 1 y 5999 segundos.'); return;
    }
    clearFeedback(); commit({ ...resetChrono(current.current), initialSelectedMs: seconds * 1000 });
  };
  const onAdjustLiveSeconds = (deltaSec: number) => {
    const state = current.current;
    const nextMs = state.initialSelectedMs + deltaSec * 1000;
    if (nextMs < 1000 || nextMs > 5_999_000 || nextMs <= readChrono(state).elapsedMs) {
      notify.current?.('El tiempo total debe superar el transcurrido y estar entre 1 y 5999 segundos.'); return;
    }
    commit({ ...state, initialSelectedMs: nextMs });
  };
  const onAddLap = () => {
    const state = current.current;
    const elapsed = readChrono(state).elapsedMs;
    if (elapsed > 0) commit({ ...state, laps: [elapsed, ...state.laps] });
  };
  const onUpdateHiitConfig = (workSec: number, restSec: number, rounds: number) => {
    if (![workSec, restSec, rounds].every(Number.isInteger) || workSec < 1 || workSec > 3600 || restSec < 1 || restSec > 3600 || rounds < 1 || rounds > 100) {
      notify.current?.('HIIT: trabajo y descanso de 1 a 3600 segundos; de 1 a 100 rondas.'); return;
    }
    clearFeedback(); commit({ ...resetChrono(current.current), hiitWorkSec: workSec, hiitRestSec: restSec, hiitTotalRounds: rounds });
  };
  const onToggleWakeLock = async (enabled: boolean) => {
    const ok = await setScreenWakeLock(enabled && current.current.running);
    commit({ ...current.current, keepScreenAwake: enabled });
    if (enabled && current.current.running && !ok) notify.current?.('Este dispositivo no permite mantener la pantalla activa. Revisa sus ajustes de suspensión.');
  };
  const startRest = (seconds = Math.round(current.current.initialSelectedMs / 1000)) => {
    if (!Number.isInteger(seconds) || seconds < 1 || seconds > 5999) return;
    unlockAudioContext(); clearFeedback();
    commit(startChrono({ ...resetChrono(current.current), mode: 'countdown', initialSelectedMs: seconds * 1000 }));
  };
  const statusMessage = message || (chrono.running
    ? chrono.mode === 'countdown' ? 'DESCANSO EN CURSO' : chrono.mode === 'hiit' ? (chrono.hiitPhase === 'work' ? 'TRABAJO' : 'DESCANSO') : 'CRONÓMETRO EN CURSO'
    : chrono.accumulatedElapsedMs > 0 ? 'PAUSADO' : 'LISTO PARA INICIAR');

  return { statusMessage, alarmFlash,
    onToggleStartPause, onReset, onSwitchMode, onSelectInitialSeconds, onAdjustLiveSeconds, onAddLap, onUpdateHiitConfig, onToggleWakeLock, startRest };
}
