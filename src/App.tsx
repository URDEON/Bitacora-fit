import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  Timer,
  X,
} from "lucide-react";
import {
  Capacitor,
  SystemBars,
  SystemBarsStyle,
  SystemBarType,
} from "@capacitor/core";
import { App as NativeApp } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import {
  ActiveTab,
  BitacoraDB,
  ExerciseVisualInfo,
  SavedRoutine,
  WorkoutEntry,
} from "./types";
import {
  initializePersistentStorage,
  persistDB,
  saveUndoSnapshot,
  mergeDatabases,
  DEFAULT_CHRONO_STATE,
  parseBackupJSON,
  loadSyncFallback,
} from "./services/storage";
import { currentTime, dateLabel, localDate, shiftDate } from "./services/dates";
import { HomeView as HomeViewBase } from "./components/HomeView";
import { ExercisesView as ExercisesViewBase } from "./components/ExercisesView";
import { MealsWaterView as MealsWaterViewBase } from "./components/MealsWaterView";
import { ProgressHistoryView as ProgressHistoryViewBase } from "./components/ProgressHistoryView";
import { ChronoView } from "./components/ChronoView";
import { RunningChronoBanner } from "./components/RunningChronoBanner";
import { GuidedWorkoutCoach, type GuidedWorkoutHandle } from "./components/GuidedWorkoutCoach";
import { GlassNavigation } from "./components/GlassNavigation";
import { BrandMark } from "./components/BrandMark";
import { BrandIntro } from "./components/BrandIntro";
import { BackupExportView as BackupExportViewBase } from "./components/BackupExportView";
import { ExerciseVisualModal } from "./components/ExerciseVisualModal";
import { ConfirmDialog, DialogContext, useDialogController } from "./components/ConfirmDialog";
import { useChrono } from "./hooks/useChrono";
import {
  BackActionResult,
  pushTabHistory,
  resolveBackNavigation,
  ViewBackController,
} from "./services/navigation";

// El reloj actualiza su lectura diez veces por segundo. Las demás vistas solo
// se actualizan cuando cambian sus datos o la selección del usuario.
const HomeView = memo(
  HomeViewBase,
  (a, b) => a.db === b.db && a.currentDate === b.currentDate,
);
const ExercisesView = memo(
  ExercisesViewBase,
  (a, b) =>
    a.db === b.db &&
    a.currentDate === b.currentDate &&
    a.externalSelection === b.externalSelection &&
    a.prefillCardioMinutes === b.prefillCardioMinutes,
);
const MealsWaterView = memo(
  MealsWaterViewBase,
  (a, b) => a.db === b.db && a.currentDate === b.currentDate,
);
const ProgressHistoryView = memo(
  ProgressHistoryViewBase,
  (a, b) => a.db === b.db && a.currentDate === b.currentDate,
);
const BackupExportView = memo(
  BackupExportViewBase,
  (a, b) => a.db === b.db && a.currentDate === b.currentDate,
);

let lastId = Date.now();
const newId = () => (lastId = Math.max(Date.now(), lastId + 1));
const newStringId = () => crypto.randomUUID();
let backListenerQueue: Promise<void> = Promise.resolve();
interface Toast {
  message: string;
  undo?: () => void;
}

