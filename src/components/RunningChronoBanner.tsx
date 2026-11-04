import { ChevronRight, Timer } from 'lucide-react';
import type { PersistedChronoState } from '../types';
import { readChrono } from '../services/chronoEngine';
import { runningChronoLabel } from '../services/chronoLabels';
import { useTicker } from '../hooks/useTicker';
import { formatMinSecShort } from './ChronoView';

interface Props {
  chrono: PersistedChronoState;
  onOpen: () => void;
}

/** Aviso de reloj activo. Es el único componente (junto a ChronoView) que se actualiza cada fracción de segundo. */
export function RunningChronoBanner({ chrono, onOpen }: Props) {
  useTicker(chrono.running, 250);
  const reading = readChrono(chrono, Date.now());
  return (
    <button className="running-banner" onClick={onOpen}>
      <Timer size={18} />
      <span>{runningChronoLabel(chrono)} en curso</span>
      <strong className="mono-num">{formatMinSecShort(reading.displayMs)}</strong>
      <ChevronRight size={18} />
    </button>
  );
}
