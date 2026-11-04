import React, { useEffect, useRef, useState } from 'react';
import {
  Calculator,
  Download,
  FileSpreadsheet,
  FileText,
  HardDriveDownload,
  Moon,
  RotateCcw,
  ShieldCheck,
  Sun,
  Upload,
} from 'lucide-react';
import { BitacoraDB, DailyGoals } from '../types';
import {
  exportBackupJSON,
  exportExcelReport,
  exportPDFReport,
  exportWordReport,
} from '../services/exportService';
import { loadUndoSnapshot, parseBackupJSON, saveUndoSnapshot } from '../services/storage';
import type { ViewBackController } from '../services/navigation';
import { useDialog } from './ConfirmDialog';

interface BackupExportViewProps {
  db: BitacoraDB;
  currentDate: string;
  onToggleDarkMode?: () => void;
  onRestoreBackup: (incoming: BitacoraDB, mode: 'merge' | 'replace') => void;
  onUpdateAllGoals: (goals: DailyGoals) => void;
  onNotify: (msg: string) => void;
  registerBackController?: (controller: ViewBackController | null) => void;
}

export const BackupExportView: React.FC<BackupExportViewProps> = ({
  db,
  currentDate,
  onToggleDarkMode,
  onRestoreBackup,
  onUpdateAllGoals,
  onNotify,
  registerBackController,
}) => {
  const [scope, setScope] = useState<'all' | 'day'>('all');
  const [pendingBackup, setPendingBackup] = useState<BitacoraDB | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { confirm: confirmDialog, alert: showAlert } = useDialog();
  const pendingBackupRef = useRef(pendingBackup);
  pendingBackupRef.current = pendingBackup;

  useEffect(() => {
    if (!registerBackController) return;
    registerBackController({
      hasActiveEditor: () => pendingBackupRef.current !== null,
      closeEditor: () => {
        if (pendingBackupRef.current !== null) {
          setPendingBackup(null);
          return true;
        }
        return false;
      },
      hasActiveSubview: () => false,
      leaveSubview: () => false,
    });
    return () => registerBackController(null);
  }, [registerBackController]);

  // TDEE / Macro Goal Calculator helper
  const [calcSex, setCalcSex] = useState<'m' | 'f'>('m');
  const [calcWeight, setCalcWeight] = useState(String([...db.bodyMetrics].sort((a,b)=>b.date.localeCompare(a.date))[0]?.weightKg || ''));
  const [calcHeight, setCalcHeight] = useState('');
  const [calcAge, setCalcAge] = useState('');
  const [calcActivity, setCalcActivity] = useState('1.55');
  const [calcGoalType, setCalcGoalType] = useState<'cut' | 'maint' | 'bulk'>('cut');
  const [targetWeightInput, setTargetWeightInput] = useState(String(db.goals.targetWeightKg));

  const [calcErrors, setCalcErrors] = useState<Record<string,string>>({});
  const [goalInputs,setGoalInputs] = useState(Object.fromEntries(Object.entries(db.goals).map(([k,v])=>[k,String(v)])));
  const [goalErrors,setGoalErrors] = useState<Record<string,string>>({});
  useEffect(()=>setGoalInputs(Object.fromEntries(Object.entries(db.goals).map(([k,v])=>[k,String(v)]))),[db.goals]);
  const goalFields = [
    ['calories','Calorías diarias (kcal)',1,20000],['proteinG','Proteínas diarias (g)',1,2000],
    ['waterMl','Agua diaria (ml)',1,30000],['targetWeightKg','Peso objetivo (kg)',1,700],['weeklyWorkoutDays','Días de entrenamiento por semana',1,7],
  ] as const;
  const saveManualGoals = () => {
    const errors: Record<string,string> = {};
    for(const [key,,min,max] of goalFields) {
      const n=Number(goalInputs[key]);
      if(!goalInputs[key]?.trim() || !Number.isFinite(n) || n<min || n>max || (key==='weeklyWorkoutDays' && !Number.isInteger(n))) errors[key]=`Ingresa ${key==='weeklyWorkoutDays'?'un entero':'un número'} entre ${min} y ${max}.`;
    }
    setGoalErrors(errors); if(Object.keys(errors).length) return;
    onUpdateAllGoals(Object.fromEntries(Object.entries(goalInputs).map(([k,v])=>[k,Number(v)])) as unknown as DailyGoals);
    onNotify('Objetivos diarios guardados.');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if(file.size > 50*1024*1024) throw new Error('El respaldo supera el límite de 50 MB.');
      const text = await file.text();
      const parsed = parseBackupJSON(text);
      setPendingBackup(parsed);
    } catch (err) {
      await showAlert({
        title: 'Archivo no válido',
        message: err instanceof Error ? err.message : 'Archivo inválido.',
      });
    } finally {
      e.target.value = '';
    }
  };

  const applySmartMacroCalculator = () => {
    const values = {calcWeight,calcHeight,calcAge,targetWeightInput};
    const ranges: Record<string,[number,number]> = {calcWeight:[20,400],calcHeight:[100,250],calcAge:[18,100],targetWeightInput:[20,400]};
    const errors: Record<string,string> = {};
    for(const [key,value] of Object.entries(values)) {
      const [min,max] = ranges[key]; const n=Number(value);
      if(!value.trim() || !Number.isFinite(n) || n<min || n>max) errors[key]=`Ingresa un valor entre ${min} y ${max}.`;
    }
    setCalcErrors(errors); if(Object.keys(errors).length) return;
    const w = Number(calcWeight), h=Number(calcHeight), a=Number(calcAge), act=Number(calcActivity);
    // Mifflin-St Jeor BMR
    const bmr = calcSex === 'm' ? 10 * w + 6.25 * h - 5 * a + 5 : 10 * w + 6.25 * h - 5 * a - 161;
    let tdee = bmr * act;
    if (calcGoalType === 'cut') tdee -= 400;
    if (calcGoalType === 'bulk') tdee += 300;

    const recKcal = Math.max(1200, Math.round(tdee / 10) * 10);
    const recProt = Math.round(w * (calcGoalType === 'cut' ? 2.0 : 1.8));
    const recWater = Math.round((w * 35) / 100) * 100;
    const targetW = Number(targetWeightInput);

    onUpdateAllGoals({
      calories: recKcal,
      proteinG: recProt,
      waterMl: recWater,
      targetWeightKg: targetW,
      weeklyWorkoutDays: db.goals.weeklyWorkoutDays,
    });
    onNotify(`Metas actualizadas: ${recKcal} kcal • ${recProt}g proteína • ${recWater} ml agua`);
  };

  const undoSnap = loadUndoSnapshot();

  return (
    <div className="fade-view">
      {/* 1. APARIENCIA REAL (CLARO / OSCURO PERSISTENTE) */}
      {onToggleDarkMode && (
        <section className="card-soft" aria-labelledby="appearance-title">
          <div className="block-head">
            <div>
              <h2 id="appearance-title" className="block-title">
                Apariencia
              </h2>
              <p className="block-subtitle">
                Elige el contraste visual para interiores de gimnasio o lectura diurna.
              </p>
            </div>
          </div>
          <div className="appearance-grid">
            <button
              type="button"
              className={`appearance-option ${!db.darkMode ? 'active' : ''}`}
              aria-pressed={!db.darkMode}
              onClick={() => {
                if (db.darkMode) onToggleDarkMode();
              }}
            >
              <Sun size={19} />
              <span>Modo claro</span>
            </button>
            <button
              type="button"
              className={`appearance-option ${db.darkMode ? 'active' : ''}`}
              aria-pressed={db.darkMode}
              onClick={() => {
                if (!db.darkMode) onToggleDarkMode();
              }}
            >
              <Moon size={19} />
              <span>Modo oscuro</span>
            </button>
          </div>
        </section>
      )}

      {/* 2. MIS OBJETIVOS DIARIOS + CALCULADORA ORIENTATIVA PLEGABLE */}
      <section className="card-soft" aria-labelledby="goals-settings-title">
        <div className="block-head">
          <div>
            <h2 id="goals-settings-title" className="block-title">
              Mis objetivos personales
            </h2>
            <p className="block-subtitle">
              Estas metas alimentan las barras de progreso de Inicio, Alimentación y Peso corporal.
            </p>
          </div>
        </div>

        <div className="grid-2">
          {goalFields.map(([key, label, min, max]) => (
            <div key={key}>
              <label className="lbl" htmlFor={`goal-${key}`}>
                {label}
              </label>
              <input
                id={`goal-${key}`}
                className="input-clean"
                type="number"
                min={min}
                max={max}
                step={key === 'weeklyWorkoutDays' ? '1' : 'any'}
                value={goalInputs[key]}
                onChange={(e) => setGoalInputs((prev) => ({ ...prev, [key]: e.target.value }))}
                aria-invalid={!!goalErrors[key]}
                aria-describedby={`goal-${key}-error`}
              />
              {goalErrors[key] && (
                <p id={`goal-${key}-error`} role="alert" className="field-error">
                  {goalErrors[key]}
                </p>
              )}
            </div>
          ))}
        </div>
        <button className="btn-main" type="button" onClick={saveManualGoals}>
          Guardar objetivos
        </button>

        <details className="tdee-details" open={Object.keys(calcErrors).length > 0 || undefined}>
          <summary>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <Calculator size={16} /> Calculadora orientativa de metas (TDEE)
            </span>
            <span className="text-thin">Opcional</span>
          </summary>
          <div className="tdee-body">
            <p className="block-subtitle" style={{ marginBottom: 'var(--space-3)' }}>
              Estima calorías, proteína e hidratación diaria según tus medidas y actividad semanal.
            </p>

            <div className="grid-2">
              <div>
                <label className="lbl" htmlFor="settings-calcSex">Sexo biológico</label>
                <select
                  className="select-clean"
                  id="settings-calcSex"
                  value={calcSex}
                  onChange={(e) => setCalcSex(e.target.value as 'm' | 'f')}
                >
                  <option value="m">Hombre</option>
                  <option value="f">Mujer</option>
                </select>
              </div>
              <div>
                <label className="lbl" htmlFor="settings-calcAge">Edad (años)</label>
                <input
                  type="number"
                  className="input-clean"
                  id="settings-calcAge"
                  value={calcAge}
                  onChange={(e) => setCalcAge(e.target.value)}
                  aria-invalid={!!calcErrors.calcAge}
                  aria-describedby="settings-calcAge-error"
                />
                {calcErrors.calcAge && (
                  <p id="settings-calcAge-error" role="alert" className="field-error">
                    {calcErrors.calcAge}
                  </p>
                )}
              </div>
            </div>

            <div className="grid-3">
              <div>
                <label className="lbl" htmlFor="settings-calcWeight">Peso actual (kg)</label>
                <input
                  type="number"
                  className="input-clean"
                  id="settings-calcWeight"
                  value={calcWeight}
                  onChange={(e) => setCalcWeight(e.target.value)}
                  aria-invalid={!!calcErrors.calcWeight}
                  aria-describedby="settings-calcWeight-error"
                />
                {calcErrors.calcWeight && (
                  <p id="settings-calcWeight-error" role="alert" className="field-error">
                    {calcErrors.calcWeight}
                  </p>
                )}
              </div>
              <div>
                <label className="lbl" htmlFor="settings-calcHeight">Altura (cm)</label>
                <input
                  type="number"
                  className="input-clean"
                  id="settings-calcHeight"
                  value={calcHeight}
                  onChange={(e) => setCalcHeight(e.target.value)}
                  aria-invalid={!!calcErrors.calcHeight}
                  aria-describedby="settings-calcHeight-error"
                />
                {calcErrors.calcHeight && (
                  <p id="settings-calcHeight-error" role="alert" className="field-error">
                    {calcErrors.calcHeight}
                  </p>
                )}
              </div>
              <div>
                <label className="lbl" htmlFor="settings-targetWeightInput">Peso meta (kg)</label>
                <input
                  type="number"
                  className="input-clean"
                  id="settings-targetWeightInput"
                  value={targetWeightInput}
                  onChange={(e) => setTargetWeightInput(e.target.value)}
                  aria-invalid={!!calcErrors.targetWeightInput}
                  aria-describedby="settings-targetWeightInput-error"
                />
                {calcErrors.targetWeightInput && (
                  <p id="settings-targetWeightInput-error" role="alert" className="field-error">
                    {calcErrors.targetWeightInput}
                  </p>
                )}
              </div>
            </div>

            <div className="grid-2">
              <div>
                <label className="lbl" htmlFor="settings-calcActivity">Nivel de actividad</label>
                <select
                  className="select-clean"
                  id="settings-calcActivity"
                  value={calcActivity}
                  onChange={(e) => setCalcActivity(e.target.value)}
                >
                  <option value="1.375">Ligero (1–3 días/sem)</option>
                  <option value="1.55">Moderado (3–5 días/sem)</option>
                  <option value="1.725">Intenso (6–7 días/sem)</option>
                </select>
              </div>
              <div>
                <label className="lbl" htmlFor="settings-calcGoalType">Objetivo físico</label>
                <select
                  className="select-clean"
                  id="settings-calcGoalType"
                  value={calcGoalType}
                  onChange={(e) => setCalcGoalType(e.target.value as 'cut' | 'maint' | 'bulk')}
                >
                  <option value="cut">Perder grasa (-400 kcal)</option>
                  <option value="maint">Mantener / Recomposición</option>
                  <option value="bulk">Ganar músculo (+300 kcal)</option>
                </select>
              </div>
            </div>

            <button type="button" className="btn-main subtle" onClick={applySmartMacroCalculator}>
              Calcular y aplicar metas orientativas
            </button>
          </div>
        </details>
      </section>

      {/* 3. GUARDADO PERMANENTE + COPIAS DE SEGURIDAD Y RESTAURACIÓN */}
      <section className="card-soft" aria-labelledby="backup-settings-title">
        <div className="block-head">
          <div>
            <h2 id="backup-settings-title" className="block-title">
              <ShieldCheck size={19} style={{ color: 'var(--accent-green)' }} />
              Copias de seguridad locales
            </h2>
            <p className="block-subtitle">
              Tus datos viven en este dispositivo sin conexión. Exporta respaldos <code>.json</code> periódicamente para conservarlos si cambias de teléfono.
            </p>
          </div>
        </div>

        <div className="db-counter-strip" aria-label="Resumen de registros guardados">
          <div className="db-counter-cell">
            <strong>{db.workouts.length}</strong>
            <span>Ejercicios</span>
          </div>
          <div className="db-counter-cell">
            <strong>{db.meals.length}</strong>
            <span>Comidas</span>
          </div>
          <div className="db-counter-cell">
            <strong>{db.waterLogs.length}</strong>
            <span>Tomas de agua</span>
          </div>
          <div className="db-counter-cell">
            <strong>{db.bodyMetrics.length}</strong>
            <span>Pesajes</span>
          </div>
        </div>

        <div className="grid-2">
          <button
            type="button"
            className="btn-main green"
            onClick={async () => {
              try {
                const msg = await exportBackupJSON(db, currentDate);
                onNotify(msg);
              } catch (e) {
                await showAlert({
                  title: 'Error al exportar respaldo',
                  message: e instanceof Error ? e.message : 'Error al exportar respaldo',
                });
              }
            }}
          >
            <HardDriveDownload size={17} /> Crear respaldo (.json)
          </button>

          <button
            type="button"
            className="btn-main blue"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={17} /> Restaurar datos
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
        </div>

        {pendingBackup && (
          <div className="pending-backup-panel">
            <div className="ticket-title">Archivo de respaldo detectado</div>
            <p className="ticket-meta" style={{ marginBottom: 'var(--space-3)' }}>
              Contiene <strong>{pendingBackup.workouts.length} ejercicios</strong>,{' '}
              <strong>{pendingBackup.meals.length} comidas</strong>,{' '}
              <strong>{pendingBackup.waterLogs.length} tomas de agua</strong> y{' '}
              <strong>{pendingBackup.bodyMetrics.length} pesajes</strong>.
            </p>
            <div className="grid-2">
              <button
                type="button"
                className="btn-main green"
                onClick={() => {
                  onRestoreBackup(pendingBackup, 'merge');
                  setPendingBackup(null);
                }}
              >
                Combinar datos
              </button>
              <button
                type="button"
                className="btn-main amber"
                onClick={async () => {
                  const backup = pendingBackup;
                  const accepted = await confirmDialog({
                    title: 'Reemplazar todos los datos',
                    message:
                      '¿Reemplazar todos los datos por este respaldo? Se conservará una copia del estado actual para recuperar desde Ajustes.',
                    confirmLabel: 'Reemplazar todo',
                    tone: 'danger',
                  });
                  if (!accepted) return;
                  if (!saveUndoSnapshot(db)) {
                    await showAlert({
                      title: 'Espacio insuficiente',
                      message:
                        'No se pudo conservar el estado actual. Exporta un respaldo JSON y libera espacio antes de reemplazar los datos.',
                    });
                    return;
                  }
                  onRestoreBackup(backup, 'replace');
                  setPendingBackup(null);
                }}
              >
                Reemplazar todo
              </button>
            </div>
            <button
              type="button"
              className="btn-main subtle"
              onClick={() => setPendingBackup(null)}
            >
              Cancelar importación
            </button>
          </div>
        )}

        {undoSnap && (
          <button
            type="button"
            className="pill-action"
            style={{ width: '100%', justifyContent: 'center', marginTop: 'var(--space-2)' }}
            onClick={async () => {
              const accepted = await confirmDialog({
                title: 'Recuperar estado anterior',
                message: '¿Recuperar el estado anterior y reemplazar los datos actuales?',
                confirmLabel: 'Recuperar estado',
                tone: 'danger',
              });
              if (accepted) onRestoreBackup(undoSnap, 'replace');
            }}
          >
            <RotateCcw size={14} /> Recuperar estado previo a la última restauración/borrado
          </button>
        )}
      </section>

      {/* 4. EXPORTACIÓN MULTIFORMATO EXCEL, PDF Y WORD */}
      <section className="card-cut" aria-labelledby="export-reports-title">
        <div className="block-head">
          <div>
            <h2 id="export-reports-title" className="block-title">
              Exportar reportes (Excel, PDF, Word)
            </h2>
            <p className="block-subtitle">
              Compila tus registros separados por <strong>Fuerza</strong>, <strong>Cardio</strong>,{' '}
              <strong>Comidas</strong>, <strong>Agua</strong> y <strong>Peso corporal</strong>.
            </p>
          </div>
        </div>

        <div className="lbl">
          <span>Período a exportar</span>
        </div>
        <div className="mode-switcher">
          <button
            type="button"
            className={`mode-card ${scope === 'all' ? 'active' : ''}`}
            onClick={() => setScope('all')}
          >
            <span className="m-title">Todo el historial</span>
            <span className="m-sub">Todas las fechas</span>
          </button>
          <button
            type="button"
            className={`mode-card ${scope === 'day' ? 'active' : ''}`}
            onClick={() => setScope('day')}
          >
            <span className="m-title">Solo día activo</span>
            <span className="m-sub">{currentDate}</span>
          </button>
        </div>

        <div className="export-format-grid">
          <button
            type="button"
            className="btn-main green"
            onClick={async () => {
              try {
                const msg = await exportExcelReport(db, scope, currentDate);
                onNotify(msg);
              } catch (e) {
                await showAlert({
                  title: 'Error al exportar Excel',
                  message: e instanceof Error ? e.message : 'Error al exportar Excel',
                });
              }
            }}
          >
            <FileSpreadsheet size={16} /> Excel (.xlsx)
          </button>

          <button
            type="button"
            className="btn-main"
            onClick={async () => {
              try {
                const msg = await exportPDFReport(db, scope, currentDate);
                onNotify(msg);
              } catch (e) {
                await showAlert({
                  title: 'Error al exportar PDF',
                  message: e instanceof Error ? e.message : 'Error al exportar PDF',
                });
              }
            }}
          >
            <Download size={16} /> PDF (.pdf)
          </button>

          <button
            type="button"
            className="btn-main blue"
            onClick={async () => {
              try {
                const msg = await exportWordReport(db, scope, currentDate);
                onNotify(msg);
              } catch (e) {
                await showAlert({
                  title: 'Error al exportar Word',
                  message: e instanceof Error ? e.message : 'Error al exportar Word',
                });
              }
            }}
          >
            <FileText size={16} /> Word (.docx)
          </button>
        </div>
      </section>
    </div>
  );
};
