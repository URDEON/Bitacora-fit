import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Flame,
  History,
  Scale,
  Search,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { ActiveTab, BitacoraDB, BodyMetricEntry } from '../types';
import { validRecordDate, validRecordTime } from '../services/nutritionMath';
import { dateLabel, localDate } from '../services/dates';
import { chartSignature, clampSelectedIndex } from '../services/chartSelection';
import { isFavorableWeightChange } from '../services/progressMath';
import { popSubviewHistory, pushSubviewHistory, ViewBackController } from '../services/navigation';

interface ProgressHistoryViewProps {
  db: BitacoraDB;
  currentDate: string;
  onSelectDate: (date: string) => void;
  onOpenDateInTab: (date: string, tab?: ActiveTab) => void;
  onSaveBodyMetric: (entry: Omit<BodyMetricEntry, 'id'>, editingId: number | null) => void;
  onDeleteBodyMetric: (id: number) => void;
  registerBackController?: (controller: ViewBackController | null) => void;
}

// Reusable Clean Responsive SVG Line/Area Chart
interface ChartPoint {
  label: string;
  value: number;
  sub?: string;
}

const MiniLineChart: React.FC<{
  points: ChartPoint[];
  color: string;
  unit: string;
  goalLine?: number;
}> = ({ points, color, unit, goalLine }) => {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(
    points.length > 0 ? points.length - 1 : null
  );
  // Al cambiar de serie (otro ejercicio o datos nuevos) la selección vuelve al último punto.
  const signature = chartSignature(points);
  useEffect(() => {
    setSelectedIdx(points.length > 0 ? points.length - 1 : null);
  }, [signature]);
  const safeIdx = clampSelectedIndex(selectedIdx, points.length);

  if (points.length === 0) {
    return (
      <div className="empty-inline">
        Registra al menos un dato para visualizar la curva de evolución.
      </div>
    );
  }

  const values = points.map((p) => p.value);
  if (goalLine) values.push(goalLine);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const pad = Math.max(1, (rawMax - rawMin) * 0.15);
  const minVal = Math.max(0, rawMin - pad);
  const maxVal = rawMax + pad;
  const range = Math.max(1, maxVal - minVal);

  const W = 340;
  const H = 140;
  const padX = 18;
  const padY = 18;

  const getX = (i: number) =>
    points.length === 1 ? W / 2 : padX + (i / (points.length - 1)) * (W - padX * 2);
  const getY = (val: number) => H - padY - ((val - minVal) / range) * (H - padY * 2);

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(p.value).toFixed(1)}`)
    .join(' ');

  const areaD =
    points.length > 1
      ? `${pathD} L ${getX(points.length - 1).toFixed(1)} ${H - padY} L ${getX(0).toFixed(1)} ${
          H - padY
        } Z`
      : '';

  const activePoint = safeIdx !== null ? points[safeIdx] : points[points.length - 1];

  return (
    <div className="chart-box">
      {activePoint && (
        <div className="chart-readout-bar">
          <span className="mono-num" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
            Fecha: {activePoint.label}
          </span>
          <span className="mono-num" style={{ color, fontSize: '0.94rem' }}>
            {activePoint.value} {unit} {activePoint.sub ? `(${activePoint.sub})` : ''}
          </span>
        </div>
      )}

      <svg
        role="group"
        aria-label={`Gráfico de evolución en ${unit}`}
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 140, overflow: 'visible', display: 'block' }}
      >
        <title>{`Evolución en ${unit}. Usa los puntos o la lista de valores.`}</title>
        {[0.25, 0.5, 0.75].map((ratio) => {
          const gy = padY + ratio * (H - padY * 2);
          return (
            <line
              key={ratio}
              x1={padX}
              x2={W - padX}
              y1={gy}
              y2={gy}
              stroke="var(--border)"
              strokeWidth="0.8"
              opacity={0.7}
            />
          );
        })}
        {goalLine && (
          <g>
            <line
              x1={padX}
              x2={W - padX}
              y1={getY(goalLine)}
              y2={getY(goalLine)}
              stroke="var(--text-muted)"
              strokeDasharray="4 4"
              strokeWidth="1"
            />
            <text
              x={W - padX}
              y={getY(goalLine) - 4}
              textAnchor="end"
              fontSize="8.5"
              fill="var(--text-muted)"
            >
              Meta: {goalLine} {unit}
            </text>
          </g>
        )}

        {areaD && <path d={areaD} fill={color} opacity={0.14} />}
        {points.length > 1 && (
          <path d={pathD} fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {points.map((p, i) => (
          <g
            key={i}
            role="button"
            tabIndex={0}
            aria-label={`${p.label}: ${p.value} ${unit}${p.sub ? `, ${p.sub}` : ''}`}
            aria-pressed={safeIdx === i}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setSelectedIdx(i);
              }
            }}
            onClick={() => setSelectedIdx(i)}
            style={{ cursor: 'pointer' }}
          >
            <circle cx={getX(i)} cy={getY(p.value)} r={12} fill="transparent" />
            {safeIdx === i && (
              <circle cx={getX(i)} cy={getY(p.value)} r={9} fill={color} opacity={0.18} />
            )}
            <circle
              cx={getX(i)}
              cy={getY(p.value)}
              r={safeIdx === i ? 5.2 : 3.8}
              fill={color}
              stroke="var(--bg-card)"
              strokeWidth="1.9"
            />
          </g>
        ))}
      </svg>
      <details className="chart-values">
        <summary>Ver valores del gráfico</summary>
        <ul>
          {points.map((point, index) => (
            <li key={index}>
              {point.label}: {point.value} {unit}
              {point.sub ? ` · ${point.sub}` : ''}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
};

type ProgressSection = 'weight' | 'charts' | 'calendar' | 'history';

export const ProgressHistoryView: React.FC<ProgressHistoryViewProps> = ({
  db,
  currentDate,
  onSelectDate,
  onOpenDateInTab,
  onSaveBodyMetric,
  onDeleteBodyMetric,
  registerBackController,
}) => {
  const [section, setSection] = useState<ProgressSection>('weight');
  const [sectionHistory, setSectionHistory] = useState<ProgressSection[]>([]);
  const selectSection = (next: ProgressSection) => {
    setSectionHistory((prev) => pushSubviewHistory(prev, section, next, 'weight'));
    setSection(next);
  };

  // Body Weight Logger state
  const [editingWeightId, setEditingWeightId] = useState<number | null>(null);
  const [weightKgInput, setWeightKgInput] = useState('');
  const [bodyFatInput, setBodyFatInput] = useState('');
  const [waistInput, setWaistInput] = useState('');
  const [weightNotes, setWeightNotes] = useState('');
  const [metricDate, setMetricDate] = useState(currentDate);
  const [metricTime, setMetricTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const weightFormRef = React.useRef<HTMLDivElement>(null);
  const error = (name: string) => errors[name] ? <p className="field-error" id={`${name}-error`} role="alert">{errors[name]}</p> : null;
  useEffect(() => { if (editingWeightId === null) setMetricDate(currentDate); }, [currentDate]);
  useEffect(() => { setCalMonthISO(currentDate.slice(0, 7)); }, [currentDate]);

  const backStateRef = React.useRef({ editingWeightId, section, sectionHistory, currentDate });
  backStateRef.current = { editingWeightId, section, sectionHistory, currentDate };

  useEffect(() => {
    if (!registerBackController) return;
    registerBackController({
      hasActiveEditor: () => backStateRef.current.editingWeightId !== null,
      closeEditor: () => {
        if (backStateRef.current.editingWeightId !== null) {
          setEditingWeightId(null);
          setWeightKgInput('');
          setBodyFatInput('');
          setWaistInput('');
          setWeightNotes('');
          setMetricDate(backStateRef.current.currentDate);
          setMetricTime(new Date().toTimeString().slice(0, 5));
          setErrors({});
          return true;
        }
        return false;
      },
      hasActiveSubview: () => backStateRef.current.section !== 'weight',
      leaveSubview: () => {
        const res = popSubviewHistory(
          backStateRef.current.sectionHistory,
          backStateRef.current.section,
          'weight',
        );
        if (!res.handled) return false;
        setSectionHistory(res.nextHistory);
        setSection(res.nextView);
        return true;
      },
    });
    return () => registerBackController(null);
  }, [registerBackController]);

  // Exercise progression selector
  const strengthExerciseNames = useMemo(() => {
    const names = Array.from(
      new Set(db.workouts.filter((w) => w.mode === 'strength').map((w) => w.name))
    );
    return names;
  }, [db.workouts]);

  const [selectedExChart, setSelectedExChart] = useState<string>('');
  const activeExName = selectedExChart || strengthExerciseNames[0] || '';

  // Calendar month state
  const [calMonthISO, setCalMonthISO] = useState(() => currentDate.slice(0, 7)); // YYYY-MM

  // History filter
  const [historyFilter, setHistoryFilter] = useState('');
  const archivedSessions = useMemo(() => {
    const query = historyFilter.trim().toLocaleLowerCase('es');
    return [...db.workoutSessions]
      .sort((a, b) => Date.parse(b.finishedAt || b.startedAt) - Date.parse(a.finishedAt || a.startedAt))
      .map((session) => {
        const results = db.workouts.filter((workout) => workout.sessionId === session.id);
        const start = new Date(session.startedAt);
        const end = session.finishedAt ? new Date(session.finishedAt) : null;
        const seconds = end && end.getTime() >= start.getTime() ? Math.round((end.getTime() - start.getTime()) / 1000) : null;
        const duration = seconds === null ? 'Duración no disponible' : seconds >= 3600 ? `${Math.floor(seconds / 3600)} h ${Math.floor(seconds % 3600 / 60)} min` : seconds >= 60 ? `${Math.floor(seconds / 60)} min ${seconds % 60} s` : `${seconds} s`;
        return { session, results, start, date: localDate(start), duration, resultDates: [...new Set(results.map((workout) => workout.date))].sort() };
      })
      .filter(({ session, results, date, resultDates }) => !query || [session.title, date, ...resultDates, ...results.map((workout) => workout.name)].some((text) => text.toLocaleLowerCase('es').includes(query)));
  }, [db.workoutSessions, db.workouts, historyFilter]);

  // Sorted body metrics
  const sortedWeights = useMemo(
    () => [...db.bodyMetrics].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.id - b.id),
    [db.bodyMetrics]
  );

  const latestWeight = sortedWeights.length > 0 ? sortedWeights[sortedWeights.length - 1] : null;
  const firstWeight = sortedWeights.length > 0 ? sortedWeights[0] : null;
  const weightDelta =
    latestWeight && firstWeight ? Number((latestWeight.weightKg - firstWeight.weightKg).toFixed(1)) : 0;

  // Strength progression points for chosen exercise
  const strengthChartPoints = useMemo<ChartPoint[]>(() => {
    if (!activeExName) return [];
    const matching = db.workouts
      .filter((w) => w.mode === 'strength' && w.name === activeExName)
      .sort((a, b) => a.date.localeCompare(b.date));

    // Group by date taking best weight & 1RM (Epley: weight * (1 + reps/30))
    const byDate = new Map<string, { maxKg: number; est1RM: number; reps: number }>();
    matching.forEach((w) => {
      const bestSet = w.setDetails?.length ? w.setDetails.reduce((best, set) => set.weight > best.weight || set.weight === best.weight && set.reps > best.reps ? set : best, w.setDetails[0]) : { weight: Number(w.weight) || 0, reps: Number(w.reps) || 1 };
      const kg = bestSet.weight;
      const reps = bestSet.reps;
      const e1rm = Math.round(kg * (1 + reps / 30));
      const cur = byDate.get(w.date);
      if (!cur || kg > cur.maxKg) {
        byDate.set(w.date, { maxKg: kg, est1RM: e1rm, reps });
      }
    });

    return Array.from(byDate.entries()).map(([date, v]) => ({
      label: date,
      value: v.maxKg,
      sub: `1RM est: ${v.est1RM}kg`,
    }));
  }, [db.workouts, activeExName]);

  // Daily Kcal last 14 logged days
  const kcalChartPoints = useMemo<ChartPoint[]>(() => {
    const map = new Map<string, { kcal: number; prot: number }>();
    db.meals.forEach((m) => {
      const prev = map.get(m.date) || { kcal: 0, prot: 0 };
      map.set(m.date, {
        kcal: prev.kcal + (Number(m.calories) || 0),
        prot: prev.prot + (Number(m.protein) || 0),
      });
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14)
      .map(([d, v]) => ({
        label: d,
        value: v.kcal,
        sub: `${v.prot}g prot`,
      }));
  }, [db.meals]);

  // Weekly & Monthly Comparative Analytics
  const periodStats = useMemo(() => {
    const ref = new Date(currentDate + 'T12:00:00');
    const calcWindow = (daysAgoStart: number, daysAgoEnd: number) => {
      const isoLocal = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const startDate = new Date(ref); startDate.setDate(ref.getDate() - daysAgoStart);
      const endDate = new Date(ref); endDate.setDate(ref.getDate() - daysAgoEnd);
      const startISO = isoLocal(startDate);
      const endISO = isoLocal(endDate);
      const w = db.workouts.filter((x) => x.date >= startISO && x.date <= endISO);
      const m = db.meals.filter((x) => x.date >= startISO && x.date <= endISO);
      const wa = db.waterLogs.filter((x) => x.date >= startISO && x.date <= endISO);

      const workoutDays = new Set(w.map((x) => x.date)).size;
      const tonnage = w
        .filter((x) => x.mode === 'strength')
        .reduce((s, x) => s + (x.setDetails?.length ? x.setDetails.reduce((sum, set) => sum + set.reps * set.weight, 0) : (x.sets || 0) * (x.reps || 0) * (x.weight || 0)), 0);
      const cardioMins = w
        .filter((x) => x.mode === 'cardio')
        .reduce((s, x) => s + (Number(x.minutes) || 0), 0);
      const mealDays = Math.max(1, new Set(m.map((x) => x.date)).size);
      const avgKcal = Math.round(
        m.reduce((s, x) => s + (Number(x.calories) || 0), 0) / mealDays
      );
      const waterDays = Math.max(1, new Set(wa.map((x) => x.date)).size);
      const avgWater = Math.round(
        wa.reduce((s, x) => s + (Number(x.ml) || 0), 0) / waterDays
      );
      return { workoutDays, tonnage: Math.round(tonnage), cardioMins, avgKcal, avgWater };
    };

    return {
      thisWeek: calcWindow(6, 0),
      prevWeek: calcWindow(13, 7),
      thisMonth: calcWindow(29, 0),
    };
  }, [db.workouts, db.meals, db.waterLogs, currentDate]);

  // Consistency Calendar Calculation & Streak
  const calendarData = useMemo(() => {
    const [yrStr, moStr] = calMonthISO.split('-');
    const year = Number(yrStr);
    const month = Number(moStr); // 1..12
    const firstDay = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    // Monday-based offset (0 = Mon ... 6 = Sun)
    const startOffset = (firstDay.getDay() + 6) % 7;

    const workoutDates = new Set(db.workouts.map((w) => w.date));
    const mealDates = new Set(db.meals.map((m) => m.date));
    const waterDates = new Set(db.waterLogs.map((w) => w.date));

    // Current streak of consecutive active days up to currentDate
    let streak = 0;
    const cursor = new Date(currentDate + 'T12:00:00');
    while (true) {
      const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      if (workoutDates.has(iso) || mealDates.has(iso) || waterDates.has(iso)) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }

    const cells: Array<{
      day: number;
      iso: string;
      hasWorkout: boolean;
      hasMeal: boolean;
      hasWater: boolean;
    } | null> = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${yrStr}-${moStr}-${String(d).padStart(2, '0')}`;
      cells.push({
        day: d,
        iso,
        hasWorkout: workoutDates.has(iso),
        hasMeal: mealDates.has(iso),
        hasWater: waterDates.has(iso),
      });
    }
    return { cells, streak, activeThisMonth: cells.filter((c) => c?.hasWorkout).length };
  }, [calMonthISO, db.workouts, db.meals, db.waterLogs, currentDate]);

  // History list filtered
  const filteredHistoryDates = useMemo(() => {
    const q = historyFilter.trim().toLowerCase();
    const allDates = Array.from(
      new Set([
        ...db.workouts.map((w) => w.date),
        ...db.meals.map((m) => m.date),
        ...db.waterLogs.map((w) => w.date),
        ...db.bodyMetrics.map((b) => b.date),
      ])
    )
      .sort()
      .reverse();

    return allDates.filter((d) => {
      if (!q) return true;
      if (d.includes(q)) return true;
      const wHit = db.workouts.some(
        (w) =>
          w.date === d &&
          (w.name.toLowerCase().includes(q) || w.category.toLowerCase().includes(q))
      );
      const mHit = db.meals.some(
        (m) =>
          m.date === d &&
          (m.desc.toLowerCase().includes(q) || m.mealType.toLowerCase().includes(q))
      );
      const sessionHit = db.workoutSessions.some((session) => session.title.toLocaleLowerCase('es').includes(q) && db.workouts.some((workout) => workout.date === d && workout.sessionId === session.id));
      return wHit || mHit || sessionHit;
    });
  }, [db.workouts, db.meals, db.waterLogs, db.bodyMetrics, db.workoutSessions, historyFilter]);

  const shiftMonth = (delta: number) => {
    const [y, m] = calMonthISO.split('-').map(Number);
    const dt = new Date(y, m - 1 + delta, 1);
    setCalMonthISO(
      `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
    );
  };

  const handleSaveWeight = () => {
    const kg = Number(weightKgInput);
    const nextErrors: Record<string, string> = {};
    if (!weightKgInput.trim() || !Number.isFinite(kg) || kg < 25 || kg > 350) nextErrors.weightKg = 'Ingresa un peso entre 25 y 350 kg.';
    if (bodyFatInput && (!Number.isFinite(Number(bodyFatInput)) || Number(bodyFatInput) < 1 || Number(bodyFatInput) > 75)) nextErrors.bodyFat = 'Ingresa un porcentaje entre 1 y 75 %.';
    if (waistInput && (!Number.isFinite(Number(waistInput)) || Number(waistInput) < 20 || Number(waistInput) > 300)) nextErrors.waist = 'Ingresa una medida entre 20 y 300 cm.';
    if (!validRecordDate(metricDate)) nextErrors.metricDate = 'Selecciona una fecha válida.';
    if (!validRecordTime(metricTime)) nextErrors.metricTime = 'Selecciona una hora válida.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    onSaveBodyMetric(
      {
        date: metricDate,
        time: metricTime,
        weightKg: kg,
        bodyFatPct: bodyFatInput ? Number(bodyFatInput) : undefined,
        waistCm: waistInput ? Number(waistInput) : undefined,
        notes: weightNotes.trim() || undefined,
      },
      editingWeightId
    );
    setEditingWeightId(null);
    setWeightKgInput('');
    setBodyFatInput('');
    setWaistInput('');
    setWeightNotes('');
    setMetricDate(currentDate);
    setMetricTime(new Date().toTimeString().slice(0, 5));
  };

  return (
    <div className="fade-view">
      {/* Navegador de 4 módulos de Evolución e Historial (siempre visibles sin desplazamiento lateral) */}
      <div className="progress-subnav" role="group" aria-label="Secciones de progreso">
        <button
          type="button"
          className={`progress-subnav-btn ${section === 'weight' ? 'active' : ''}`}
          aria-pressed={section === 'weight'}
          onClick={() => selectSection('weight')}
        >
          <Scale size={15} /> Peso Corporal
        </button>
        <button
          type="button"
          className={`progress-subnav-btn ${section === 'charts' ? 'active' : ''}`}
          aria-pressed={section === 'charts'}
          onClick={() => selectSection('charts')}
        >
          <TrendingUp size={15} /> Gráficos Fuerza/Kcal
        </button>
        <button
          type="button"
          className={`progress-subnav-btn ${section === 'calendar' ? 'active' : ''}`}
          aria-pressed={section === 'calendar'}
          onClick={() => selectSection('calendar')}
        >
          <CalendarIcon size={15} /> Consistencia y Stats
        </button>
        <button
          type="button"
          className={`progress-subnav-btn ${section === 'history' ? 'active' : ''}`}
          aria-pressed={section === 'history'}
          onClick={() => selectSection('history')}
        >
          <History size={15} /> Historial ({filteredHistoryDates.length})
        </button>
      </div>

      {/* 1. SEGUIMIENTO DEL PESO CORPORAL + GRÁFICO */}
      {section === 'weight' && (
        <>
          <section className="card-soft" ref={weightFormRef} aria-labelledby="weight-title">
            <div className="block-head">
              <div>
                <h2 id="weight-title" className="block-title">
                  <Scale size={18} /> Seguimiento de peso y medidas
                </h2>
                <p className="block-subtitle">
                  Registra tu peso corporal y observa tu evolución hacia tu meta de{' '}
                  <strong>{db.goals.targetWeightKg} kg</strong>.
                </p>
              </div>
            </div>

            {latestWeight && (
              <div className="grid-3">
                <div className="sum-box">
                  <div className="sum-num">{latestWeight.weightKg} kg</div>
                  <div className="sum-lbl">Peso actual</div>
                </div>
                <div className="sum-box">
                  <div className="sum-num" style={{ color: 'var(--accent-amber)' }}>
                    {db.goals.targetWeightKg} kg
                  </div>
                  <div className="sum-lbl">Meta peso</div>
                </div>
                <div className="sum-box">
                  <div
                    className="sum-num"
                    style={{
                      color:
                        latestWeight &&
                        firstWeight &&
                        isFavorableWeightChange(
                          firstWeight.weightKg,
                          latestWeight.weightKg,
                          db.goals.targetWeightKg,
                        )
                          ? 'var(--accent-green)'
                          : 'var(--accent)',
                    }}
                  >
                    {weightDelta > 0 ? `+${weightDelta}` : weightDelta} kg
                  </div>
                  <div className="sum-lbl">Cambio total</div>
                </div>
              </div>
            )}

            <MiniLineChart
              points={sortedWeights.map((b) => ({
                label: b.date,
                value: b.weightKg,
                sub: b.waistCm ? `${b.waistCm}cm cintura` : undefined,
              }))}
              color="var(--accent-amber)"
              unit="kg"
              goalLine={db.goals.targetWeightKg}
            />

            <div className="grid-2" style={{ marginTop: 'var(--space-4)' }}>
              <div>
                <label className="lbl" htmlFor="metric-date">Fecha del pesaje</label>
                <input id="metric-date" type="date" className="input-clean" value={metricDate} onChange={(e) => setMetricDate(e.target.value)} aria-invalid={!!errors.metricDate} aria-describedby={errors.metricDate ? 'metricDate-error' : undefined} />
                {error('metricDate')}
              </div>
              <div>
                <label className="lbl" htmlFor="metric-time">Hora del pesaje</label>
                <input id="metric-time" type="time" className="input-clean" value={metricTime} onChange={(e) => setMetricTime(e.target.value)} aria-invalid={!!errors.metricTime} aria-describedby={errors.metricTime ? 'metricTime-error' : undefined} />
                {error('metricTime')}
              </div>
            </div>

            <div className="grid-3">
              <div>
                <label className="lbl" htmlFor="body-weight">Peso (kg)*</label>
                <input
                  id="body-weight"
                  min="25"
                  max="350"
                  aria-invalid={!!errors.weightKg}
                  aria-describedby={errors.weightKg ? 'weightKg-error' : undefined}
                  type="number"
                  step="0.1"
                  className="input-clean"
                  placeholder="Ej. 76.4"
                  value={weightKgInput}
                  onChange={(e) => setWeightKgInput(e.target.value)}
                />
                {error('weightKg')}
              </div>
              <div>
                <label className="lbl" htmlFor="body-fat">% Grasa (opcional)</label>
                <input
                  id="body-fat"
                  min="1"
                  max="75"
                  aria-invalid={!!errors.bodyFat}
                  aria-describedby={errors.bodyFat ? 'bodyFat-error' : undefined}
                  type="number"
                  step="0.1"
                  className="input-clean"
                  placeholder="Ej. 18"
                  value={bodyFatInput}
                  onChange={(e) => setBodyFatInput(e.target.value)}
                />
                {error('bodyFat')}
              </div>
              <div>
                <label className="lbl" htmlFor="body-waist">Cintura (cm, opc.)</label>
                <input
                  id="body-waist"
                  min="20"
                  max="300"
                  aria-invalid={!!errors.waist}
                  aria-describedby={errors.waist ? 'waist-error' : undefined}
                  type="number"
                  step="0.5"
                  className="input-clean"
                  placeholder="Ej. 84"
                  value={waistInput}
                  onChange={(e) => setWaistInput(e.target.value)}
                />
                {error('waist')}
              </div>
            </div>

            <label className="lbl" htmlFor="body-notes">Notas del pesaje</label>
            <input
              id="body-notes"
              maxLength={2000}
              type="text"
              className="input-clean"
              placeholder="Nota opcional (ej. pesaje en ayunas)…"
              value={weightNotes}
              onChange={(e) => setWeightNotes(e.target.value)}
            />

            <button type="button" className="btn-main amber" onClick={handleSaveWeight}>
              <Check size={17} />{' '}
              {editingWeightId ? 'Actualizar pesaje' : `Guardar peso (${metricDate})`}
            </button>
            {editingWeightId !== null && (
              <button
                type="button"
                className="pill-action"
                style={{ marginTop: 'var(--space-2)' }}
                onClick={() => {
                  setEditingWeightId(null);
                  setWeightKgInput('');
                  setBodyFatInput('');
                  setWaistInput('');
                  setWeightNotes('');
                  setMetricDate(currentDate);
                  setMetricTime(new Date().toTimeString().slice(0, 5));
                  setErrors({});
                }}
              >
                Cancelar edición del pesaje
              </button>
            )}
          </section>

          <section className="card-cut" aria-labelledby="weight-history-title">
            <div className="block-head">
              <h3 id="weight-history-title" className="block-title">
                Historial de pesajes
              </h3>
            </div>
            {sortedWeights.length === 0 ? (
              <p className="empty-inline">Sin pesajes registrados todavía.</p>
            ) : (
              [...sortedWeights].reverse().map((b) => (
                <div key={b.id} className="ticket-row weight">
                  <div className="ticket-body">
                    <span className="ticket-kicker" style={{ color: 'var(--accent-amber)' }}>
                      {b.date} · {b.time}
                    </span>
                    <div className="ticket-title">
                      {b.weightKg} kg
                      {b.bodyFatPct ? ` · ${b.bodyFatPct}% grasa` : ''}
                      {b.waistCm ? ` · ${b.waistCm} cm` : ''}
                    </div>
                    {b.notes && <div className="ticket-meta">{b.notes}</div>}
                  </div>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Editar pesaje del ${b.date}`}
                      onClick={() => {
                        setEditingWeightId(b.id);
                        setWeightKgInput(String(b.weightKg));
                        setBodyFatInput(b.bodyFatPct ? String(b.bodyFatPct) : '');
                        setWaistInput(b.waistCm ? String(b.waistCm) : '');
                        setWeightNotes(b.notes || '');
                        setMetricDate(b.date);
                        setMetricTime(b.time);
                        setErrors({});
                        weightFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn danger"
                      aria-label={`Eliminar pesaje del ${b.date}`}
                      onClick={() => onDeleteBodyMetric(b.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </section>
        </>
      )}

      {/* 2. GRÁFICOS DE EVOLUCIÓN DE FUERZA Y NUTRICIÓN */}
      {section === 'charts' && (
        <>
          <section className="card-soft" aria-labelledby="strength-chart-title">
            <div className="block-head">
              <div>
                <h2 id="strength-chart-title" className="block-title">
                  Evolución de cargas por ejercicio
                </h2>
                <p className="block-subtitle">
                  Toca cualquier punto de la gráfica para revisar peso levantado y tu 1RM estimado.
                </p>
              </div>
            </div>

            {strengthExerciseNames.length > 0 ? (
              <select
                aria-label="Ejercicio para el gráfico de cargas"
                className="select-clean"
                value={activeExName}
                onChange={(e) => setSelectedExChart(e.target.value)}
              >
                {strengthExerciseNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            ) : null}

            <MiniLineChart
              key={activeExName}
              points={strengthChartPoints}
              color="var(--accent)"
              unit="kg"
            />
          </section>

          <section className="card-cut" aria-labelledby="kcal-chart-title">
            <div className="block-head">
              <div>
                <h2 id="kcal-chart-title" className="block-title">
                  Calorías diarias frente a tu meta ({db.goals.calories} kcal)
                </h2>
                <p className="block-subtitle">
                  Últimos 14 días con comidas registradas.
                </p>
              </div>
            </div>
            <MiniLineChart
              points={kcalChartPoints}
              color="var(--accent-green)"
              unit="kcal"
              goalLine={db.goals.calories}
            />
          </section>
        </>
      )}

      {/* 3. CALENDARIO DE CONSISTENCIA + ESTADÍSTICAS SEMANALES Y MENSUALES */}
      {section === 'calendar' && (
        <>
          <section className="card-soft" aria-labelledby="calendar-section-title">
            <div className="block-head">
              <div>
                <h2 id="calendar-section-title" className="block-title">
                  Calendario de consistencia
                </h2>
                <p className="block-subtitle">
                  {calendarData.activeThisMonth} días entrenados en {calMonthISO}
                </p>
              </div>
              <span className="s20-badge">
                <Flame size={13} /> Racha: {calendarData.streak}d
              </span>
            </div>

            <div className="month-nav-bar">
              <button type="button" className="icon-btn" aria-label="Mes anterior" onClick={() => shiftMonth(-1)}>
                <ChevronLeft size={18} />
              </button>
              <strong className="mono-num">Mes: {calMonthISO}</strong>
              <button type="button" className="icon-btn" aria-label="Mes siguiente" onClick={() => shiftMonth(1)}>
                <ChevronRight size={18} />
              </button>
            </div>

            <p className="calendar-scroll-hint">En pantallas pequeñas, desliza para ver toda la semana.</p>
            <div className="calendar-scroll" role="region" aria-label="Calendario de actividad desplazable" tabIndex={0}>
              <div className="calendar-grid">
                {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
                  <div key={d} className="mono-num" style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>
                    {d}
                  </div>
                ))}
              </div>

              <div className="calendar-grid">
                {calendarData.cells.map((cell, idx) =>
                  cell ? (
                    <button
                      key={cell.iso}
                      type="button"
                      aria-label={`${cell.iso}${cell.hasWorkout ? ', con entrenamiento' : ''}${cell.hasMeal ? ', con comidas' : ''}${cell.hasWater ? ', con agua registrada' : ''}`}
                      aria-pressed={cell.iso === currentDate}
                      className={`cal-day ${cell.hasWorkout ? 'has-workout' : ''} ${
                        cell.iso === currentDate ? 'selected-date' : ''
                      }`}
                      onClick={() => onSelectDate(cell.iso)}
                    >
                      <span>{cell.day}</span>
                      <div className="cal-dots">
                        {cell.hasWorkout && <span className="cal-dot" style={{ background: 'var(--accent)' }} />}
                        {cell.hasMeal && <span className="cal-dot" style={{ background: 'var(--accent-green)' }} />}
                        {cell.hasWater && <span className="cal-dot" style={{ background: 'var(--accent-blue)' }} />}
                      </div>
                    </button>
                  ) : (
                    <div key={`empty-${idx}`} />
                  ),
                )}
              </div>
            </div>

            <div className="calendar-legend" aria-hidden="true">
              <span>
                <span className="cal-dot" style={{ background: 'var(--accent)' }} /> Entrenamiento
              </span>
              <span>
                <span className="cal-dot" style={{ background: 'var(--accent-green)' }} /> Comidas
              </span>
              <span>
                <span className="cal-dot" style={{ background: 'var(--accent-blue)' }} /> Hidratación
              </span>
            </div>

            <div className="selected-date-panel">
              <div>
                <span className="ticket-kicker">Fecha seleccionada: {currentDate}</span>
                <div className="ticket-meta" style={{ marginTop: 2 }}>
                  <strong>{db.workouts.filter((w) => w.date === currentDate).length}</strong> ejerc. ·{' '}
                  <strong>{db.meals.filter((m) => m.date === currentDate).length}</strong> comidas ·{' '}
                  <strong>
                    {db.waterLogs
                      .filter((w) => w.date === currentDate)
                      .reduce((s, x) => s + (Number(x.ml) || 0), 0)}
                  </strong>{' '}
                  ml agua
                </div>
              </div>
              <div className="selected-date-actions">
                <button
                  type="button"
                  className="pill-action"
                  onClick={() => onOpenDateInTab(currentDate, 'home')}
                >
                  Ver resumen
                </button>
                <button
                  type="button"
                  className="pill-action"
                  onClick={() => onOpenDateInTab(currentDate, 'exercises')}
                >
                  Entrenar
                </button>
                <button
                  type="button"
                  className="pill-action"
                  onClick={() => onOpenDateInTab(currentDate, 'meals')}
                >
                  Alimentación
                </button>
              </div>
            </div>
          </section>

          <section className="card-cut" aria-labelledby="period-stats-title">
            <div className="block-head">
              <h3 id="period-stats-title" className="block-title">
                <Activity size={17} /> Resúmenes de los últimos 7 y 30 días
              </h3>
            </div>

            <div className="grid-2">
              <div className="sub-panel" style={{ marginBottom: 0 }}>
                <div className="ticket-kicker">Últimos 7 días hasta {currentDate}</div>
                <div className="ticket-title">{periodStats.thisWeek.workoutDays} días entrenados</div>
                <div className="ticket-meta">
                  Volumen: <strong>{periodStats.thisWeek.tonnage.toLocaleString()} kg</strong>
                  <br />
                  Cardio: <strong>{periodStats.thisWeek.cardioMins} min</strong>
                  <br />
                  Media nutricional: <strong>{periodStats.thisWeek.avgKcal} kcal/día</strong>
                </div>
              </div>

              <div className="sub-panel" style={{ marginBottom: 0 }}>
                <div className="ticket-kicker" style={{ color: 'var(--text-muted)' }}>
                  7 días anteriores
                </div>
                <div className="ticket-title">{periodStats.prevWeek.workoutDays} días entrenados</div>
                <div className="ticket-meta">
                  Volumen: <strong>{periodStats.prevWeek.tonnage.toLocaleString()} kg</strong>
                  <br />
                  Cardio: <strong>{periodStats.prevWeek.cardioMins} min</strong>
                  <br />
                  Media nutricional: <strong>{periodStats.prevWeek.avgKcal} kcal/día</strong>
                </div>
              </div>
            </div>

            <div className="sub-panel" style={{ marginBottom: 0 }}>
              <div className="ticket-kicker water-tone">Resumen de 30 días hasta {currentDate}</div>
              <div className="ticket-meta" style={{ marginTop: 4 }}>
                Entrenaste <strong>{periodStats.thisMonth.workoutDays} días</strong> · Moviste{' '}
                <strong>{periodStats.thisMonth.tonnage.toLocaleString()} kg</strong> totales ·{' '}
                <strong>{periodStats.thisMonth.cardioMins} min</strong> de cardio · Hidratación media{' '}
                <strong>{periodStats.thisMonth.avgWater} ml/día</strong>.
              </div>
            </div>
          </section>
        </>
      )}

      {/* 4. AUDITORÍA E HISTORIAL DE DÍAS */}
      {section === 'history' && (
        <>
          <section className="card-soft" aria-labelledby="audit-history-title">
            <div className="block-head">
              <div>
                <h2 id="audit-history-title" className="block-title">
                  Auditoría de días registrados
                </h2>
                <p className="block-subtitle">
                  Toca cualquier fecha para abrir su resumen diario y revisar o editar sus registros.
                </p>
              </div>
            </div>

            <div className="search-input-wrap" style={{ marginBottom: 'var(--space-3)' }}>
              <Search size={16} />
              <input
                type="text"
                aria-label="Filtrar historial por fecha, ejercicio, comida o sesión"
                className="input-clean"
                placeholder="Fecha, ejercicio, comida o sesión…"
                value={historyFilter}
                onChange={(e) => setHistoryFilter(e.target.value)}
              />
            </div>

            {filteredHistoryDates.length === 0 ? (
              <p className="empty-inline">Aún no hay fechas registradas con ese criterio.</p>
            ) : (
              filteredHistoryDates.map((d) => {
                const wCount = db.workouts.filter((w) => w.date === d).length;
                const mList = db.meals.filter((m) => m.date === d);
                const kcal = mList.reduce((s, x) => s + (Number(x.calories) || 0), 0);
                const waterMl = db.waterLogs
                  .filter((w) => w.date === d)
                  .reduce((s, x) => s + (Number(x.ml) || 0), 0);
                const weightEntry = db.bodyMetrics.find((b) => b.date === d);

                return (
                  <button
                    type="button"
                    key={d}
                    className="ticket-row history-day-btn"
                    onClick={() => onOpenDateInTab(d, 'home')}
                  >
                    <div className="ticket-body">
                      <span className="ticket-kicker">
                        <span>FECHA: {d}</span>
                        {weightEntry && (
                          <span>
                            · <Scale size={12} style={{ verticalAlign: 'middle' }} /> {weightEntry.weightKg} kg
                          </span>
                        )}
                      </span>
                      <div className="ticket-title">
                        {wCount} ejerc. · {mList.length} comidas ({kcal} kcal) · {waterMl} ml agua
                      </div>
                    </div>
                    <span className="mono-num" style={{ fontSize: 'var(--text-xs)', color: 'var(--section-accent)' }}>
                      Ver día →
                    </span>
                  </button>
                );
              })
            )}
          </section>

          <section className="card-cut" aria-labelledby="session-history-title">
            <div className="block-head">
              <div>
                <h2 id="session-history-title" className="block-title">
                  Sesiones finalizadas
                </h2>
                <p className="block-subtitle">
                  Resultados guardados durante cada sesión y duración calculada entre inicio y cierre.
                </p>
              </div>
            </div>
            {archivedSessions.length === 0 ? (
              <p className="empty-inline">
                {db.workoutSessions.length === 0
                  ? 'Todavía no has finalizado una sesión. Inicia una rutina desde Entrenar y guarda tus resultados.'
                  : 'No hay sesiones que coincidan con tu búsqueda.'}
              </p>
            ) : (
              archivedSessions.map(({ session, results, start, date, duration, resultDates }) => (
                <article key={session.id} className="sub-panel" aria-label={`Sesión ${session.title}`}>
                  <h3 className="ticket-title">{session.title}</h3>
                  <p className="ticket-meta">
                    {dateLabel(date)} · Inicio: {start.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="ticket-meta" style={{ marginTop: 4, marginBottom: 8 }}>
                    <strong>{duration}</strong> · {results.length}{' '}
                    {results.length === 1 ? 'resultado guardado' : 'resultados guardados'} ·{' '}
                    {session.exercises.length} ejercicios planificados
                  </p>
                  {results.length === 0 ? (
                    <p className="text-thin">No se guardaron resultados en esta sesión.</p>
                  ) : (
                    <>
                      <details className="chart-values" style={{ marginBottom: 10 }}>
                        <summary>Consultar ejercicios registrados</summary>
                        <ul>
                          {results.map((workout) => (
                            <li key={workout.id}>
                              {workout.name}:{' '}
                              {workout.mode === 'strength'
                                ? workout.setDetails?.length
                                  ? workout.setDetails
                                      .map((set, index) => `serie ${index + 1}: ${set.reps} rep × ${set.weight} kg`)
                                      .join('; ')
                                  : `${workout.sets} series × ${workout.reps} rep × ${workout.weight} kg`
                                : workout.mode === 'cardio'
                                  ? `${workout.minutes} min${workout.distanceKm ? ` · ${workout.distanceKm} km` : ''}`
                                  : `${workout.sets} series × ${workout.seconds} s`}
                            </li>
                          ))}
                        </ul>
                      </details>
                      <div className="selected-date-actions">
                        {resultDates.map((resultDate) => (
                          <button
                            key={resultDate}
                            type="button"
                            className="pill-action"
                            onClick={() => onOpenDateInTab(resultDate, 'exercises')}
                          >
                            Ver resultados del {dateLabel(resultDate)}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </article>
              ))
            )}
          </section>
        </>
      )}
    </div>
  );
};
