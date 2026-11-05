import { useCallback, useEffect, useRef, useState } from 'react';
import { commitPersonalUpdate, emptyPersonalData, mergePersonalData, PERSONAL_STORAGE_KEY, validatePersonalData, type PersonalData } from '../services/personalData';
export interface PersonalModel { data: PersonalData; saveData: (update: (previous: PersonalData) => PersonalData) => boolean; restoreData: (incoming: PersonalData, mode: 'merge' | 'replace') => boolean; saveError: string; }
function load(): { data: PersonalData; error: string } {
  try {
    const saved = localStorage.getItem(PERSONAL_STORAGE_KEY);
    return { data: saved ? validatePersonalData(JSON.parse(saved)) : emptyPersonalData(), error: '' };
  } catch {
    return { data: emptyPersonalData(), error: 'No pudimos leer Finanzas y Notas. No sobrescribiremos los datos guardados. Exporta o recupera tu copia antes de continuar.' };
  }
}
export function usePersonalData(): PersonalModel {
  const initial = useRef<ReturnType<typeof load> | null>(null);
  if (!initial.current) initial.current = load();
  const [data, setData] = useState(initial.current.data);
  const [saveError, setSaveError] = useState(initial.current.error);
  const current = useRef(data); current.current = data;
  const blocked = useRef(Boolean(initial.current.error));
  const saveData = useCallback((update: (previous: PersonalData) => PersonalData): boolean => {
    if (blocked.current) return false;
    try {
      const saved = localStorage.getItem(PERSONAL_STORAGE_KEY);
      const fresh = saved ? validatePersonalData(JSON.parse(saved)) : null;
      const previous = fresh ? mergePersonalData(current.current, fresh) : current.current;
      const next = commitPersonalUpdate(previous, update(previous));
      localStorage.setItem(PERSONAL_STORAGE_KEY, JSON.stringify(next));
      current.current = next; setData(next); setSaveError(''); return true;
    } catch {
      setSaveError('No se pudo guardar. Tus datos anteriores se conservan; no cierres el editor y comprueba el espacio disponible.');
      return false;
    }
  }, []);
  const restoreData = useCallback((incoming: PersonalData, mode: 'merge' | 'replace'): boolean => {
    try {
      const valid = validatePersonalData(incoming);
      const raw = localStorage.getItem(PERSONAL_STORAGE_KEY);
      let previous = current.current;
      if (raw) {
        try { previous = mergePersonalData(previous, validatePersonalData(JSON.parse(raw))); }
        catch {
          if (mode === 'merge') throw new Error('No se puede combinar con la copia guardada porque no es válida. Puedes reemplazarla con un respaldo válido.');
          // Keep the unreadable original before an explicitly confirmed recovery.
          localStorage.setItem(PERSONAL_STORAGE_KEY + '_recovery', raw);
        }
      }
      let next: PersonalData;
      if (mode === 'merge') next = commitPersonalUpdate(previous, mergePersonalData(previous, valid));
      else {
        const timestamp = Math.max(Date.now(), previous.updatedAt + 1, valid.updatedAt + 1,
          ...valid.transactions.map(item => item.updatedAt + 1), ...valid.notes.map(item => item.updatedAt + 1));
        next = commitPersonalUpdate(previous, { ...valid,
          transactions: valid.transactions.map(item => ({ ...item, updatedAt: timestamp })),
          notes: valid.notes.map(item => ({ ...item, updatedAt: timestamp })) }, timestamp);
      }
      localStorage.setItem(PERSONAL_STORAGE_KEY, JSON.stringify(next));
      current.current = next; setData(next); blocked.current = false; setSaveError(''); return true;
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'No se pudo restaurar el respaldo. Los datos actuales se conservan.'); return false;
    }
  }, []);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== PERSONAL_STORAGE_KEY || event.newValue === null) return;
      try {
        const incoming = validatePersonalData(JSON.parse(event.newValue));
        // Events can arrive after another tab has already written again. Re-read
        // disk, merge all three snapshots, and persist the canonical union.
        const disk = localStorage.getItem(PERSONAL_STORAGE_KEY);
        const fresh = disk ? validatePersonalData(JSON.parse(disk)) : emptyPersonalData();
        const next = mergePersonalData(mergePersonalData(current.current, incoming), fresh);
        const encoded = JSON.stringify(next);
        if (disk !== encoded) localStorage.setItem(PERSONAL_STORAGE_KEY, encoded);
        if (JSON.stringify(current.current) !== encoded) { current.current = next; setData(next); }
        blocked.current = false; setSaveError('');
      } catch { setSaveError('Se detectó una copia no válida de Finanzas y Notas. Se conservan los datos abiertos.'); }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  return { data, saveData, restoreData, saveError };
}
