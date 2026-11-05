import React, { useEffect, useId, useState } from 'react';
import {
  BellRing,
  Coffee,
  Flag,
  Flame,
  Lock,
  Pause,
  Play,
  RotateCcw,
  Send,
  Sun,
  Timer,
  Volume2,
} from 'lucide-react';
import { AlarmSoundType, PersistedChronoState } from '../types';
import { ensureNotificationSetup, playAlarmSound } from '../services/audioAndNotifications';
import { readChrono } from '../services/chronoEngine';
import { useTicker } from '../hooks/useTicker';
import { useDialog } from './ConfirmDialog';
import '../styles/chrono.css';

interface ChronoViewProps {
  chrono: PersistedChronoState;
  alarmType: AlarmSoundType;
  /** Verdadero cuando la vista está visible: solo entonces se actualiza la lectura del reloj. */
  active: boolean;
  statusMessage: string;
  alarmFlash: boolean;
  onToggleStartPause: () => void;
  onReset: () => void;
  onSwitchMode: (mode: 'countdown' | 'stopwatch' | 'hiit') => void;
  onSelectInitialSeconds: (seconds: number) => void;
  onAdjustLiveSeconds: (deltaSec: number) => void;
  onAddLap: () => void;
  onSendToCardio: (minutes: number) => void;
  onUpdateHiitConfig: (workSec: number, restSec: number, rounds: number) => void;
  onChangeAlarmType: (type: AlarmSoundType) => void;
  onToggleWakeLock: (enabled: boolean) => void;
}

export function formatMsClock(ms: number): string {
  const safe = Number.isFinite(ms) ? Math.max(0, ms) : 0;
  const totalSeconds = Math.floor(safe / 1000);
  const mins = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const secs = String(totalSeconds % 60).padStart(2, '0');
  const tenths = Math.floor((safe % 1000) / 100);
  return `${mins}:${secs}.${tenths}`;
}

