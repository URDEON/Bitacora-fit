import { useId, useRef, useState, type PointerEvent } from 'react';
import { ArrowLeft, ArrowRight, Dumbbell, Droplets, Flame, Utensils } from 'lucide-react';
import type { ActiveTab } from '../types';
import { metricProgress, type HomeMetric } from '../services/homeMetrics';
import { MetricVisual } from './MetricVisual';
import { MetricHistory } from './MetricHistory';
import type { MetricHistorySeries } from '../services/metricHistory';

interface Props { metrics: HomeMetric[]; onNavigate: (tab: ActiveTab) => void; histories?: MetricHistorySeries[]; }
interface Gesture { id: number; x: number; y: number; axis: 'x' | 'y' | null; }
const icons = { training: Dumbbell, water: Droplets, energy: Flame, protein: Utensils };
const number = (value: number) => value.toLocaleString('es', { maximumFractionDigits: 1 });

export function MetricCarousel({ metrics, onNavigate, histories }: Props) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const gesture = useRef<Gesture | null>(null);
  const panelId = useId();
  const metric = metrics[index] ?? metrics[0];
  if (!metric) return null;
  const Icon = icons[metric.id];
  const history = histories?.find(series => series.id === metric.id);
  const { percent, ringPercent } = metricProgress(metric.value, metric.goal);
  const percentage = percent === null ? 'Meta sin configurar' : `${number(percent)} %`;
  const goal = metric.goal === null ? 'Configura tu objetivo en Ajustes' : `Meta: ${number(metric.goal)} ${metric.unit}`;

  const select = (next: number, movement = next > index ? 1 : -1) => {
    const normalized = (next + metrics.length) % metrics.length;
    if (normalized === index) return;
    setDirection(movement);
    setIndex(normalized);
  };
  const clearGesture = (element: HTMLDivElement) => {
    gesture.current = null;
    element.style.removeProperty('--metric-drag');
    element.removeAttribute('data-dragging');
  };
  const onDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, axis: null };
  };
  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (current.axis === null && Math.max(Math.abs(dx), Math.abs(dy)) > 10) {
      current.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
      if (current.axis === 'x') {
        // Capture only a confirmed horizontal gesture. Vertical scrolling remains native.
        try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* An interrupted touch needs no capture. */ }
      }
    }
    if (current.axis === 'x') {
      event.currentTarget.dataset.dragging = 'true';
      event.currentTarget.style.setProperty('--metric-drag', `${Math.max(-36, Math.min(36, dx * .2))}px`);
    }
  };
  const onUp = (event: PointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    clearGesture(event.currentTarget);
    if (current.axis === 'x' && Math.abs(dx) >= 44 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      select(index + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    }
  };

  return (
    <section className="metric-carousel" aria-label="Mediciones del día" aria-roledescription="carrusel">
      <div
        className="metric-orbit"
        role="group"
        aria-roledescription="diapositiva"
        aria-label={metric.name}
        data-metric={metric.id}
        data-direction={direction}
        id={panelId}
        tabIndex={0}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={event => clearGesture(event.currentTarget)}
        onLostPointerCapture={event => {
          // A touch on the SVG first gets implicit capture. Its lost-capture
          // event bubbles when we transfer capture to this surface.
          if (event.target === event.currentTarget) clearGesture(event.currentTarget);
        }}
        onKeyDown={event => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            const step = event.key === 'ArrowRight' ? 1 : -1;
            select(index + step, step);
          }
        }}
      >
        <MetricVisual metric={metric} />
        <svg className="metric-ring" viewBox="0 0 320 320" role="progressbar" aria-label={`Progreso de ${metric.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={ringPercent} aria-valuetext={percentage}>
          <circle className="metric-ring-track" cx="160" cy="160" r="148" />
          <circle className="metric-ring-value" cx="160" cy="160" r="148" pathLength={100} strokeDasharray={100} strokeDashoffset={100 - ringPercent} />
        </svg>
        <div className="metric-content" key={metric.id}>
          <Icon className="metric-symbol" size={28} strokeWidth={1.65} aria-hidden="true" />
          <h3>{metric.name}</h3>
          <p className="metric-main-value"><strong data-testid="metric-value">{number(metric.value)}</strong><span>{metric.unit}</span></p>
          <p className="metric-period">{metric.period}</p>
          <p className="metric-target">{goal}</p>
          <p className="metric-percentage" data-testid="metric-percent">{percentage}</p>
        </div>
      </div>
      <div className="metric-navigation">
        <button type="button" className="metric-arrow" aria-label="Medición anterior" aria-controls={panelId} onClick={() => select(index - 1, -1)}><ArrowLeft size={19} aria-hidden="true" /></button>
        <div className="metric-pagination" aria-label="Elegir medición">
          {metrics.map((item, page) => <button key={item.id} type="button" aria-label={`Ver ${item.name}`} aria-pressed={page === index} aria-controls={panelId} onClick={() => select(page)}><span /></button>)}
        </div>
        <button type="button" className="metric-arrow" aria-label="Medición siguiente" aria-controls={panelId} onClick={() => select(index + 1, 1)}><ArrowRight size={19} aria-hidden="true" /></button>
      </div>
      <div className="metric-footer"><span>Desliza para cambiar</span><button type="button" className="text-button" onClick={() => onNavigate(metric.tab)}>Ver registros <ArrowRight size={14} aria-hidden="true" /></button></div>
      {history && <MetricHistory key={metric.id} series={history} />}
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{metric.name}: {number(metric.value)} {metric.unit}. {percentage}. Medición {index + 1} de {metrics.length}.</p>
    </section>
  );
}
