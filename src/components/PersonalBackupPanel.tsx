import { useEffect, useId, useRef, useState } from 'react';
import { Download, Upload, X } from 'lucide-react';
import type { PersonalModel } from '../hooks/usePersonalData';
import { parsePersonalBackup, personalBackupJSON, type PersonalData } from '../services/personalData';
import { saveAndDeliverFile } from '../services/exportService';
import { useDialog } from './ConfirmDialog';
import type { ViewBackController } from '../services/navigation';

export function PersonalBackupPanel({ model, registerBackController }: { model: PersonalModel; registerBackController?: (controller: ViewBackController | null) => void }) {
  const file = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const [pending, setPending] = useState<PersonalData | null>(null);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  useEffect(() => {
    registerBackController?.({ hasActiveEditor: () => pendingRef.current !== null, closeEditor: () => {
      if (!pendingRef.current) return false;
      setPending(null); return true;
    }, hasActiveSubview: () => false, leaveSubview: () => false });
    return () => registerBackController?.(null);
  }, [registerBackController]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const { confirm } = useDialog();
  const restore = async (mode: 'merge' | 'replace') => {
    if (!pending || !await confirm({ title: mode === 'merge' ? 'Combinar Finanzas y Notas' : 'Reemplazar Finanzas y Notas', message: mode === 'merge' ? 'Se combinarán los registros de este respaldo con los actuales. Los registros de Fit no cambian.' : 'Se sustituirán todos los movimientos y notas actuales por este respaldo. Los registros de Fit no cambian. Guarda una copia antes de continuar.', confirmLabel: mode === 'merge' ? 'Combinar' : 'Reemplazar', tone: mode === 'replace' ? 'danger' : 'default' })) return;
    if (model.restoreData(pending, mode)) { setPending(null); setError(''); setMessage('Respaldo de Finanzas y Notas restaurado.'); }
  };
  return <section className="personal-backup" aria-labelledby={titleId}><h2 id={titleId}>Respaldo de Finanzas y Notas</h2><p>Incluye movimientos, notas y tareas. Tus registros de entrenamiento, alimentación y medidas se respaldan desde Ajustes → Copias de seguridad de Fit.</p>
    <div className="personal-backup-actions"><button className="pill-action" disabled={exporting} onClick={async () => {
      setExporting(true); setError(''); setMessage('');
      try { setMessage(await saveAndDeliverFile(`Bitacora-Finanzas-Notas-${new Date().toISOString().slice(0, 10)}.json`, 'application/json', personalBackupJSON(model.data), true)); }
      catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo crear el respaldo.'); }
      finally { setExporting(false); }
    }}><Download size={18} aria-hidden="true" />{exporting ? 'Preparando copia…' : 'Respaldar Finanzas y Notas'}</button><button className="pill-action" onClick={() => file.current?.click()}><Upload size={18} aria-hidden="true" />Importar Finanzas y Notas</button></div>
    <input ref={file} className="sr-only" type="file" accept="application/json,.json" aria-label="Archivo de respaldo de Finanzas y Notas" onChange={async event => {
      const selected = event.target.files?.[0]; if (!selected) return;
      setError(''); setMessage(''); setPending(null);
      try { if (selected.size > 15 * 1024 * 1024) throw new Error('El archivo supera el límite de 15 MB.'); setPending(parsePersonalBackup(await selected.text())); }
      catch (reason) { setError(reason instanceof Error ? reason.message : 'El archivo no es válido. Tus datos se conservan.'); }
      finally { event.target.value = ''; }
    }} />
    {pending && <div className="personal-backup-preview"><div className="personal-title-row"><h3>Revisar respaldo</h3><button className="icon-btn" aria-label="Cancelar importación personal" onClick={() => setPending(null)}><X size={18} aria-hidden="true" /></button></div><p>{pending.transactions.length} movimientos · {pending.notes.length} notas y listas. Elige cómo incorporarlos.</p><div className="personal-backup-actions"><button className="btn-main" onClick={() => void restore('merge')}>Combinar registros</button><button className="pill-action" onClick={() => void restore('replace')}>Reemplazar registros</button></div></div>}
    {message && <p role="status">{message}</p>}{error && <p className="personal-error" role="alert">{error}</p>}
    {model.saveError && <p className="personal-error" role="alert">{model.saveError}</p>}
  </section>;
}
