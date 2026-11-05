import { useId } from 'react';
import { dateLabel } from '../services/dates';
import type { MetricHistorySeries } from '../services/metricHistory';

const number = (value: number) => value.toLocaleString('es', { maximumFractionDigits: 1 });
const shortDate = (date: string) => new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00`));

export function MetricHistory({ series }: { series: MetricHistorySeries }) {
  const id = useId();
  if (!series.points.length) return null;
  const last = series.points[series.points.length - 1];
  const max = Math.max(1, ...series.points.map(point => point.value));
  const coordinates = series.points.map((point, index) => ({
    ...point, x: 12 + index / Math.max(1, series.points.length - 1) * 296,
    y: 76 - point.value / max * 62,
  }));
  const line = coordinates.map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`).join(' ');
  const finalPoint = coordinates[coordinates.length - 1];
  const training = series.id === 'training';
  const hasRecords = series.points.some(point => point.value > 0);
  return (
    <figure className="metric-history" aria-labelledby={`${id}-title`} data-history={series.id}>
      <figcaption className="metric-history-heading">
        <div>
          <h4 id={`${id}-title`}>{training ? 'Días con entrenamiento' : `${series.name} · últimos 7 días`}</h4>
          <p>{shortDate(series.points[0].date)} — {shortDate(last.date)}</p>
        </div>
        <span className="metric-history-current">{training ? last.value ? 'Entrenaste' : 'Sin entrenar' : <><strong>{number(last.value)}</strong> {series.unit}</>}<small>{shortDate(last.date)}</small></span>
      </figcaption>
      <svg className="metric-history-plot" viewBox="0 0 320 94" role="img" aria-labelledby={`${id}-title ${id}-description`}>
        <desc id={`${id}-description`}>{series.points.map(point => `${dateLabel(point.date)}: ${training ? point.value ? 'con entrenamiento' : 'sin entrenamiento' : `${number(point.value)} ${series.unit}`}`).join('. ')}.</desc>
        <defs><linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity=".17" /><stop offset="100%" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs>
        <path className="metric-history-grid" d="M12,14 H308 M12,45 H308 M12,76 H308" />
        {training ? coordinates.map(point => <rect key={point.date} className="metric-history-bar" x={point.x - 5} y={point.value ? 14 : 70} width="10" height={point.value ? 62 : 6} rx="5" data-filled={point.value > 0} data-current={point.date === last.date} />) : <>
          <path className="metric-history-area" d={`${line} L308,76 L12,76 Z`} fill={`url(#${id}-fill)`} />
          <path className="metric-history-line" d={line} />
          <path className="metric-history-guide" d={`M${finalPoint.x},${finalPoint.y} V76`} />
          {coordinates.map(point => <circle key={point.date} className="metric-history-point" cx={point.x} cy={point.y} r={point.date === last.date ? 4 : 2.5} data-current={point.date === last.date} />)}
        </>}
      </svg>
      <div className="metric-history-labels" aria-hidden="true">{series.points.map(point => <span key={point.date} data-current={point.date === last.date}>{new Intl.DateTimeFormat('es', { weekday: 'narrow' }).format(new Date(`${point.date}T12:00:00`))}</span>)}</div>
      {!hasRecords && <p className="metric-history-empty">Sin registros en estos días.</p>}
      <details className="metric-history-details">
        <summary>Ver los 7 días <span aria-hidden="true">+</span></summary>
        <table>
          <caption className="sr-only">Historial de {series.name}</caption>
          <thead><tr><th scope="col">Fecha</th><th scope="col">{training ? 'Entrenamiento' : series.unit}</th></tr></thead>
          <tbody>{series.points.map(point => <tr key={point.date} aria-current={point.date === last.date ? 'date' : undefined}><th scope="row">{shortDate(point.date)}</th><td>{training ? point.value ? 'Sí' : 'No' : number(point.value)}</td></tr>)}</tbody>
        </table>
      </details>
    </figure>
  );
}
