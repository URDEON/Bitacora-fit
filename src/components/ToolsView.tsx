import { useState } from 'react';
import { ArrowRight, Calculator, ChartNoAxesColumn, CircleDollarSign, FileText, Palette, Percent, PiggyBank, Ruler, Timer } from 'lucide-react';
import type { PersonalModel } from '../hooks/usePersonalData';
import { PersonalBackupPanel } from './PersonalBackupPanel';
import type { ViewBackController } from '../services/navigation';

interface Props { onNavigate: (id: string) => void; model?: PersonalModel; registerBackController?: (controller: ViewBackController | null) => void; }
type CalculatorKind = 'percentage' | 'savings' | 'budget';
const numberFrom = (value: string): number | null => {
  if (!/^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(value.trim())) return null;
  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1e12 ? parsed : null;
};
const format = (number: number) => new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(number);

export function ToolsView({ onNavigate, model, registerBackController }: Props) {
  const [kind, setKind] = useState<CalculatorKind>('percentage');
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const fields = kind === 'percentage'
    ? [['amount', 'Cantidad'], ['percentage', 'Porcentaje (%)']]
    : kind === 'savings' ? [['goal', 'Meta de ahorro'], ['saved', 'Ahorro actual'], ['monthly', 'Aporte mensual']]
    : [['income', 'Ingresos mensuales'], ['expenses', 'Gastos mensuales']];
  const calculate = () => {
    const numbers = Object.fromEntries(fields.map(([id]) => [id, numberFrom(values[id] ?? '')]));
    if (Object.values(numbers).some(value => value === null)) { setError('Completa los campos con números entre 0 y 1.000.000.000.000.'); setResult(''); return; }
    setError('');
    if (kind === 'percentage') {
      const amount = numbers.amount!; const percentage = numbers.percentage!;
      if (percentage > 10000) { setError('Introduce un porcentaje entre 0 y 10.000.'); setResult(''); return; }
      setResult(`El ${format(percentage)} % de ${format(amount)} es ${format(amount * percentage / 100)}.`);
    } else if (kind === 'savings') {
      const goal = numbers.goal!; const saved = numbers.saved!; const monthly = numbers.monthly!;
      if (saved >= goal) { setResult('La meta ya está cubierta con tu ahorro actual.'); return; }
      if (monthly <= 0) { setError('El aporte mensual debe ser mayor que cero para calcular el plazo.'); setResult(''); return; }
      const months = Math.ceil((goal - saved) / monthly);
      setResult(`Faltan ${format(goal - saved)}. Con ese aporte alcanzarías la meta en ${format(months)} ${months === 1 ? 'mes' : 'meses'}, sin intereses.`);
    } else {
      const balance = numbers.income! - numbers.expenses!;
      setResult(balance >= 0 ? `Quedarían ${format(balance)} disponibles al mes.` : `Los gastos superarían los ingresos en ${format(Math.abs(balance))} al mes.`);
    }
  };

  const links = [
    { id: 'finance', name: 'Finanzas', detail: 'Ingresos, gastos y balance', icon: CircleDollarSign },
    { id: 'notes', name: 'Notas', detail: 'Ideas, apuntes y tareas', icon: FileText },
    { id: 'progress', name: 'Mediciones', detail: 'Peso, medidas e historial', icon: Ruler },
    { id: 'chrono', name: 'Cronómetro', detail: 'Descanso, tiempo e intervalos', icon: Timer },
    { id: 'export', name: 'Apariencia y respaldos', detail: 'Colores, preferencias y datos', icon: Palette },
  ];
  return (
    <div className="fade-view personal-tools">
      <p className="text-thin">Tus accesos y cálculos cotidianos, en un solo lugar.</p>
      <nav className="tools-link-list" aria-label="Accesos a herramientas">
        {links.map(({ id, name, detail, icon: Icon }) => <button type="button" key={id} onClick={() => onNavigate(id)}><Icon size={21} aria-hidden="true" /><span><strong>{name}</strong><small>{detail}</small></span><ArrowRight size={18} aria-hidden="true" /></button>)}
      </nav>
      <section className="tools-calculator" aria-labelledby="tools-calculator-title">
        <div className="tools-calculator-heading"><Calculator size={21} aria-hidden="true" /><h2 id="tools-calculator-title">Calculadoras</h2></div>
        <div className="tools-calculator-tabs" role="group" aria-label="Tipo de cálculo">
          {([
            ['percentage', 'Porcentajes', Percent], ['savings', 'Ahorro', PiggyBank], ['budget', 'Presupuesto', ChartNoAxesColumn],
          ] as const).map(([id, label, Icon]) => <button type="button" key={id} className={`pill-action${kind === id ? ' active' : ''}`} aria-pressed={kind === id} onClick={() => { setKind(id); setResult(''); setError(''); }}><Icon size={16} aria-hidden="true" />{label}</button>)}
        </div>
        <form className="tools-calculator-form" onSubmit={event => { event.preventDefault(); calculate(); }} noValidate>
          {fields.map(([id, label]) => <div key={id}><label className="lbl" htmlFor={`tool-${id}`}>{label}</label><input id={`tool-${id}`} className="input-clean" type="text" inputMode="decimal" autoComplete="off" maxLength={20} value={values[id] ?? ''} onChange={event => { setValues({ ...values, [id]: event.target.value }); setError(''); setResult(''); }} /></div>)}
          {error && <p className="field-error" role="alert">{error}</p>}
          <button type="submit" className="btn-main">Calcular</button>
        </form>
        {result && <output className="tools-calculator-result" aria-live="polite">{result}</output>}
        <p className="tools-calculator-note">Cálculos orientativos. No cambian tus registros ni incluyen intereses, comisiones o inflación.</p>
      </section>
      {model && <PersonalBackupPanel model={model} registerBackController={registerBackController} />}
    </div>
  );
}
