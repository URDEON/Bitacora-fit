import { useEffect, useReducer } from 'react';

/**
 * Fuerza un renderizado del componente que lo usa cada `intervalMs` mientras `enabled` sea verdadero.
 * El tiempo real se lee con Date.now() al renderizar, de modo que el intervalo solo decide la
 * frecuencia visual y nunca la precisión del temporizador.
 */
export function useTicker(enabled: boolean, intervalMs = 100): void {
  const [, force] = useReducer((value: number) => value + 1, 0);
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(force, intervalMs);
    force();
    return () => window.clearInterval(timer);
  }, [enabled, intervalMs]);
}
