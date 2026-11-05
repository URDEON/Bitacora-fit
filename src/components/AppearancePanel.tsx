import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { Check, Download, Moon, Palette, RotateCcw, Sun, Upload } from 'lucide-react';
import { appearanceVariables, COLOR_ROLES, normalizeHex, parseAppearanceBackup, type AppearancePatch, type AppearancePreferences, type ColorRole } from '../services/appearance';
import { saveAndDeliverFile } from '../services/exportService';

export interface AppearancePanelProps {
  appearance: AppearancePreferences;
  updateAppearance: (patch: AppearancePatch) => void;
  resetAppearance: () => void;
  saveError: string;
  darkMode: boolean;
  onToggleDarkMode?: () => void;
}

const labels: Record<ColorRole, string> = {
  primary: 'Color principal', fit: 'Fit', finance: 'Finanzas', notes: 'Notas', tools: 'Herramientas',
  icons: 'Iconos', charts: 'Gráficos', calendar: 'Calendario', progress: 'Barras de progreso', active: 'Botones activos',
};

const presets = [
  { name: 'Grafito', color: '#D8E1E4' },
  { name: 'Pizarra', color: '#AFC4CD' },
  { name: 'Arena', color: '#D5BA97' },
  { name: 'Arcilla', color: '#D3A18E' },
];

function ColorControl({ role, value, onChange }: { role: ColorRole; value: string; onChange: (value: string) => void }) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState(false);
  useEffect(() => { setDraft(value); setError(false); }, [value]);
  const apply = () => {
    const normalized = normalizeHex(draft);
    if (!normalized) { setError(true); return; }
    setDraft(normalized); setError(false); onChange(normalized);
  };
  return <div className="appearance-color-row">
    <label htmlFor={`${id}-hex`}>{labels[role]}</label>
    <div className="appearance-color-inputs">
      <input id={`${id}-hex`} className="appearance-hex input-clean" type="text" value={draft} maxLength={7}
        autoComplete="off" autoCapitalize="characters" spellCheck={false} inputMode="text"
        aria-label={`Código HEX de ${labels[role]}`} aria-invalid={error} aria-describedby={error ? `${id}-error` : undefined}
        onChange={event => {
          const next = event.target.value; setDraft(next); setError(false);
          if (/^#?[\da-f]{6}$/i.test(next.trim())) onChange(normalizeHex(next)!);
        }} onBlur={apply} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } }} />
      <input className="appearance-swatch" type="color" value={value}
        aria-label={`Seleccionar ${labels[role]}`} onChange={event => onChange(normalizeHex(event.target.value)!)} />
    </div>
    {error && <p id={`${id}-error`} className="field-error" role="alert">Usa un código HEX válido, por ejemplo #AFC4CD.</p>}
  </div>;
}