export default function App() {
  const [db, setDB] = useState<BitacoraDB | null>(null);
  const [presentingBrand, setPresentingBrand] = useState(true);
  const dbRef = useRef<BitacoraDB | null>(null);
  const [tab, setTab] = useState<ActiveTab>("home");
  const [currentDate, setCurrentDate] = useState(localDate());
  const [saveStatus, setSaveStatus] = useState("Cargando datos…");
  const [storageError, setStorageError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  const [visual, setVisual] = useState<ExerciseVisualInfo | null>(null);
  const [selection, setSelection] = useState<ExerciseVisualInfo | null>(null);
  const closeVisual = useCallback(() => setVisual(null), []);
  const [cardioMinutes, setCardioMinutes] = useState<number | null>(null);
  const pendingWrites = useRef(0);
  const guidedWorkoutRef = useRef<GuidedWorkoutHandle>(null);
  const saveRevision = useRef(0);
  const notify = useCallback((message: string) => setToast({ message }), []);
  const { dialog, dialogApi, resolveCurrent, dismissCurrentDialog } = useDialogController();

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => setPresentingBrand(false), reducedMotion ? 0 : 240);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let active = true;
    initializePersistentStorage()
      .then((value) => {
        if (active) {
          dbRef.current = value;
          setDB(value);
          setSaveStatus("Guardado en el dispositivo");
        }
      })
      .catch((error) => {
        if (active)
          setLoadError(
            error instanceof Error
              ? error.message
              : "No se pudieron leer los datos.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(
      () => setToast(null),
      toast.undo ? 10000 : 4500,
    );
    return () => clearTimeout(id);
  }, [toast]);

  const commit = useCallback(
    (
      update: (previous: BitacoraDB) => BitacoraDB,
      message?: string,
      undo = false,
      skipSnapshotWarning = false,
    ) => {
      let previous = dbRef.current;
      if (!previous) return;
      const disk = loadSyncFallback();
      if (disk.updatedAt > previous.updatedAt) previous = disk;
      if (undo && !skipSnapshotWarning && !saveUndoSnapshot(previous)) {
        void dialogApi
          .confirm({
            title: "Espacio limitado para deshacer",
            message:
              "No se pudo guardar la copia anterior por falta de espacio. Exporta un respaldo JSON para conservarla. Si continúas, podrás deshacer solo mientras el mensaje siga visible. ¿Continuar con este cambio?",
            confirmLabel: "Continuar",
            tone: "danger",
          })
          .then((accepted) => {
            if (accepted) commit(update, message, undo, true);
          });
        return;
      }
      const revision = ++saveRevision.current;
      const result = update(previous);
      const next = {
        ...result,
        updatedAt: Math.max(Date.now(), previous.updatedAt + 1),
      };
      dbRef.current = next;
      setDB(next);
      setSaveStatus("Guardando…");
      pendingWrites.current++;
      void persistDB(next, false)
        .then(() => {
          if (saveRevision.current === revision) setStorageError("");
          if (message)
            setToast({
              message,
              ...(undo
                ? {
                    undo: () => commit((current) => ({
                      ...current,
                      ...Object.fromEntries(Object.entries(previous).filter(([key, value]) =>
                        key !== "updatedAt" && value !== next[key as keyof BitacoraDB]
                      )),
                    }), "Cambio deshecho"),
                  }
                : {}),
            });
        })
        .catch((error) => {
          if (saveRevision.current === revision)
            setStorageError(
              error instanceof Error
                ? error.message
                : "No se pudo guardar. Exporta tus datos antes de cerrar.",
            );
        })
        .finally(() => {
          pendingWrites.current--;
          if (!pendingWrites.current)
            setSaveStatus("Guardado en el dispositivo");
        });
    },
    [dialogApi],
  );
  useEffect(() => {
    const refresh = (event: StorageEvent) => {
      if (event.key !== "bitacora_fit_s20fe_v5" || pendingWrites.current)
        return;
      const fresh = loadSyncFallback();
      if (dbRef.current && fresh.updatedAt > dbRef.current.updatedAt) {
        dbRef.current = fresh;
        setDB(fresh);
      }
    };
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);
  const changeChrono = useCallback(
    (chrono: BitacoraDB["chrono"]) => commit((prev) => ({ ...prev, chrono })),
    [commit],
  );
  // El hook siempre permanece montado, también al navegar entre vistas.
  const chrono = useChrono({
    chrono: db?.chrono || DEFAULT_CHRONO_STATE,
    alarmType: db?.alarmType || "bell",
    onChange: changeChrono,
    onNotify: notify,
  });

  const saveGuidedWorkout = useCallback((entry: WorkoutEntry) => {
    commit(previous => {
      if (previous.workouts.some(workout => workout.id === entry.id)) return previous;
      return {
        ...previous,
        workouts: [...previous.workouts, entry],
        activeSession: previous.activeSession && previous.activeSession.id === entry.sessionId
          ? { ...previous.activeSession, completedIds: Array.from(new Set([...previous.activeSession.completedIds, entry.id])) }
          : previous.activeSession,
      };
    }, "Entrenamiento terminado y guardado");
  }, [commit]);

  const tabRef = useRef<ActiveTab>("home");
  tabRef.current = tab;
  const tabHistoryRef = useRef<ActiveTab[]>([]);
  const viewControllersRef = useRef<
    Partial<Record<ActiveTab, ViewBackController | null>>
  >({});

  const registerExercisesBack = useCallback((c: ViewBackController | null) => {
    viewControllersRef.current.exercises = c;
  }, []);
  const registerMealsBack = useCallback((c: ViewBackController | null) => {
    viewControllersRef.current.meals = c;
  }, []);
  const registerProgressBack = useCallback((c: ViewBackController | null) => {
    viewControllersRef.current.progress = c;
  }, []);
  const registerExportBack = useCallback((c: ViewBackController | null) => {
    viewControllersRef.current.export = c;
  }, []);

  const goTo = useCallback(
    (next: ActiveTab, options?: { resetOnHome?: boolean }) => {
      const current = tabRef.current;
      if (current !== next) {
        tabHistoryRef.current = pushTabHistory(
          tabHistoryRef.current,
          current,
          next,
          { resetOnHome: options?.resetOnHome },
        );
        tabRef.current = next;
        setTab(next);
      } else if (next === "home" && options?.resetOnHome) {
        tabHistoryRef.current = [];
      }
      window.scrollTo({ top: 0, behavior: "instant" });
    },
    [],
  );

  const selectDateOnly = useCallback((date: string) => {
    setCurrentDate(date);
  }, []);

  const openDateInTab = useCallback(
    (date: string, targetTab: ActiveTab = "home") => {
      setCurrentDate(date);
      goTo(targetTab, { resetOnHome: false });
    },
    [goTo],
  );

  const openChrono = useCallback(() => {
    goTo("chrono");
  }, [goTo]);

  const toggleDarkMode = useCallback(() => {
    commit((prev) => ({ ...prev, darkMode: !prev.darkMode }));
  }, [commit]);
  useEffect(() => {
    if (!db) return;
    document.body.classList.toggle("dark-mode", db.darkMode);
    document.documentElement.style.colorScheme = db.darkMode ? "dark" : "light";
    const themeBackground = getComputedStyle(document.body).getPropertyValue("--bg-main").trim();
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", themeBackground);
    if (Capacitor.isNativePlatform()) {
      void SystemBars.setStyle({
        style: db.darkMode ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
        bar: SystemBarType.StatusBar,
      }).catch(() => {});
      void SystemBars.setStyle({
        style: db.darkMode ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
        bar: SystemBarType.NavigationBar,
      }).catch(() => {});
      void StatusBar.setStyle({
        style: db.darkMode ? Style.Dark : Style.Light,
      }).catch(() => {});
      void StatusBar.setBackgroundColor({
        color: themeBackground,
      }).catch(() => {});
    }
  }, [db?.darkMode]);
  const visualRef = useRef<ExerciseVisualInfo | null>(null);
  visualRef.current = visual;
  const dialogOpenRef = useRef(false);
  dialogOpenRef.current = dialog !== null;

  const backHandlerRef = useRef<() => BackActionResult["type"]>(
    () => "exit-app",
  );
  backHandlerRef.current = () => {
    const currentTab = tabRef.current;
    const activeController = viewControllersRef.current[currentTab] ?? null;
    const action = resolveBackNavigation({
      hasOpenDialog: dialogOpenRef.current,
      hasVisualModal: visualRef.current !== null,
      hasActiveEditor: Boolean(activeController?.hasActiveEditor()),
      hasActiveSubview: Boolean(activeController?.hasActiveSubview()),
      currentTab,
      tabHistory: tabHistoryRef.current,
    });
    switch (action.type) {
      case "dismiss-dialog":
        dismissCurrentDialog();
        break;
      case "close-visual-modal":
        setVisual(null);
        break;
      case "close-editor":
        activeController?.closeEditor();
        break;
      case "leave-subview":
        activeController?.leaveSubview();
        break;
      case "navigate-tab":
        tabHistoryRef.current = action.nextHistory;
        tabRef.current = action.tab;
        setTab(action.tab);
        window.scrollTo({ top: 0, behavior: "instant" });
        break;
      case "exit-app":
        if (Capacitor.isNativePlatform()) {
          void NativeApp.minimizeApp().catch(() => {});
        }
        break;
    }
    return action.type;
  };

  useEffect(() => {
    let disposed = false;
    let activeHandle: { remove: () => Promise<void> } | null = null;
    backListenerQueue = backListenerQueue
      .then(async () => {
        if (disposed) return;
        const handle = await NativeApp.addListener("backButton", () => {
          backHandlerRef.current();
        });
        if (disposed) {
          await handle.remove();
        } else {
          activeHandle = handle;
        }
      })
      .catch(() => {});
    return () => {
      disposed = true;
      backListenerQueue = backListenerQueue
        .then(async () => {
          if (activeHandle) {
            const handle = activeHandle;
            activeHandle = null;
            await handle.remove();
          }
        })
        .catch(() => {});
    };
  }, []);

  if (loadError)
    return (
      <DialogContext.Provider value={dialogApi}>
        <main className="app-container">
          <section className="card-soft">
            <h1>No se pudieron cargar los datos</h1>
            <p role="alert">{loadError}</p>
            <button className="btn-main" onClick={() => location.reload()}>
              Volver a intentar
            </button>
            <label className="field-label">
              Restaurar un respaldo JSON válido
              <input
                type="file"
                accept=".json,application/json"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const incoming = parseBackupJSON(await file.text());
                    const accepted = await dialogApi.confirm({
                      title: "Restaurar respaldo",
                      message:
                        "¿Reemplazar los datos de este dispositivo por el respaldo seleccionado?",
                      confirmLabel: "Reemplazar datos",
                      tone: "danger",
                    });
                    if (!accepted) return;
                    await persistDB(incoming);
                    location.reload();
                  } catch (error) {
                    setLoadError(
                      error instanceof Error
                        ? error.message
                        : "No se pudo restaurar el respaldo.",
                    );
                  } finally {
                    e.target.value = "";
                  }
                }}
              />
            </label>
          </section>
        </main>
        <ConfirmDialog dialog={dialog} onResolve={resolveCurrent} />
      </DialogContext.Provider>
    );
  if (!db || presentingBrand) return <BrandIntro dark={db?.darkMode} />;

  const deleteRecord = (
    collection: "workouts" | "meals" | "waterLogs" | "bodyMetrics",
    id: number,
  ) =>
    commit(
      (prev) => ({
        ...prev,
        [collection]: prev[collection].filter((item) => item.id !== id),
      }),
      "Registro eliminado",
      true,
    );
  const startRoutine = async (routine: SavedRoutine): Promise<boolean> => {
    if (dbRef.current?.activeSession) {
      const accepted = await dialogApi.confirm({
        title: "Sesión en curso",
        message:
          "Ya tienes una sesión en curso. ¿Quieres finalizarla y comenzar esta rutina? Los resultados guardados se conservarán.",
        confirmLabel: "Iniciar rutina",
        tone: "danger",
      });
      if (!accepted) return false;
    }
    commit(
      (prev) => ({
        ...prev,
        workoutSessions: prev.activeSession
          ? [
              ...prev.workoutSessions,
              { ...prev.activeSession, finishedAt: new Date().toISOString() },
            ]
          : prev.workoutSessions,
        activeSession: {
          id: newStringId(),
          title: routine.title,
          startedAt: new Date().toISOString(),
          exercises: structuredClone(routine.exercises),
          completedIds: [],
        },
      }),
      "Sesión iniciada: registra tus resultados",
    );
    return true;
  };
  const addWater = () =>
    commit(
      (prev) => ({
        ...prev,
        waterLogs: [
          ...prev.waterLogs,
          {
            id: newId(),
            date: currentDate,
            time: currentTime(),
            ml: 250,
            label: "Vaso de agua",
          },
        ],
      }),
      "250 ml de agua guardados",
    );
  const saveDotClass = storageError
    ? "error-dot"
    : saveStatus === "Guardando…"
      ? "saving-dot"
      : "saved-dot";

  return (
    <DialogContext.Provider value={dialogApi}>
      <div
        className="app-shell"
        data-section={tab}
        data-theme={db.darkMode ? "dark" : "light"}
      >
        <a href="#main" className="skip-link">
          Ir al contenido
        </a>
        <header className="app-header">
          <div className="header-inner">
            <div className="top-bar">
              <div className="brand">
                <BrandMark className="brand-mark" />
                <div>
                  <span className="app-logo title-heavy">
                    Bitácora Fit <strong>Pro</strong>
                  </span>
                  <span className="save-indicator" role="status">
                    <span className={saveDotClass} />
                    {storageError ? "Error al guardar" : saveStatus}
                  </span>
                </div>
              </div>
              <div className="header-actions">
                <button
                  className={`header-chrono-pill ${tab === "chrono" ? "selected" : ""} ${db.chrono.running ? "is-running" : ""}`}
                  aria-label="Cronómetro y descanso"
                  onClick={openChrono}
                >
                  <Timer size={18} />
                  <span>Tiempo</span>
                </button>
                <button
                  className="icon-btn"
                  aria-label={
                    db.darkMode ? "Activar modo claro" : "Activar modo oscuro"
                  }
                  onClick={toggleDarkMode}
                >
                  {db.darkMode ? <Sun size={19} /> : <Moon size={19} />}
                </button>
              </div>
            </div>
            <div className="date-selector">
              <button
                className="date-btn"
                aria-label="Día anterior"
                onClick={() => setCurrentDate((d) => shiftDate(d, -1))}
              >
                <ChevronLeft size={20} />
              </button>
              <div className="date-center-bar">
                <label className="date-input-wrap">
                  <span className="sr-only">Fecha de los registros</span>
                  <input
                    aria-label="Fecha de los registros"
                    type="date"
                    value={currentDate}
                    onChange={(e) => {
                      if (
                        e.target.value &&
                        /^\d{4}-\d{2}-\d{2}$/.test(e.target.value)
                      )
                        setCurrentDate(e.target.value);
                    }}
                  />
                </label>
                {currentDate !== localDate() && (
                  <button
                    type="button"
                    className="today-button"
                    onClick={() => setCurrentDate(localDate())}
                  >
                    Volver a hoy
                  </button>
                )}
              </div>
              <button
                className="date-btn"
                aria-label="Día siguiente"
                onClick={() => setCurrentDate((d) => shiftDate(d, 1))}
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </header>
        <main id="main" className="app-container" tabIndex={-1}>
          {storageError && (
            <div role="alert" className="error-banner">
              {storageError}
              <button onClick={() => goTo("export")}>Abrir respaldos</button>
            </div>
          )}
          {db.chrono.running && tab !== "chrono" && (
            <RunningChronoBanner chrono={db.chrono} onOpen={openChrono} />
          )}
          <GuidedWorkoutCoach
            ref={guidedWorkoutRef}
            alarmType={db.alarmType}
            onBegin={() => { if (db.chrono.running) chrono.onToggleStartPause(); }}
            onComplete={saveGuidedWorkout}
          />
          <div className="tab-stage" hidden={tab !== "home"}>
            <HomeView
              db={db}
              currentDate={currentDate}
              onNavigate={goTo}
              onWater={addWater}
              onRest={() => {
                chrono.startRest(90);
                goTo("chrono");
              }}
            />
          </div>
          <div className="tab-stage" hidden={tab !== "exercises"}>
            <div className="page-heading compact">
              <p className="eyebrow">MOVIMIENTO CON INTENCIÓN</p>
              <h1>Entrenar</h1>
              <p className="text-thin">{dateLabel(currentDate)}</p>
            </div>
            <ExercisesView
              db={db}
              currentDate={currentDate}
              onOpenChrono={openChrono}
              onStartGuidedWorkout={(entry) => {
                void guidedWorkoutRef.current?.start({ ...entry, id: newId() });
              }}
            onSaveWorkout={(entry, id) => {
              const savedId = id ?? newId();
              commit(
                (prev) => ({
                  ...prev,
                  workouts:
                    id === null
                      ? [...prev.workouts, { ...entry, id: savedId }]
                      : prev.workouts.map((w) =>
                          w.id === id ? { ...entry, id: savedId } : w,
                        ),
                  activeSession:
                    prev.activeSession &&
                    entry.sessionId === prev.activeSession.id
                      ? {
                          ...prev.activeSession,
                          completedIds: Array.from(
                            new Set([
                              ...prev.activeSession.completedIds,
                              savedId,
                            ]),
                          ),
                        }
                      : prev.activeSession,
                }),
                id === null ? "Ejercicio guardado" : "Ejercicio actualizado",
              );
              if (id === null && entry.mode !== "cardio" && db.chrono.autoStartOnSet && entry.restSeconds !== 0)
                chrono.startRest(entry.restSeconds ?? 90);
            }}
            onDeleteWorkout={(id) => deleteRecord("workouts", id)}
            onDuplicateWorkout={(entry) =>
              commit(
                (prev) => ({
                  ...prev,
                  workouts: [
                    ...prev.workouts,
                    {
                      ...entry,
                      id: newId(),
                      date: currentDate,
                      time: currentTime(),
                      sessionId: undefined,
                      sessionExerciseIndex: undefined,
                    },
                  ],
                }),
                "Ejercicio duplicado",
              )
            }
            onSaveCustomExercise={(category, name) =>
              commit(
                (prev) => ({
                  ...prev,
                  customCatalog: {
                    ...prev.customCatalog,
                    [category]: Array.from(
                      new Set([...(prev.customCatalog[category] || []), name]),
                    ),
                  },
                }),
                "Ejercicio añadido al catálogo",
              )
            }
            onOpenVisualModal={setVisual}
            onLoadRoutineToDay={startRoutine}
            onSaveTodayAsRoutine={(title) => {
              const entries = db.workouts.filter((w) => w.date === currentDate);
              if (!entries.length) {
                notify("Registra ejercicios antes de guardar una rutina.");
                return;
              }
              commit(
                (prev) => ({
                  ...prev,
                  routines: [
                    ...prev.routines,
                    {
                      id: newStringId(),
                      title,
                      subtitle: `${entries.length} ejercicios`,
                      color: "#D94E28",
                      exercises: entries.map(
                        ({
                          id,
                          date,
                          time,
                          notes,
                          sessionId,
                          sessionExerciseIndex,
                          ...e
                        }) => e,
                      ),
                    },
                  ],
                }),
                "Rutina guardada",
              );
            }}
            onDeleteRoutine={(id) =>
              commit(
                (prev) => ({
                  ...prev,
                  routines: prev.routines.filter((r) => r.id !== id),
                }),
                "Rutina eliminada",
                true,
              )
            }
            onToggleAutoRest={(enabled) =>
              commit((prev) => ({
                ...prev,
                chrono: { ...prev.chrono, autoStartOnSet: enabled },
              }))
            }
            prefillCardioMinutes={cardioMinutes}
            onConsumePrefillCardio={() => setCardioMinutes(null)}
            externalSelection={selection}
            onConsumeSelection={() => setSelection(null)}
            onSaveRoutine={(routine) =>
              commit(
                (prev) => ({
                  ...prev,
                  routines: prev.routines.some((r) => r.id === routine.id)
                    ? prev.routines.map((r) =>
                        r.id === routine.id ? routine : r,
                      )
                    : [...prev.routines, routine],
                }),
                "Rutina guardada",
              )
            }
            onToggleFavorite={(name) =>
              commit((prev) => ({
                ...prev,
                favoriteExercises: prev.favoriteExercises.includes(name)
                  ? prev.favoriteExercises.filter((n) => n !== name)
                  : [...prev.favoriteExercises, name],
              }))
            }
            onUpdateSession={(session) =>
              commit((prev) => ({ ...prev, activeSession: session }))
            }
            onFinishSession={() =>
              commit(
                (prev) => ({
                  ...prev,
                  workoutSessions: prev.activeSession
                    ? [
                        ...prev.workoutSessions,
                        {
                          ...prev.activeSession,
                          finishedAt: new Date().toISOString(),
                        },
                      ]
                    : prev.workoutSessions,
                  activeSession: null,
                }),
                "Sesión finalizada",
              )
            }
            registerBackController={registerExercisesBack}
          />
        </div>
        <div className="tab-stage" hidden={tab !== "meals"}>
          <div className="page-heading compact">
            <p className="eyebrow">ENERGÍA PARA TU DÍA</p>
            <h1>Alimentación</h1>
            <p className="text-thin">{dateLabel(currentDate)}</p>
          </div>
          <MealsWaterView
            db={db}
            currentDate={currentDate}
            onAddOrUpdateWater={(entry, id) =>
              commit(
                (prev) => ({
                  ...prev,
                  waterLogs:
                    id === null
                      ? [...prev.waterLogs, { ...entry, id: newId() }]
                      : prev.waterLogs.map((w) =>
                          w.id === id ? { ...entry, id } : w,
                        ),
                }),
                id === null ? "Agua registrada" : "Agua actualizada",
              )
            }
            onDeleteWater={(id) => deleteRecord("waterLogs", id)}
            onSaveMeal={(entry, id) =>
              commit(
                (prev) => ({
                  ...prev,
                  meals:
                    id === null
                      ? [...prev.meals, { ...entry, id: newId() }]
                      : prev.meals.map((m) =>
                          m.id === id ? { ...entry, id } : m,
                        ),
                }),
                id === null ? "Comida guardada" : "Comida actualizada",
              )
            }
            onDuplicateMeal={(entry) =>
              commit(
                (prev) => ({
                  ...prev,
                  meals: [
                    ...prev.meals,
                    {
                      ...entry,
                      id: newId(),
                      date: currentDate,
                      time: currentTime(),
                    },
                  ],
                }),
                "Comida duplicada",
              )
            }
            onDeleteMeal={(id) => deleteRecord("meals", id)}
            onAddCustomFood={(food) =>
              commit(
                (prev) => ({
                  ...prev,
                  customFoods: [...prev.customFoods, food],
                }),
                "Alimento guardado",
              )
            }
            onUpdateGoalsQuick={(calories, proteinG, waterMl) =>
              commit(
                (prev) => ({
                  ...prev,
                  goals: { ...prev.goals, calories, proteinG, waterMl },
                }),
                "Objetivos actualizados",
              )
            }
            onSaveFrequentMeal={(meal) =>
              commit(
                (prev) => ({
                  ...prev,
                  savedMeals: [
                    ...prev.savedMeals,
                    { ...meal, id: newStringId() },
                  ],
                }),
                "Comida frecuente guardada",
              )
            }
            onDeleteFrequentMeal={(id) =>
              commit(
                (prev) => ({
                  ...prev,
                  savedMeals: prev.savedMeals.filter((m) => m.id !== id),
                }),
                "Comida frecuente eliminada",
                true,
              )
            }
            registerBackController={registerMealsBack}
          />
        </div>
        <div className="tab-stage" hidden={tab !== "progress"}>
          <div className="page-heading compact">
            <p className="eyebrow">CADA REGISTRO SUMA</p>
            <h1>Progreso</h1>
            <p className="text-thin">Historial y evolución personal</p>
          </div>
          <ProgressHistoryView
            db={db}
            currentDate={currentDate}
            onSelectDate={selectDateOnly}
            onOpenDateInTab={openDateInTab}
            onSaveBodyMetric={(entry, id) =>
              commit(
                (prev) => ({
                  ...prev,
                  bodyMetrics:
                    id === null
                      ? [...prev.bodyMetrics, { ...entry, id: newId() }]
                      : prev.bodyMetrics.map((m) =>
                          m.id === id ? { ...entry, id } : m,
                        ),
                }),
                id === null ? "Medición guardada" : "Medición actualizada",
              )
            }
            onDeleteBodyMetric={(id) => deleteRecord("bodyMetrics", id)}
            registerBackController={registerProgressBack}
          />
        </div>
        <div className="tab-stage" hidden={tab !== "chrono"}>
          <div className="page-heading compact chrono-page-heading">
            <p className="eyebrow">PRECISIÓN Y RITMO</p>
            <h1>Tu tiempo</h1>
            <p className="text-thin">Descanso, cronómetro e intervalos</p>
          </div>
          <ChronoView
            chrono={db.chrono}
            alarmType={db.alarmType}
            active={tab === "chrono"}
            {...chrono}
            onSendToCardio={(minutes) => {
              setCardioMinutes(minutes);
              goTo("exercises");
            }}
            onChangeAlarmType={(alarmType) =>
              commit((prev) => ({ ...prev, alarmType }))
            }
          />
        </div>
        <div className="tab-stage" hidden={tab !== "export"}>
          <div className="page-heading compact">
            <p className="eyebrow">PREFERENCIAS Y DATOS</p>
            <h1>Ajustes</h1>
            <p className="text-thin">
              Apariencia, objetivos, documentos y copias de seguridad
            </p>
          </div>
          <BackupExportView
            db={db}
            currentDate={currentDate}
            onToggleDarkMode={toggleDarkMode}
            onRestoreBackup={(incoming, mode) =>
              commit(
                (prev) =>
                  mode === "merge" ? mergeDatabases(prev, incoming) : incoming,
                "Copia de seguridad restaurada",
                true,
              )
            }
            onUpdateAllGoals={(goals) =>
              commit((prev) => ({ ...prev, goals }), "Objetivos actualizados")
            }
            onNotify={notify}
            registerBackController={registerExportBack}
          />
        </div>
      </main>
      <GlassNavigation active={tab} onNavigate={(next) => goTo(next, { resetOnHome: next === "home" })} />
      {toast && (
        <div className="toast-banner" role="status">
          <span>{toast.message}</span>
          {toast.undo && (
            <button
              className="text-button"
              onClick={() => {
                toast.undo?.();
                setToast(null);
              }}
            >
              Deshacer
            </button>
          )}
          <button
            className="toast-close"
            aria-label="Cerrar mensaje"
            onClick={() => setToast(null)}
          >
            <X size={18} />
          </button>
        </div>
      )}
      {visual && (
        <ExerciseVisualModal
          info={visual}
          customPhotos={db.customExercisePhotos[visual.name] || []}
          onClose={closeVisual}
          onSelectExercise={(info) => {
            setSelection(info);
            setVisual(null);
            goTo("exercises");
          }}
          onAddCustomPhoto={(name, dataUrl) =>
            commit(
              (prev) => ({
                ...prev,
                customExercisePhotos: {
                  ...prev.customExercisePhotos,
                  [name]: [...(prev.customExercisePhotos[name] || []), dataUrl],
                },
              }),
              "Foto guardada",
            )
          }
          onRemoveCustomPhoto={(name, index) =>
            commit(
              (prev) => ({
                ...prev,
                customExercisePhotos: {
                  ...prev.customExercisePhotos,
                  [name]: (prev.customExercisePhotos[name] || []).filter(
                    (_, i) => i !== index,
                  ),
                },
              }),
              "Foto eliminada",
              true,
            )
          }
        />
      )}
      <ConfirmDialog dialog={dialog} onResolve={resolveCurrent} />
      </div>
    </DialogContext.Provider>
  );
}
