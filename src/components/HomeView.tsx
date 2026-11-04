import {
  Activity,
  ArrowRight,
  Dumbbell,
  Droplets,
  Flame,
  Timer,
  Utensils,
  TrendingUp,
} from "lucide-react";
import { ActiveTab, BitacoraDB } from "../types";
import { dateLabel, localDate, shiftDate, weekStart } from "../services/dates";

interface Props {
  db: BitacoraDB;
  currentDate: string;
  onNavigate: (tab: ActiveTab) => void;
  onWater: () => void;
  onRest: () => void;
}
export function HomeView({
  db,
  currentDate,
  onNavigate,
  onWater,
  onRest,
}: Props) {
  const workouts = db.workouts.filter((w) => w.date === currentDate);
  const meals = db.meals.filter((m) => m.date === currentDate);
  const water = db.waterLogs
    .filter((w) => w.date === currentDate)
    .reduce((s, w) => s + w.ml, 0);
  const kcal = meals.reduce((s, m) => s + m.calories, 0);
  const protein = meals.reduce((s, m) => s + m.protein, 0);
  const start = weekStart(currentDate),
    end = shiftDate(start, 7);
  const days = new Set(
    db.workouts
      .filter((w) => w.date >= start && w.date < end)
      .map((w) => w.date),
  ).size;
  const last = [...db.workouts]
    .filter((w) => w.date <= currentDate)
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        (b.time || "").localeCompare(a.time || "") ||
        b.id - a.id,
    )[0];
  const totals = [
    {
      name: "Días de entrenamiento",
      value: days,
      goal: db.goals.weeklyWorkoutDays,
      unit: "esta semana",
      color: "var(--accent)",
      icon: Dumbbell,
      tab: "progress" as ActiveTab,
    },
    {
      name: "Agua registrada",
      value: water,
      goal: db.goals.waterMl,
      unit: "ml",
      color: "var(--accent-blue)",
      icon: Droplets,
      tab: "meals" as ActiveTab,
    },
    {
      name: "Energía registrada",
      value: Math.round(kcal),
      goal: db.goals.calories,
      unit: "kcal",
      color: "var(--accent-amber)",
      icon: Flame,
      tab: "meals" as ActiveTab,
    },
    {
      name: "Proteína registrada",
      value: Math.round(protein * 10) / 10,
      goal: db.goals.proteinG,
      unit: "g",
      color: "var(--accent-green)",
      icon: Utensils,
      tab: "meals" as ActiveTab,
    },
  ];
  return (
    <div className="fade-view home-view">
      <div className="page-heading">
        <p className="eyebrow">BITÁCORA PERSONAL</p>
        <h1>
          {currentDate === localDate()
            ? "El trabajo de hoy."
            : "Un día en tu bitácora."}
        </h1>
        <p className="text-thin">
          {dateLabel(currentDate)} · {workouts.length}{" "}
          {workouts.length === 1
            ? "ejercicio registrado"
            : "ejercicios registrados"}
        </p>
      </div>
      <section className="home-hero" aria-labelledby="hero-title">
        <div className="hero-mark" aria-hidden="true">
          <Activity size={24} />
        </div>
        <div>
          <p className="eyebrow">01 / ENTRENAMIENTO</p>
          <h2 id="hero-title">
            {db.activeSession
              ? db.activeSession.title
              : "Entrena. Anota. Repite."}
          </h2>
          <p>
            {db.activeSession
              ? `${db.activeSession.completedIds.length} de ${db.activeSession.exercises.length} ejercicios completados en la sesión activa.`
              : "Series, cargas y descansos. Un registro de lo que haces, a tu manera."}
          </p>
        </div>
        <button className="hero-action" onClick={() => onNavigate("exercises")}>
          <span>
            {db.activeSession ? "Continuar sesión" : "Comenzar a entrenar"}
          </span>
          <ArrowRight size={20} />
        </button>
      </section>
      <section aria-labelledby="day-progress">
        <div className="section-heading">
          <h2 id="day-progress">El día en números</h2>
          <button className="text-button" onClick={() => onNavigate("export")}>
            Editar objetivos
          </button>
        </div>
        <div className="dashboard-grid">
          {totals.map((t) => {
            const pct = t.goal > 0 ? Math.min(100, (t.value / t.goal) * 100) : 0;
            return (
              <button
                className="metric-card"
                key={t.name}
                onClick={() => onNavigate(t.tab)}
              >
                <div className="metric-icon" style={{ color: t.color }}>
                  <t.icon size={19} />
                </div>
                <span className="metric-label">{t.name}</span>
                <span className="metric-value">
                  {t.value.toLocaleString("es")} <small>{t.unit}</small>
                </span>
                <span className="metric-goal">
                  Meta: {t.goal.toLocaleString("es")}
                </span>
                <span className="metric-track" aria-hidden="true">
                  <span
                    style={{
                      width: `${pct}%`,
                      background: t.color,
                    }}
                  />
                </span>
              </button>
            );
          })}
        </div>
      </section>
      <section className="home-band" aria-labelledby="quick-title">
        <h2 id="quick-title" className="section-title">
          Anotar ahora
        </h2>
        <div className="quick-actions">
          <button onClick={() => onNavigate("exercises")}>
            <Dumbbell />
            <span>Ejercicio</span>
          </button>
          <button onClick={() => onNavigate("meals")}>
            <Utensils />
            <span>Comida</span>
          </button>
          <button onClick={onWater}>
            <Droplets />
            <span>Agua +250 ml</span>
          </button>
          <button onClick={onRest}>
            <Timer />
            <span>Descanso 90 s</span>
          </button>
        </div>
      </section>
      <section className="home-band" aria-labelledby="last-title">
        <div className="section-heading">
          <h2 id="last-title">Último entrenamiento</h2>
          <TrendingUp size={19} style={{ color: "var(--accent)" }} aria-hidden="true" />
        </div>
        {last ? (
          <>
            <p className="last-workout-name">{last.name}</p>
            <p className="text-thin">
              {last.category} ·{" "}
              {last.mode === "cardio"
                ? `${last.minutes ?? 0} min${last.distanceKm ? ` · ${last.distanceKm} km` : ""}`
                : last.mode === "time"
                  ? `${last.sets ?? 1} × ${last.seconds ?? 0} s`
                  : `${last.sets ?? 0} × ${last.reps ?? 0} · ${last.weight ?? 0} kg`}{" "}
              · {dateLabel(last.date)}
              {last.time ? ` (${last.time})` : ""}
            </p>
            <button
              className="text-button"
              onClick={() => onNavigate("progress")}
            >
              Consultar el historial <ArrowRight size={16} />
            </button>
          </>
        ) : (
          <div className="empty-state">
            <Dumbbell size={28} />
            <p>Aquí empieza tu bitácora.</p>
            <span>Registra tu primer ejercicio para seguir tu evolución real.</span>
          </div>
        )}
      </section>
      <p className="local-note">
        Tus registros se guardan en este dispositivo. Crea una copia de
        seguridad desde Ajustes.
      </p>
    </div>
  );
}
