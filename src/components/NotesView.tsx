import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, CheckSquare, FileText, Pencil, Plus, Search, Star, Trash2, X } from 'lucide-react';
import type { PersonalModel } from '../hooks/usePersonalData';
import type { PersonalNote } from '../services/personalData';
import type { ViewBackController } from '../services/navigation';
import { useDialog } from './ConfirmDialog';

interface Props {
  model: PersonalModel;
  currentDate: string;
  actionRequest?: { id: number; type: 'note' | 'task' };
  registerBackController?: (controller: ViewBackController | null) => void;
}

type NoteDraft = Pick<PersonalNote, 'title' | 'body' | 'favorite' | 'kind' | 'tasks'> & { id: string | null };
type Filter = 'all' | 'tasks' | 'favorites';
const noteDate = (value: number) => new Date(value).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });

export function NotesView({ model, actionRequest, registerBackController }: Props) {
  const { confirm } = useDialog();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [draft, setDraft] = useState<NoteDraft | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const initialDraft = useRef('');
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const closing = useRef(false);
  const titleInput = useRef<HTMLInputElement>(null);
  const newButton = useRef<HTMLButtonElement>(null);
  const lastAction = useRef(0);

  const closeEditor = useCallback(async () => {
    if (!draftRef.current || closing.current) return;
    closing.current = true;
    try {
      if (JSON.stringify(draftRef.current) !== initialDraft.current && !await confirm({
        title: 'Cambios sin guardar',
        message: '¿Quieres descartar los cambios de esta nota?',
        confirmLabel: 'Descartar cambios',
        cancelLabel: 'Seguir escribiendo',
      })) return;
      setDraft(null);
      setError('');
      requestAnimationFrame(() => newButton.current?.focus({ preventScroll: true }));
    } finally { closing.current = false; }
  }, [confirm]);

  useEffect(() => {
    if (!registerBackController) return;
    registerBackController({
      hasActiveEditor: () => draftRef.current !== null,
      closeEditor: () => {
        if (!draftRef.current) return false;
        void closeEditor();
        return true;
      },
      hasActiveSubview: () => false,
      leaveSubview: () => false,
    });
    return () => registerBackController(null);
  }, [registerBackController, closeEditor]);

  const startEditor = (note: PersonalNote | null, kind: PersonalNote['kind'] = 'note') => {
    const next: NoteDraft = note
      ? { id: note.id, title: note.title, body: note.body, favorite: note.favorite, kind: note.kind, tasks: note.tasks.map(task => ({ ...task })) }
      : { id: null, title: '', body: '', favorite: false, kind, tasks: kind === 'task' ? [{ id: crypto.randomUUID(), text: '', done: false }] : [] };
    initialDraft.current = JSON.stringify(next);
    setDraft(next);
    setError('');
    setMessage('');
    requestAnimationFrame(() => {
      titleInput.current?.scrollIntoView({ block: 'center', behavior: 'instant' });
      titleInput.current?.focus({ preventScroll: true });
    });
  };

  useEffect(() => {
    if (!actionRequest || actionRequest.id <= lastAction.current) return;
    lastAction.current = actionRequest.id;
    void (async () => {
      if (draftRef.current && JSON.stringify(draftRef.current) !== initialDraft.current && !await confirm({
        title: 'Cambios sin guardar', message: '¿Quieres descartar este borrador y crear uno nuevo?',
        confirmLabel: 'Crear nuevo', cancelLabel: 'Seguir escribiendo',
      })) return;
      // A newer quick action owns the editor if two requests arrive together.
      if (lastAction.current !== actionRequest.id) return;
      startEditor(null, actionRequest.type);
    })();
  }, [actionRequest?.id]);

  const visibleNotes = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es');
    return model.data.notes.filter(note =>
      (filter !== 'tasks' || note.kind === 'task') &&
      (filter !== 'favorites' || note.favorite) &&
      (!term || `${note.title} ${note.body} ${note.tasks.map(task => task.text).join(' ')}`.toLocaleLowerCase('es').includes(term)),
    ).sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
  }, [model.data.notes, search, filter]);

  const save = () => {
    if (!draft) return;
    if (!draft.title.trim()) { setError('Escribe un título para identificar la nota.'); titleInput.current?.focus(); return; }
    if (draft.kind === 'task' && (!draft.tasks.length || draft.tasks.some(task => !task.text.trim()))) {
      setError('Añade al menos una tarea y completa su texto, o elimina las filas vacías.'); return;
    }
    const now = Date.now();
    const saved = model.saveData(previous => {
      const existing = previous.notes.find(note => note.id === draft.id);
      const entry: PersonalNote = {
        id: draft.id ?? crypto.randomUUID(), title: draft.title.trim(), body: draft.body.trim(),
        favorite: draft.favorite, kind: draft.kind,
        tasks: draft.tasks.map(task => ({ ...task, text: task.text.trim() })),
        createdAt: existing?.createdAt ?? now, updatedAt: Math.max(now, (existing?.updatedAt ?? -1) + 1),
      };
      return { ...previous, notes: existing ? previous.notes.map(note => note.id === entry.id ? entry : note) : [...previous.notes, entry] };
    });
    if (saved) {
      setDraft(null); setError(''); setMessage('Nota guardada en este dispositivo.');
      requestAnimationFrame(() => newButton.current?.focus({ preventScroll: true }));
    }
  };

  const remove = async (note: PersonalNote) => {
    if (!await confirm({ title: 'Eliminar nota', message: `Se eliminará «${note.title}».`, confirmLabel: 'Eliminar nota', tone: 'danger' })) return;
    if (model.saveData(previous => ({ ...previous, notes: previous.notes.filter(item => item.id !== note.id) }))) setMessage('Nota eliminada.');
  };

  return (
    <div className="fade-view personal-notes">
      <div className="notes-toolbar">
        <p className="text-thin">Ideas, apuntes y tareas. Todo en tu dispositivo.</p>
        <div className="notes-create-actions">
          <button ref={newButton} className="pill-action" onClick={() => startEditor(null)} disabled={draft !== null}><Plus size={17} aria-hidden="true" />Nueva nota</button>
          <button className="pill-action" onClick={() => startEditor(null, 'task')} disabled={draft !== null}><CheckSquare size={17} aria-hidden="true" />Nueva lista</button>
        </div>
      </div>
      {message && <p className="personal-feedback" role="status">{message}</p>}
      {model.saveError && <p className="field-error" role="alert">{model.saveError}</p>}

      {draft ? (
        <form className="glass-panel note-editor" aria-label={draft.id ? 'Editar nota' : 'Crear nota'} onSubmit={event => { event.preventDefault(); save(); }} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); void closeEditor(); } }}>
          <div className="note-editor-heading"><h2>{draft.id ? 'Editar nota' : draft.kind === 'task' ? 'Nueva lista' : 'Nueva nota'}</h2><button type="button" className="icon-btn" aria-label="Cerrar editor de notas" onClick={() => void closeEditor()}><X size={20} aria-hidden="true" /></button></div>
          <label className="lbl" htmlFor="personal-note-title">Título</label>
          <input ref={titleInput} id="personal-note-title" className="input-clean" value={draft.title} maxLength={200} aria-invalid={!!error && !draft.title.trim()} onChange={event => { setDraft({ ...draft, title: event.target.value }); setError(''); }} required />
          <label className="lbl" htmlFor="personal-note-body">{draft.kind === 'task' ? 'Detalles (opcional)' : 'Contenido'}</label>
          <textarea id="personal-note-body" className="input-clean note-body-input" value={draft.body} maxLength={20000} rows={6} onChange={event => setDraft({ ...draft, body: event.target.value })} />
          {draft.kind === 'task' && <fieldset className="note-task-editor"><legend>Tareas</legend>
            {draft.tasks.map((task, index) => <div className="note-task-edit-row" key={task.id}>
              <label className="note-task-toggle"><input type="checkbox" aria-label={`Marcar tarea ${index + 1} como terminada`} checked={task.done} onChange={event => setDraft({ ...draft, tasks: draft.tasks.map(item => item.id === task.id ? { ...item, done: event.target.checked } : item) })} /></label>
              <input className="input-clean" aria-label={`Texto de tarea ${index + 1}`} value={task.text} maxLength={300} onChange={event => setDraft({ ...draft, tasks: draft.tasks.map(item => item.id === task.id ? { ...item, text: event.target.value } : item) })} />
              <button type="button" className="icon-btn" aria-label={`Eliminar tarea ${index + 1}`} onClick={() => setDraft({ ...draft, tasks: draft.tasks.filter(item => item.id !== task.id) })}><Trash2 size={16} aria-hidden="true" /></button>
            </div>)}
            <button type="button" className="text-button" disabled={draft.tasks.length >= 100} onClick={() => setDraft({ ...draft, tasks: [...draft.tasks, { id: crypto.randomUUID(), text: '', done: false }] })}><Plus size={16} aria-hidden="true" />Añadir tarea</button>
          </fieldset>}
          <label className="note-favorite-control"><input type="checkbox" checked={draft.favorite} onChange={event => setDraft({ ...draft, favorite: event.target.checked })} /><Star size={17} aria-hidden="true" />Guardar en favoritas</label>
          {error && <p className="field-error" role="alert">{error}</p>}
          <div className="note-editor-actions"><button type="button" className="pill-action" onClick={() => void closeEditor()}>Cancelar</button><button type="submit" className="btn-main"><Check size={18} aria-hidden="true" />Guardar nota</button></div>
        </form>
      ) : <>
        <div className="notes-filter" role="group" aria-label="Filtrar notas">{([['all', 'Todas'], ['tasks', 'Tareas'], ['favorites', 'Favoritas']] as const).map(([id, label]) => <button type="button" key={id} className={`pill-action${filter === id ? ' active' : ''}`} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</div>
        <label className="notes-search"><Search size={18} aria-hidden="true" /><span className="sr-only">Buscar notas</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar en tus notas…" /></label>
        <p className="notes-result-count" role="status">{visibleNotes.length} {visibleNotes.length === 1 ? 'nota' : 'notas'}</p>
        <div className="notes-list">
          {visibleNotes.map(note => <article className="note-record" key={note.id}>
            <div className="note-record-heading"><span className="note-kind" aria-label={note.kind === 'task' ? 'Lista de tareas' : 'Nota'}>{note.kind === 'task' ? <CheckSquare size={19} aria-hidden="true" /> : <FileText size={19} aria-hidden="true" />}</span><h2><button type="button" onClick={() => startEditor(note)}>{note.title}</button></h2><time dateTime={new Date(note.updatedAt).toISOString()}>{noteDate(note.updatedAt)}</time></div>
            {note.body && <p className="note-preview">{note.body}</p>}
            {note.kind === 'task' && <div className="note-checklist">
              {note.tasks.map(task => <label key={task.id} className={task.done ? 'done' : ''}><input type="checkbox" checked={task.done} onChange={event => {
                const done = event.target.checked;
                model.saveData(previous => ({ ...previous, notes: previous.notes.map(item => item.id === note.id ? { ...item, updatedAt: Math.max(Date.now(), item.updatedAt + 1), tasks: item.tasks.map(current => current.id === task.id ? { ...current, done } : current) } : item) }));
              }} /><span>{task.text}</span></label>)}
              <p className="note-task-count">{note.tasks.filter(task => task.done).length} de {note.tasks.length} terminadas</p>
            </div>}
            <div className="note-record-actions">
              <button type="button" className="icon-btn" aria-label={`${note.favorite ? 'Quitar de' : 'Añadir a'} favoritas: ${note.title}`} aria-pressed={note.favorite} onClick={() => model.saveData(previous => ({ ...previous, notes: previous.notes.map(item => item.id === note.id ? { ...item, favorite: !item.favorite, updatedAt: Math.max(Date.now(), item.updatedAt + 1) } : item) }))}><Star size={18} fill={note.favorite ? 'currentColor' : 'none'} aria-hidden="true" /></button>
              <button type="button" className="icon-btn" aria-label={`Editar nota: ${note.title}`} onClick={() => startEditor(note)}><Pencil size={17} aria-hidden="true" /></button>
              <button type="button" className="icon-btn" aria-label={`Eliminar nota: ${note.title}`} onClick={() => void remove(note)}><Trash2 size={17} aria-hidden="true" /></button>
            </div>
          </article>)}
          {!visibleNotes.length && <div className="notes-empty"><FileText size={28} aria-hidden="true" /><h2>{search || filter !== 'all' ? 'No hay coincidencias' : 'Espacio para tus ideas'}</h2><p>{search || filter !== 'all' ? 'Prueba otra búsqueda o cambia el filtro.' : 'Crea una nota o una lista. Aquí aparecerá tu contenido.'}</p></div>}
        </div>
      </>}
    </div>
  );
}
