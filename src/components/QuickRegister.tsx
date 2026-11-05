import { useEffect, useRef } from 'react';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Dumbbell, Droplets, ListTodo, NotebookPen, Plus, Scale, Timer, Utensils, X } from 'lucide-react';
import type { ActiveTab } from '../types';

interface Props {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onNavigate: (tab: ActiveTab) => void;
  onWater: () => void;
  onRest: () => void;
  onWeight: () => void;
  onIncome: () => void;
  onExpense: () => void;
  onNote: () => void;
  onTask: () => void;
}

/** Native modal focus/inert handling also works in the Android WebView. */
export function QuickRegister({ open, onOpen, onClose, onNavigate, onWater, onRest, onWeight, onIncome, onExpense, onNote, onTask }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (!open) { if (element.open) element.close(); return; }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element.showModal();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (element.open) element.close();
    };
  }, [open]);
  const run = (action: () => void) => { onClose(); action(); };
  const actions = [
    { label: 'Registrar ejercicio', detail: 'Series, repeticiones o tiempo', Icon: Dumbbell, action: () => onNavigate('exercises') },
    { label: 'Registrar comida', detail: 'Alimentación del día seleccionado', Icon: Utensils, action: () => onNavigate('meals') },
    { label: 'Registrar peso', detail: 'Peso, cintura y composición', Icon: Scale, action: onWeight },
    { label: 'Añadir 250 ml de agua', detail: 'Guardar en la fecha seleccionada', Icon: Droplets, action: onWater },
    { label: 'Registrar gasto', detail: 'Nuevo movimiento en Finanzas', Icon: ArrowDownLeft, action: onExpense },
    { label: 'Registrar ingreso', detail: 'Nuevo movimiento en Finanzas', Icon: ArrowUpRight, action: onIncome },
    { label: 'Crear nota', detail: 'Escribir y guardar una idea', Icon: NotebookPen, action: onNote },
    { label: 'Crear tarea', detail: 'Pendientes con casillas de verificación', Icon: ListTodo, action: onTask },
    { label: 'Descanso de 90 segundos', detail: 'Abrir el cronómetro', Icon: Timer, action: onRest },
  ];
  return <>
    <button className="quick-register-fab" type="button" aria-label="Registro rápido" aria-haspopup="dialog" aria-expanded={open} onClick={onOpen}><Plus size={24} aria-hidden="true" /><span>Anotar</span></button>
    <dialog ref={dialog} className="quick-register-dialog glass-panel" aria-labelledby="quick-register-title"
      onCancel={() => close.current()} onClose={() => close.current()}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
      }}>
      <div className="quick-register-surface">
        <span className="sheet-handle" aria-hidden="true" />
        <div className="quick-register-heading"><div><p className="eyebrow">A TU RITMO</p><h2 id="quick-register-title">Registro rápido</h2></div><button type="button" className="icon-btn" autoFocus aria-label="Cerrar registro rápido" onClick={onClose}><X size={21} aria-hidden="true" /></button></div>
        <div className="quick-register-list">{actions.map(({ label, detail, Icon, action }) => <button key={label} type="button" onClick={() => run(action)}><span className="quick-register-icon"><Icon size={20} aria-hidden="true" /></span><span><strong>{label}</strong><small>{detail}</small></span><ArrowRight size={17} aria-hidden="true" /></button>)}</div>
      </div>
    </dialog>
  </>;
}
