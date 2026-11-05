import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Check, Edit3, Plus, Trash2, X } from 'lucide-react';
import type { PersonalModel } from '../hooks/usePersonalData';
import { personalSummary, type PersonalTransaction } from '../services/personalData';
import type { ViewBackController } from '../services/navigation';
import { useDialog } from './ConfirmDialog';

interface Props {
  model: PersonalModel;
  currentDate: string;
  actionRequest?: { id: number; type: 'income' | 'expense' };
  registerBackController?: (controller: ViewBackController | null) => void;
}
interface Draft { kind: 'income' | 'expense'; amount: string; category: string; description: string; date: string; time: string; }
const money = (value: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);
const newDraft = (date: string, kind: Draft['kind'] = 'expense'): Draft => ({ kind, amount: '', category: '', description: '', date, time: new Date().toTimeString().slice(0, 5) });
export function FinanceView({ model, currentDate, actionRequest, registerBackController }: Props) {
  const [month, setMonth] = useState(currentDate.slice(0, 7));
  const [editor, setEditor] = useState<{ id: string | null; original: string } | null>(null);
  const [draft, setDraft] = useState<Draft>(() => newDraft(currentDate));
  const [error, setError] = useState('');
  const { confirm } = useDialog();
  const editorRef = useRef(editor); editorRef.current = editor;
  const draftRef = useRef(draft); draftRef.current = draft;
  const closeRef = useRef<() => Promise<boolean>>(async () => false);
  const amountRef = useRef<HTMLInputElement>(null);
  useEffect(() => setMonth(currentDate.slice(0, 7)), [currentDate]);
  const summary = useMemo(() => personalSummary(model.data, month), [model.data, month]);
  const cancel = async () => {
    if (editorRef.current && JSON.stringify(draftRef.current) !== editorRef.current.original && !await confirm({ title: 'Descartar cambios', message: 'El movimiento no se ha guardado. ¿Quieres descartar estos cambios?', confirmLabel: 'Descartar cambios', tone: 'danger' })) return false;
    setEditor(null); setError(''); return true;
  };
  closeRef.current = cancel;
  useEffect(() => {
    registerBackController?.({ hasActiveEditor: () => editorRef.current !== null, closeEditor: () => { if (!editorRef.current) return false; void closeRef.current(); return true; }, hasActiveSubview: () => false, leaveSubview: () => false });
    return () => registerBackController?.(null);
  }, [registerBackController]);
  const open = async (kind: Draft['kind'], entry?: PersonalTransaction) => {
    if (editorRef.current && !await closeRef.current()) return;
    const next = entry ? { kind: entry.kind, amount: String(entry.amount), category: entry.category, description: entry.description, date: entry.date, time: entry.time } : newDraft(currentDate, kind);
    setDraft(next); setEditor({ id: entry?.id ?? null, original: JSON.stringify(next) }); setError('');
    requestAnimationFrame(() => { amountRef.current?.scrollIntoView({ block: 'center', behavior: 'instant' }); amountRef.current?.focus({ preventScroll: true }); });
  };
  const handledRequest = useRef<number | null>(null);
  useEffect(() => {
    if (actionRequest && handledRequest.current !== actionRequest.id) { handledRequest.current = actionRequest.id; void open(actionRequest.type); }
  }, [actionRequest?.id]);
  const save = () => {
    const amount = Number(draft.amount);
    if (!/^\d+$/.test(draft.amount.trim()) || !Number.isSafeInteger(amount) || amount < 1 || amount > 10_000_000_000) { setError('Introduce un monto en pesos enteros entre 1 y 10.000.000.000.'); return; }
    if (!draft.category.trim()) { setError('Escribe una categoría para organizar el movimiento.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || !Number.isFinite(Date.parse(draft.date + 'T12:00:00Z')) || new Date(draft.date + 'T12:00:00Z').toISOString().slice(0, 10) !== draft.date || !/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time)) { setError('Introduce una fecha y una hora válidas.'); return; }
    const id = editor?.id ?? crypto.randomUUID(); const timestamp = Date.now();
    const saved = model.saveData(previous => {
      const existing = previous.transactions.find(item => item.id === id);
      const item: PersonalTransaction = { id, ...draft, amount, category: draft.category.trim(), description: draft.description.trim(), createdAt: existing?.createdAt ?? timestamp, updatedAt: Math.max(timestamp, (existing?.updatedAt ?? 0) + 1) };
      return { ...previous, transactions: existing ? previous.transactions.map(old => old.id === id ? item : old) : [...previous.transactions, item] };
    });
    if (saved) { setEditor(null); setError(''); }
  };
  let accumulated = 0;
  return <div className="fade-view personal-view finance-view">
    <div className="page-heading compact"><p className="eyebrow">TU DINERO, A LA VISTA</p><h1>Finanzas</h1><p>Movimientos personales en pesos chilenos (CLP).</p></div>
    {model.saveError && <p className="personal-error" role="alert">{model.saveError}</p>}
    <section className="finance-balance" aria-labelledby="finance-balance-title"><span id="finance-balance-title">Saldo total registrado</span><strong>{money(summary.balance)}</strong><span className="personal-muted">Ingresos menos gastos de todos tus registros.</span></section>
    <div className="personal-toolbar"><label className="personal-month">Mes <input type="month" value={month} onChange={e => { if (/^\d{4}-\d{2}$/.test(e.target.value)) setMonth(e.target.value); }} /></label><button className="pill-action" onClick={() => void open('expense')}><Plus size={18} aria-hidden="true" />Nuevo movimiento</button></div>
    <div className="finance-month-summary"><div><ArrowDownLeft size={18} aria-hidden="true" /><span>Ingresos del mes<strong>{money(summary.income)}</strong></span></div><div><ArrowUpRight size={18} aria-hidden="true" /><span>Gastos del mes<strong>{money(summary.expense)}</strong></span></div></div>
    {editor && <section className="glass-panel personal-editor" aria-labelledby="finance-editor-title"><div className="personal-title-row"><h2 id="finance-editor-title">{editor.id ? 'Editar movimiento' : 'Nuevo movimiento'}</h2><button className="icon-btn" aria-label="Cerrar editor de movimiento" onClick={() => void cancel()}><X size={20} aria-hidden="true" /></button></div><form onSubmit={e => { e.preventDefault(); save(); }}>
      <div className="personal-segments" aria-label="Tipo de movimiento">{(['income', 'expense'] as const).map(kind => <button type="button" key={kind} aria-pressed={draft.kind === kind} onClick={() => setDraft({ ...draft, kind })}>{kind === 'income' ? 'Ingreso' : 'Gasto'}</button>)}</div>
      <label className="personal-field">Monto (CLP)<input ref={amountRef} value={draft.amount} onChange={e => setDraft({ ...draft, amount: e.target.value })} inputMode="numeric" pattern="[0-9]+" maxLength={11} required autoComplete="off" placeholder="0" /></label>
      <label className="personal-field">Categoría<input value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })} maxLength={60} list="finance-categories" required placeholder="Ej. Alimentación, sueldo…" /></label><datalist id="finance-categories">{['Alimentación', 'Transporte', 'Hogar', 'Salud', 'Estudios', 'Ocio', 'Sueldo', 'Otros'].map(category => <option key={category} value={category} />)}</datalist>
      <label className="personal-field">Descripción opcional<input value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} maxLength={300} /></label>
      <div className="personal-form-grid"><label className="personal-field">Fecha<input type="date" required value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} /></label><label className="personal-field">Hora<input type="time" required value={draft.time} onChange={e => setDraft({ ...draft, time: e.target.value })} /></label></div>
      {error && <p className="personal-error" role="alert">{error}</p>}
      <div className="personal-editor-actions"><button type="submit" className="btn-main"><Check size={18} aria-hidden="true" />Guardar movimiento</button><button type="button" className="text-button" onClick={() => void cancel()}>Cancelar</button></div>
    </form></section>}
    <section className="finance-category-section" aria-labelledby="finance-category-title"><h2 id="finance-category-title">Gastos por categoría</h2>{summary.expense > 0 ? <div className="finance-categories"><svg viewBox="0 0 160 160" role="img" aria-label={`Gastos del mes: ${money(summary.expense)}. Detalle por categoría en la lista.`}><circle cx="80" cy="80" r="62" className="finance-donut-track" />{summary.categories.map(([category, value], index) => { const portion = value / summary.expense * 100; const start = accumulated; accumulated += portion; return <circle key={category} cx="80" cy="80" r="62" pathLength="100" fill="none" stroke="var(--custom-finance, var(--brand-primary))" opacity={Math.max(.28, 1 - index * .12)} strokeWidth="15" strokeDasharray={`${portion} ${100 - portion}`} strokeDashoffset={-start} transform="rotate(-90 80 80)" />; })}<text x="80" y="76" textAnchor="middle" className="finance-donut-label">Gastos</text><text x="80" y="96" textAnchor="middle" className="finance-donut-value">{summary.categories.length} categorías</text></svg><ul className="finance-category-list">{summary.categories.map(([category, value]) => <li key={category}><span>{category}</span><strong>{Math.round(value / summary.expense * 100)} %</strong><span>{money(value)}</span></li>)}</ul></div> : <p className="personal-empty">No hay gastos registrados en este mes.</p>}</section>
    <section aria-labelledby="finance-movements-title"><h2 id="finance-movements-title">Movimientos del mes</h2>{summary.transactions.length === 0 ? <p className="personal-empty">Registra un ingreso o gasto para comenzar.</p> : <ul className="finance-movements">{summary.transactions.map(entry => <li key={entry.id}><span className={`finance-entry-icon ${entry.kind}`} aria-hidden="true">{entry.kind === 'income' ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}</span><div className="finance-entry-copy"><strong>{entry.category}</strong>{entry.description && <span>{entry.description}</span>}<small>{entry.date.split('-').reverse().join('/')} · {entry.time}</small></div><strong className="finance-entry-amount">{entry.kind === 'income' ? '+' : '−'}{money(entry.amount)}</strong><div className="finance-entry-actions"><button className="icon-btn" aria-label={`Editar movimiento: ${entry.description || entry.category}`} onClick={() => void open(entry.kind, entry)}><Edit3 size={17} aria-hidden="true" /></button><button className="icon-btn" aria-label={`Eliminar movimiento: ${entry.description || entry.category}`} onClick={async () => { if (await confirm({ title: 'Eliminar movimiento', message: `Se eliminará ${entry.category}: ${money(entry.amount)}.`, confirmLabel: 'Eliminar movimiento', tone: 'danger' })) model.saveData(previous => ({ ...previous, transactions: previous.transactions.filter(item => item.id !== entry.id) })); }}><Trash2 size={17} aria-hidden="true" /></button></div></li>)}</ul>}</section>
  </div>;
}
