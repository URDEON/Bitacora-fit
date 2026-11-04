import { useEffect } from 'react';
import { Dumbbell, Home, Settings, TrendingUp, Utensils } from 'lucide-react';
import type { ActiveTab } from '../types';

interface Props {
  active: ActiveTab;
  onNavigate: (tab: ActiveTab) => void;
}

const items = [
  { id: 'home', label: 'Inicio', icon: Home },
  { id: 'exercises', label: 'Entrenar', icon: Dumbbell },
  { id: 'meals', label: 'Alimentación', icon: Utensils },
  { id: 'progress', label: 'Progreso', icon: TrendingUp },
  { id: 'export', label: 'Ajustes', icon: Settings },
] as const;

/** The press follows the touch point; scrolling and release leave no running animation. */
function useGlassPress() {
  useEffect(() => {
    const onPress = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button') : null;
      if (!target || target.disabled || !target.matches('.btn-main, .pill-action, .step-circle, .header-chrono-pill, .glass-nav-item')) return;
      const bounds = target.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (event.clientX - bounds.left) / Math.max(1, bounds.width)));
      const y = Math.min(1, Math.max(0, (event.clientY - bounds.top) / Math.max(1, bounds.height)));
      target.style.setProperty('--touch-x', `${Math.round(x * 100)}%`);
      target.style.setProperty('--touch-y', `${Math.round(y * 100)}%`);
      target.style.setProperty('--press-tilt-x', `${(0.5 - y) * 4}deg`);
      target.style.setProperty('--press-tilt-y', `${(x - 0.5) * 4}deg`);
    };
    document.addEventListener('pointerdown', onPress, { passive: true });
    return () => document.removeEventListener('pointerdown', onPress);
  }, []);
}

export function GlassNavigation({ active, onNavigate }: Props) {
  useGlassPress();
  return (
    <nav className="bottom-dock glass-dock" aria-label="Navegación principal">
      <div className="dock-grid glass-nav">
        {items.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`nav-item glass-nav-item${active === id ? ' active' : ''}`}
            aria-label={label}
            aria-current={active === id ? 'page' : undefined}
            title={label}
            onClick={() => onNavigate(id)}
          >
            <Icon className="glass-nav-icon" size={23} strokeWidth={1.8} aria-hidden="true" />
            <span className="glass-nav-label" aria-hidden="true">
              {id === 'meals' ? <><span className="glass-label-full">{label}</span><span className="glass-label-compact">Comidas</span></> : label}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
}
