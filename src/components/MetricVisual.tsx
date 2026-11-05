import { useId } from 'react';
import type { HomeMetric } from '../services/homeMetrics';
import { metricProgress } from '../services/homeMetrics';
import { chargeFraction, waterSurfaceY } from '../services/metricVisuals';

const point = (angle: number, radius: number) => ({ x: 160 + Math.sin(angle * Math.PI / 180) * radius, y: 160 - Math.cos(angle * Math.PI / 180) * radius });
const arc = (start: number, end: number, radius = 138) => {
  const a = point(start, radius), b = point(end, radius);
  return `M${a.x} ${a.y} A${radius} ${radius} 0 ${end - start > 180 ? 1 : 0} 1 ${b.x} ${b.y}`;
};

/** Decorative identity only. MetricCarousel retains the real values and accessible progress. */
export function MetricVisual({ metric }: { metric: HomeMetric }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const { ringPercent: percent } = metricProgress(metric.value, metric.goal);
  const liquidY = waterSurfaceY(percent);
  const trainingCount = metric.goal !== null && Number.isInteger(metric.goal) && metric.goal >= 1 && metric.goal <= 7 ? metric.goal : 0;
  const nodes = Array.from({ length: 12 }, (_, index) => point(index * 30, index % 2 ? 124 : 134));
  return (
    <svg className="metric-identity-visual" viewBox="0 0 320 320" preserveAspectRatio="none" aria-hidden="true" focusable="false" data-visual={metric.id}>
      {metric.id === 'training' && <>
        {Array.from({ length: trainingCount }, (_, index) => {
          const step = 360 / trainingCount, gap = Math.min(12, step * .17);
          const path = arc(index * step + gap / 2, (index + 1) * step - gap / 2);
          const fraction = chargeFraction(percent, index, trainingCount);
          const marker = point((index + .5) * step, 122);
          return <g key={index} data-segment={index} data-fraction={fraction}>
            <path className="training-segment" d={path} />
            {fraction > 0 && <path className="training-segment" data-complete="true" d={path} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - fraction} />}
            {fraction >= 1 && <circle className="training-marker" cx={marker.x} cy={marker.y} r={2.6} />}
          </g>;
        })}
      </>}
      {metric.id === 'water' && <>
        <defs><clipPath id={`${id}-water`}><circle cx={160} cy={160} r={146} /></clipPath></defs>
        <g clipPath={`url(#${id}-water)`}>
          <g className="water-level" data-level-y={liquidY} data-fill-percent={percent} transform={`translate(0 ${liquidY})`}>
            {percent > 0 && <>
              <path className="water-body" d="M0 0H320V320H0Z" />
              <path className="water-meniscus" d="M0 0C35 -4 65 4 100 0S165 -4 200 0S265 4 320 0" />
              <g className="water-bubbles"><circle cx={68} cy={44} r={4} /><circle cx={251} cy={83} r={6} /><circle cx={83} cy={126} r={2.8} /></g>
            </>}
          </g>
        </g>
      </>}
      {metric.id === 'energy' && <>
        {Array.from({ length: 20 }, (_, index) => {
          const fraction = chargeFraction(percent, index, 20);
          return <g key={index} transform={`translate(160 160) rotate(${index * 18})`} data-energy-cell={index} data-fraction={fraction}>
            <defs><clipPath id={`${id}-energy-${index}`}><rect className="metric-fill-window" x={-5} y={-120 - 20 * fraction} width={10} height={20 * fraction} /></clipPath></defs>
            <rect className="energy-cell" x={-4} y={-140} width={8} height={20} rx={3} />
            {fraction > 0 && <rect className="energy-cell" data-filled="true" x={-4} y={-140} width={8} height={20} rx={3} clipPath={`url(#${id}-energy-${index})`} />}
          </g>;
        })}
        {[38, 142, 218, 322].map(angle => {
          const a = point(angle, 103), b = point(angle, 112);
          return <path key={angle} className="energy-core-ray" d={`M${a.x} ${a.y}L${b.x} ${b.y}`} />;
        })}
      </>}
      {metric.id === 'protein' && <>
        {nodes.slice(0, -1).map((node, index) => <path key={index} className="protein-bond" data-filled={chargeFraction(percent, index + 1, nodes.length) > 0} d={`M${node.x} ${node.y}L${nodes[index + 1].x} ${nodes[index + 1].y}`} />)}
        {nodes.map((node, index) => {
          const fraction = chargeFraction(percent, index, nodes.length);
          const surface = node.y + (waterSurfaceY(fraction * 100) - 160) * 6 / 146;
          return <g key={index} data-protein-node={index} data-fraction={fraction}>
            <defs><clipPath id={`${id}-protein-${index}`}><rect className="metric-fill-window" x={node.x - 7} y={surface} width={14} height={node.y + 6 - surface} /></clipPath></defs>
            <circle className="protein-node" data-filled={fraction > 0} cx={node.x} cy={node.y} r={8} />
            {fraction > 0 && <circle className="protein-node-core" cx={node.x} cy={node.y} r={6} clipPath={`url(#${id}-protein-${index})`} />}
          </g>;
        })}
      </>}
    </svg>
  );
}
