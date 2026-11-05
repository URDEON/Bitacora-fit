import { useCallback, useEffect, useState } from 'react';
import { APPEARANCE_KEY, appearanceVariables, normalizeAppearance, patchAppearance, type AppearancePatch } from '../services/appearance';

function loadAppearance() {
  try { return normalizeAppearance(JSON.parse(localStorage.getItem(APPEARANCE_KEY) || 'null')); }
  catch { return normalizeAppearance(null); }
}

export function useAppearance(darkMode: boolean, section: string) {
  const [appearance, setAppearance] = useState(loadAppearance);
  const [saveError, setSaveError] = useState('');
  const updateAppearance = useCallback((patch: AppearancePatch) => setAppearance(current => patchAppearance(current, patch)), []);
  const resetAppearance = useCallback(() => setAppearance(normalizeAppearance(null)), []);

  useEffect(() => {
    try {
      localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance));
      setSaveError('');
    } catch {
      setSaveError('No se pudo guardar la apariencia. La vista previa sigue disponible; tus registros no se han modificado.');
    }
  }, [appearance]);

  useEffect(() => {
    const receive = (event: StorageEvent) => {
      if (event.key === APPEARANCE_KEY) setAppearance(loadAppearance());
    };
    window.addEventListener('storage', receive);
    return () => window.removeEventListener('storage', receive);
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const variables = appearanceVariables(appearance, darkMode, section);
    for (const [key, value] of Object.entries(variables)) body.style.setProperty(key, value);
    html.dataset.transparency = appearance.effects.glass === 'reduced' ? 'reduced' : 'full';
    html.dataset.motion = appearance.effects.motion;
    return () => {
      for (const key of Object.keys(variables)) body.style.removeProperty(key);
      delete html.dataset.transparency;
      delete html.dataset.motion;
    };
  }, [appearance, darkMode, section]);

  return { appearance, updateAppearance, resetAppearance, saveError };
}