export function formatMinSecShort(ms: number): string {
  const totalSeconds = Number.isFinite(ms) ? Math.max(0, Math.round(ms / 1000)) : 0;
  const mins = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const secs = String(totalSeconds % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

const PRESET_REST_SECONDS = [
  { label: '0:30 seg', sec: 30 },
  { label: '0:45 seg', sec: 45 },
  { label: '1:00 min', sec: 60 },
  { label: '1:30 min', sec: 90 },
  { label: '2:00 min', sec: 120 },
  { label: '3:00 min', sec: 180 },
  { label: '5:00 min', sec: 300 },
];
const DIAL_TICKS = Array.from({ length: 60 }, (_, index) => index);

function ValidatedStepper({ label, value, min, max, step = 1, onValue }: {
  label: string; value: number; min: number; max: number; step?: number; onValue: (value: number) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState('');
  useEffect(() => { setDraft(String(value)); setError(''); }, [value]);
  const apply = () => {
    const number = Number(draft);
    if (draft.trim() === '' || !Number.isInteger(number) || number < min || number > max) {
      setError(`Introduce un entero de ${min} a ${max}.`); return;
    }
    setError(''); onValue(number);
  };
  return <div className="number-stepper">
    <label className="lbl" htmlFor={id}>{label}</label>
    <div className="stepper-row">
      <button type="button" className="step-circle" aria-label={`Reducir ${label}`} disabled={value <= min} onClick={() => onValue(Math.max(min, value - step))}>−</button>
      <input id={id} type="number" className="step-val-input" min={min} max={max} step={1} inputMode="numeric" required
        value={draft} onChange={e => { setDraft(e.target.value); setError(''); }} onBlur={apply}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} />
      <button type="button" className="step-circle" aria-label={`Aumentar ${label}`} disabled={value >= max} onClick={() => onValue(Math.min(max, value + step))}>+</button>
    </div>
    {error && <p id={`${id}-error`} role="alert" className="field-error">{error}</p>}
  </div>;
}

function CountdownDurationEditor({ milliseconds, onApply }: { milliseconds: number; onApply: (seconds: number) => void }) {
  const [minutes, setMinutes] = useState(Math.floor(milliseconds / 60000));
  const [seconds, setSeconds] = useState(Math.round(milliseconds / 1000) % 60);
  const [error, setError] = useState('');
  useEffect(() => { setMinutes(Math.floor(milliseconds / 60000)); setSeconds(Math.round(milliseconds / 1000) % 60); setError(''); }, [milliseconds]);
  return <form onSubmit={event => {
    event.preventDefault();
    const duration = minutes * 60 + seconds;
    if (duration < 1 || duration > 5999) { setError('La duración debe ser de 1 segundo a 99 minutos y 59 segundos.'); return; }
    setError(''); onApply(duration);
  }}>
    <div className="grid-2 measurement-controls">
      <ValidatedStepper label="Minutos iniciales" value={minutes} min={0} max={99} onValue={setMinutes} />
      <ValidatedStepper label="Segundos iniciales" value={seconds} min={0} max={59} step={5} onValue={setSeconds} />
    </div>
    {error && <p className="field-error" role="alert">{error}</p>}
    <button type="submit" className="btn-main subtle">Aplicar duración</button>
  </form>;
}

export const ChronoView: React.FC<ChronoViewProps> = ({
  chrono,
  alarmType,
  active,
  statusMessage,
  alarmFlash,
  onToggleStartPause,
  onReset,
  onSwitchMode,
  onSelectInitialSeconds,
  onAdjustLiveSeconds,
  onAddLap,
  onSendToCardio,
  onUpdateHiitConfig,
  onChangeAlarmType,
  onToggleWakeLock,
}) => {
  const initTotalSecs = Math.round(chrono.initialSelectedMs / 1000);
  const { alert: showAlert } = useDialog();
  // La lectura del reloj se refresca aquí (y no en App) solo mientras corre y la vista es visible.
  useTicker(chrono.running && active, 100);
  const reading = readChrono(chrono, Date.now());
  const displayMs = reading.displayMs;
  const progressPct = reading.progressPct;
  const modeIndex = chrono.mode === 'countdown' ? 0 : chrono.mode === 'stopwatch' ? 1 : 2;
  const modeTitle = chrono.mode === 'countdown' ? 'Descanso' : chrono.mode === 'stopwatch' ? 'Tiempo libre' : 'Intervalos';
  const phaseTitle = chrono.mode === 'hiit'
    ? reading.completed ? 'Sesión completada' : reading.phase === 'work' ? 'Trabajo' : 'Recupera'
    : chrono.mode === 'countdown' ? 'Recupera el ritmo' : 'A tu ritmo';
  const dialKey = `${chrono.mode}-${chrono.mode === 'hiit' ? reading.phase : 'continuous'}`;
  const clock = formatMsClock(displayMs);
  const dialProgress = Math.max(0, Math.min(100, progressPct));
  // La vuelta del segundero representa un minuto real, no un objetivo inventado.
  const sweepDegrees = reading.elapsedMs / 60000 * 360;
  const canResume = reading.elapsedMs > 0 && !reading.completed;
  const PhaseIcon = chrono.mode === 'countdown' || (chrono.mode === 'hiit' && reading.phase === 'rest')
    ? Coffee : chrono.mode === 'hiit' ? Flame : Timer;

  return (
    <div className="fade-view chrono-view" data-mode={chrono.mode} data-phase={reading.phase} data-running={chrono.running}>
      <section className="card-soft chrono-main" aria-labelledby="chrono-main-title">
        <div className="block-head sr-only">
          <div>
            <h2 id="chrono-main-title" className="block-title">
              <Timer size={18} /> Tu tiempo, tu ritmo
            </h2>
            <p className="block-subtitle">
              Descansos, cardio e intervalos. Para seguir tus series, inicia un entrenamiento guiado desde Entrenar.
            </p>
          </div>
        </div>

        {/* Selector de 3 modos: Descanso, Cronómetro Libre e Intervalos HIIT */}
        <div className="mode-switcher" role="group" aria-label="Modo del cronómetro"
          style={{ '--chrono-tab-index': modeIndex } as React.CSSProperties}>
          <button
            type="button"
            className={`mode-card ${chrono.mode === 'countdown' ? 'active' : ''}`}
            aria-pressed={chrono.mode === 'countdown'}
            onClick={() => onSwitchMode('countdown')}
          >
            <span className="m-title">Descanso</span>
            <span className="m-sub">Cuenta atrás</span>
          </button>
          <button
            type="button"
            className={`mode-card cardio-mode ${chrono.mode === 'stopwatch' ? 'active' : ''}`}
            aria-pressed={chrono.mode === 'stopwatch'}
            onClick={() => onSwitchMode('stopwatch')}
          >
            <span className="m-title">Libre</span>
            <span className="m-sub">Cardio / Vueltas</span>
          </button>
          <button
            type="button"
            className={`mode-card green-mode ${chrono.mode === 'hiit' ? 'active' : ''}`}
            aria-pressed={chrono.mode === 'hiit'}
            onClick={() => onSwitchMode('hiit')}
          >
            <span className="m-title">HIIT / Tabata</span>
            <span className="m-sub">Rondas auto</span>
          </button>
        </div>

        {/* La esfera solo presenta la lectura real del motor existente. */}
        <div className={`chrono-face ${alarmFlash ? 'alarm-flash' : ''}`}>
          <div className="chrono-display-meta">
            <span className="chrono-mode-caption">{modeTitle}</span>
            <span className="chrono-status-pill" role="status">{statusMessage}</span>
          </div>

          <div className="chrono-dial-shell" data-long-digits={clock.split(':')[0].length > 2}>
            <div className="chrono-dial-glass" aria-hidden="true" />
            <svg className="chrono-dial" viewBox="0 0 300 300" aria-hidden="true" focusable="false">
              <circle className="chrono-dial-halo" cx="150" cy="150" r="145" />
              <g className="chrono-dial-ticks">
                {DIAL_TICKS.map(index => (
                  <line key={index} x1="150" x2="150" y1={index % 5 === 0 ? 21 : 24} y2="28"
                    transform={`rotate(${index * 6} 150 150)`} className={index % 5 === 0 ? 'major' : undefined} />
                ))}
              </g>
              <circle className="chrono-dial-track" cx="150" cy="150" r="134" />
              <circle className="chrono-dial-progress" cx="150" cy="150" r="134" pathLength="100"
                strokeDasharray="100" strokeDashoffset={100 - dialProgress} transform="rotate(-90 150 150)" />
              <g className="chrono-orbit-pointer" style={{ transform: `rotate(${sweepDegrees}deg)` }}>
                <circle className="chrono-orbit-glow" cx="150" cy="16" r="9" />
                <circle className="chrono-orbit-dot" cx="150" cy="16" r="4.5" />
              </g>
            </svg>
            <div className="chrono-dial-content" key={dialKey}>
              <span className="chrono-phase-icon" aria-hidden="true"><PhaseIcon size={24} strokeWidth={1.65} /></span>
              <span className="chrono-phase-title">{phaseTitle}</span>
              <div className="chrono-big-digits" role="timer" aria-label="Tiempo del cronómetro" aria-live="off">
                <span>{clock.slice(0, -2)}</span><span className="chrono-tenths">{clock.slice(-2)}</span>
              </div>
              <span className="chrono-clock-caption">minutos · segundos</span>
              {chrono.mode === 'hiit' && <span className="chrono-round-caption">Ronda {reading.round} / {chrono.hiitTotalRounds}</span>}
            </div>
          </div>

          {chrono.mode !== 'stopwatch' && (
            <div className="sr-only" role="progressbar"
              aria-label={chrono.mode === 'hiit' ? `Tiempo restante de ${reading.phase === 'work' ? 'trabajo' : 'descanso'}` : 'Tiempo restante'}
              aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(dialProgress)}
              aria-valuetext={`${formatMinSecShort(displayMs)} restantes`} />
          )}

          <div className="ticket-meta chrono-time-context">
            {chrono.mode === 'countdown' ? (
              <>
                Duración inicial <strong>{formatMinSecShort(chrono.initialSelectedMs)}</strong>
              </>
            ) : chrono.mode === 'hiit' ? (
              <>
                <span>{chrono.hiitWorkSec} s trabajo</span><span aria-hidden="true"> / </span><span>{chrono.hiitRestSec} s descanso</span>
              </>
            ) : (
              <>Sin límite. Marca una vuelta cuando quieras.</>
            )}
          </div>

        </div>

        {/* Botones Principales */}
        <div className="chrono-main-controls">
          <button type="button" className="btn-main chrono-primary-control" onClick={onToggleStartPause}>
            {chrono.running ? (
              <>
                <Pause size={20} fill="currentColor" /> Pausar
              </>
            ) : (
              <>
                <Play size={20} fill="currentColor" /> {canResume ? 'Reanudar' : 'Iniciar'}
              </>
            )}
          </button>

          <button type="button" className="btn-main subtle chrono-reset-control" onClick={onReset}>
            <RotateCcw size={19} /> Restablecer
          </button>
        </div>

        {chrono.mode === 'countdown' && (
          <div className="chrono-live-adjust" role="group" aria-label="Ajustar el tiempo de descanso">
            <button type="button" className="pill-action" onClick={() => onAdjustLiveSeconds(-15)}>-15 seg</button>
            <button type="button" className="pill-action" onClick={() => onAdjustLiveSeconds(15)}>+15 seg</button>
            <button type="button" className="pill-action" onClick={() => onAdjustLiveSeconds(30)}>+30 seg</button>
          </div>
        )}

        {/* Controles Exclusivos según Modo */}
        {chrono.mode === 'countdown' && (
          <div className="chrono-configuration" key="countdown-config">
            <div className="lbl">
              <span>1. Tiempos rápidos de descanso</span>
            </div>
            <div className="preset-row">
              {PRESET_REST_SECONDS.map((p) => (
                <button
                  key={p.sec}
                  type="button"
                  className={`mini-chip ${initTotalSecs === p.sec ? 'active' : ''}`}
                  aria-pressed={initTotalSecs === p.sec}
                  onClick={() => onSelectInitialSeconds(p.sec)}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="lbl">
              <span>2. Duración personalizada</span>
            </div>
            <CountdownDurationEditor
              milliseconds={chrono.initialSelectedMs}
              onApply={onSelectInitialSeconds}
            />
          </div>
        )}

        {chrono.mode === 'stopwatch' && (
          <div className="chrono-configuration" key="stopwatch-config">
            <div className="grid-2">
              <button
                type="button"
                className="btn-main subtle"
                onClick={onAddLap}
                disabled={!chrono.running && displayMs === 0}
              >
                <Flag size={16} /> Marcar vuelta
              </button>
              <button
                type="button"
                className="btn-main blue"
                disabled={displayMs < 600}
                onClick={() => onSendToCardio(Math.round(displayMs / 600) / 100)}
              >
                <Send size={16} /> Pasar a cardio
              </button>
            </div>

            {chrono.laps.length > 0 && (
              <div className="laps-panel">
                <div className="lbl">
                  <span>Parciales registrados</span>
                </div>
                {chrono.laps.map((lapMs, i) => (
                  <div key={i} className="lap-row">
                    <span>Vuelta #{chrono.laps.length - i}</span>
                    <span className="mono-num">{formatMsClock(lapMs)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {chrono.mode === 'hiit' && (
          <div className="chrono-configuration" key="hiit-config">
            <div className="lbl">
              <span>
                <Flame size={14} /> Configuración de intervalos HIIT / Tabata
              </span>
            </div>
            <div className="grid-3 measurement-controls">
              <ValidatedStepper
                label="Trabajo (s)"
                value={chrono.hiitWorkSec}
                min={1}
                max={3600}
                step={5}
                onValue={(work) =>
                  onUpdateHiitConfig(work, chrono.hiitRestSec, chrono.hiitTotalRounds)
                }
              />
              <ValidatedStepper
                label="Descanso (s)"
                value={chrono.hiitRestSec}
                min={1}
                max={3600}
                step={5}
                onValue={(rest) =>
                  onUpdateHiitConfig(chrono.hiitWorkSec, rest, chrono.hiitTotalRounds)
                }
              />
              <ValidatedStepper
                label="Rondas"
                value={chrono.hiitTotalRounds}
                min={1}
                max={100}
                onValue={(rounds) =>
                  onUpdateHiitConfig(chrono.hiitWorkSec, chrono.hiitRestSec, rounds)
                }
              />
            </div>
          </div>
        )}
      </section>

      {/* Preferencias de pantalla, avisos y timbre */}
      <section className="card-cut" aria-labelledby="chrono-prefs-title">
        <div className="block-head">
          <div>
            <h3 id="chrono-prefs-title" className="block-title">
              Pantalla, avisos y sonido
            </h3>
            <p className="block-subtitle">
              En Android los avisos en segundo plano pueden verse afectados por el ahorro de batería; los tonos web suenan con la app abierta.
            </p>
          </div>
        </div>

        <div className="section-stack" style={{ gap: 'var(--space-3)' }}>
          <label className="switch-row">
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sun size={16} style={{ color: 'var(--brand-calm)', flexShrink: 0 }} />
              Mantener pantalla encendida mientras entreno
            </span>
            <input
              type="checkbox"
              checked={chrono.keepScreenAwake}
              onChange={(e) => onToggleWakeLock(e.target.checked)}
            />
          </label>

          <button
            type="button"
            className="pill-action"
            onClick={async () => {
              const ok = await ensureNotificationSetup();
              await showAlert({
                title: ok ? 'Notificaciones activas' : 'Permiso de notificaciones',
                message: ok
                  ? 'Permiso de notificaciones concedido. Android puede retrasar los avisos por ahorro de batería. Los tonos de esta pantalla solo se reproducen mientras la aplicación está activa.'
                  : 'No hay permiso de notificaciones disponible. Puedes activarlo en Ajustes del dispositivo; el temporizador se actualizará al regresar a la app.',
              });
            }}
          >
            <Lock size={14} /> <BellRing size={14} /> Verificar permiso de notificaciones
          </button>

          <div>
            <div className="lbl">
              <span>Sonido al finalizar (app activa)</span>
              <span>5 timbres</span>
            </div>
            <div className="sound-test-row">
              <select
                aria-label="Sonido de alarma"
                className="select-clean"
                value={alarmType}
                onChange={(e) => onChangeAlarmType(e.target.value as AlarmSoundType)}
              >
                <option value="bell">Campana de Boxeo / Gym</option>
                <option value="digital">Beep Digital Deportivo</option>
                <option value="zen">Acorde Suave (Marimba Zen)</option>
                <option value="siren">Sirena Intensa (HIIT / Tabata)</option>
                <option value="pulse">Pulso Grave + Vibración</option>
              </select>
              <button
                type="button"
                className="pill-action active"
                onClick={() => playAlarmSound(alarmType)}
              >
                <Volume2 size={15} /> Probar
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