export function AppearancePanel({ appearance, updateAppearance, resetAppearance, saveError, darkMode, onToggleDarkMode }: AppearancePanelProps) {
  const [view, setView] = useState<'theme' | 'colors' | 'effects'>('colors');
  const [fileMessage, setFileMessage] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const variables = appearanceVariables(appearance, darkMode);
  const previewStyle = {
    '--preview-accent': variables['--brand-primary'],
    '--preview-on': variables['--text-on-accent'],
    '--preview-soft': variables['--brand-primary-soft'],
  } as CSSProperties;
  const exportAppearance = async () => {
    try {
      const message = await saveAndDeliverFile('Bitacora-apariencia.json', 'application/json', JSON.stringify(appearance, null, 2), true);
      setFileMessage(message);
    } catch (error) {
      setFileMessage(error instanceof Error ? error.message : 'No se pudo exportar la apariencia.');
    }
  };

  return <section className="appearance-panel" aria-labelledby="appearance-title">
    <div className="block-head">
      <div>
        <p className="eyebrow">A TU MANERA</p>
        <h2 id="appearance-title" className="block-title"><Palette size={19} aria-hidden="true" /> Apariencia</h2>
        <p className="block-subtitle">Color en los detalles. El vidrio conserva su tono neutro.</p>
      </div>
    </div>
    <div className="appearance-tabs" role="group" aria-label="Opciones de apariencia">
      {([['theme', 'Tema'], ['colors', 'Colores'], ['effects', 'Efectos']] as const).map(([key, label]) =>
        <button type="button" key={key} aria-pressed={view === key} onClick={() => setView(key)}>{label}</button>)}
    </div>

    <div className="appearance-preview glass-panel" style={previewStyle} aria-label="Vista previa de la apariencia">
      <div className="appearance-preview-orbit" aria-hidden="true"><span>75<span>%</span></span></div>
      <div className="appearance-preview-copy"><span className="appearance-preview-label">VISTA PREVIA</span><strong>Tu propio ritmo.</strong><span>Tipografía clara, acentos precisos.</span>
        <span className="appearance-preview-button"><Check size={14} aria-hidden="true" /> Seleccionado</span></div>
    </div>

    <div hidden={view !== 'theme'} className="appearance-tab-content">
      <h3 className="appearance-section-title">Contraste</h3>
      <div className="appearance-theme-options">
        <button type="button" className={`appearance-option ${!darkMode ? 'active' : ''}`} aria-pressed={!darkMode}
          onClick={() => { if (darkMode) onToggleDarkMode?.(); }} disabled={!onToggleDarkMode}><Sun size={20} aria-hidden="true" /><span>Modo claro</span>{!darkMode && <Check size={16} aria-hidden="true" />}</button>
        <button type="button" className={`appearance-option ${darkMode ? 'active' : ''}`} aria-pressed={darkMode}
          onClick={() => { if (!darkMode) onToggleDarkMode?.(); }} disabled={!onToggleDarkMode}><Moon size={20} aria-hidden="true" /><span>Modo oscuro</span>{darkMode && <Check size={16} aria-hidden="true" />}</button>
      </div>
      <p className="appearance-help">El tema se conserva al volver a abrir Bitácora.</p>
    </div>

    <div hidden={view !== 'colors'} className="appearance-tab-content">
      <div className="appearance-presets" role="group" aria-label="Acentos predefinidos">
        {presets.map(preset => <button type="button" key={preset.name} onClick={() => updateAppearance({ colors: { primary: preset.color } })}
          aria-pressed={appearance.colors.primary === preset.color} style={{ '--swatch-color': preset.color } as CSSProperties}>
          <span className="appearance-preset-color" aria-hidden="true" />{preset.name}
        </button>)}
      </div>
      <p className="appearance-help">Elige cualquier color. Su contraste se adapta al tema para mantener legibles los controles.</p>
      <div className="appearance-colors">
        {COLOR_ROLES.map(role => <ColorControl key={role} role={role} value={appearance.colors[role]}
          onChange={value => updateAppearance({ colors: { [role]: value } })} />)}
      </div>
    </div>

    <div hidden={view !== 'effects'} className="appearance-tab-content">
      <fieldset className="appearance-effect-group"><legend>Superficies</legend>
        <label><input type="radio" name="appearance-glass" checked={appearance.effects.glass === 'full'} onChange={() => updateAppearance({ effects: { glass: 'full' } })} />
          <span><strong>Vidrio esmerilado</strong><span>Desenfoque en la navegación y los paneles destacados.</span></span></label>
        <label><input type="radio" name="appearance-glass" checked={appearance.effects.glass === 'reduced'} onChange={() => updateAppearance({ effects: { glass: 'reduced' } })} />
          <span><strong>Reducir transparencia</strong><span>Superficies opacas para facilitar la lectura.</span></span></label>
      </fieldset>
      <fieldset className="appearance-effect-group"><legend>Movimiento</legend>
        <label><input type="radio" name="appearance-motion" checked={appearance.effects.motion === 'system'} onChange={() => updateAppearance({ effects: { motion: 'system' } })} />
          <span><strong>Seguir el dispositivo</strong><span>Transiciones suaves que respetan tus preferencias de accesibilidad.</span></span></label>
        <label><input type="radio" name="appearance-motion" checked={appearance.effects.motion === 'reduced'} onChange={() => updateAppearance({ effects: { motion: 'reduced' } })} />
          <span><strong>Reducir movimiento</strong><span>Cambios inmediatos, sin animaciones de desplazamiento.</span></span></label>
      </fieldset>
    </div>

    <div className="appearance-transfer">
      <button type="button" className="text-button" onClick={exportAppearance}><Download size={16} aria-hidden="true" />Exportar apariencia</button>
      <button type="button" className="text-button" onClick={() => fileInput.current?.click()}><Upload size={16} aria-hidden="true" />Importar apariencia</button>
      <input ref={fileInput} className="sr-only" type="file" accept=".json,application/json" tabIndex={-1} aria-label="Archivo de apariencia"
        onChange={async event => {
          const input = event.currentTarget, file = input.files?.[0]; if (!file) return;
          try {
            if (file.size > 20_000) throw new Error('El archivo de apariencia supera el tamaño permitido.');
            const next = parseAppearanceBackup(await file.text()); updateAppearance(next); setFileMessage('Apariencia importada.');
          } catch (error) { setFileMessage(error instanceof Error ? error.message : 'No se pudo importar la apariencia.'); }
          finally { input.value = ''; }
        }} />
      <button type="button" className="text-button" onClick={() => { resetAppearance(); setFileMessage('Apariencia restablecida.'); }}><RotateCcw size={16} aria-hidden="true" />Restablecer</button>
    </div>
    <p className="appearance-help">La apariencia se guarda en este dispositivo. Puedes exportarla por separado de tus registros.</p>
    {fileMessage && <p className="appearance-file-message" role="status">{fileMessage}</p>}
    {saveError && <p className="field-error" role="alert">{saveError}</p>}
  </section>;
}
