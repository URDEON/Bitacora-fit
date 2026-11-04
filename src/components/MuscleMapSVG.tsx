import React from 'react';
import { MUSCLE_LABELS_ES } from '../data/exercises';
import type { MuscleZone as MZ } from '../types';
import { zoneLevel } from '../services/muscleColors';

interface MuscleMapProps {
  primary: MZ[];
  secondary: MZ[];
  compact?: boolean;
}

export const MuscleMapSVG: React.FC<MuscleMapProps> = ({ primary, secondary, compact = false }) => {
  // Una región puede representar varias zonas (p. ej. deltoides frontal/lateral): cuenta la de mayor nivel.
  const getColor = (...zones: MZ[]) => {
    const level = zoneLevel(zones, primary, secondary);
    if (level === 'primary') return '#EF532A'; // Terracotta primario intenso
    if (level === 'secondary') return '#F59E0B'; // Ámbar sinergista
    return 'rgba(138, 132, 124, 0.22)';
  };

  const getStroke = (...zones: MZ[]) => {
    const level = zoneLevel(zones, primary, secondary);
    if (level === 'primary') return '#FF8A65';
    if (level === 'secondary') return '#FCD34D';
    return 'rgba(138, 132, 124, 0.35)';
  };

  return (
    <div
      style={{
        background: 'var(--bg-input)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: compact ? '8px' : '12px',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
          alignItems: 'center',
          justifyItems: 'center',
        }}
      >
        {/* VISTA FRONTAL */}
        <div style={{ textAlign: 'center' }}>
          <span className="mono-num" style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
            VISTA FRONTAL
          </span>
          <svg aria-hidden="true" viewBox="0 0 120 220" style={{ width: compact ? 84 : 112, height: compact ? 150 : 196, display: 'block' }}>
            {/* Cabeza */}
            <circle cx="60" cy="20" r="12" fill="rgba(138,132,124,0.25)" />
            {/* Trapecio superior */}
            <path d="M45 34 L54 31 L66 31 L75 34 L70 40 L50 40 Z" fill={getColor('traps')} stroke={getStroke('traps')} strokeWidth="1" />
            {/* Deltoides frontal / lateral */}
            <ellipse cx="36" cy="48" rx="9" ry="12" fill={getColor('front_delts', 'side_delts')} stroke={getStroke('front_delts', 'side_delts')} strokeWidth="1" />
            <ellipse cx="84" cy="48" rx="9" ry="12" fill={getColor('front_delts', 'side_delts')} stroke={getStroke('front_delts', 'side_delts')} strokeWidth="1" />
            {/* Pectoral superior & mayor */}
            <path d="M44 40 L59 40 L59 50 L43 49 Z" fill={getColor('upper_chest', 'chest')} />
            <path d="M61 40 L76 40 L77 49 L61 50 Z" fill={getColor('upper_chest', 'chest')} />
            <path d="M43 50 L59 50 L58 63 L45 61 Z" fill={getColor('chest')} stroke={getStroke('chest')} strokeWidth="1" />
            <path d="M61 50 L77 50 L75 61 L62 63 Z" fill={getColor('chest')} stroke={getStroke('chest')} strokeWidth="1" />
            {/* Corazón / Cardio */}
            {primary.includes('cardio_heart') && (
              <circle cx="64" cy="54" r="6" fill="#EF4444" stroke="#FCA5A5" strokeWidth="1.5" />
            )}
            {/* Bíceps */}
            <ellipse cx="32" cy="70" rx="6.5" ry="13" fill={getColor('biceps')} stroke={getStroke('biceps')} strokeWidth="1" />
            <ellipse cx="88" cy="70" rx="6.5" ry="13" fill={getColor('biceps')} stroke={getStroke('biceps')} strokeWidth="1" />
            {/* Antebrazos */}
            <ellipse cx="28" cy="96" rx="5.5" ry="14" fill={getColor('forearms')} />
            <ellipse cx="92" cy="96" rx="5.5" ry="14" fill={getColor('forearms')} />
            {/* Recto abdominal */}
            <rect x="50" y="65" width="9" height="36" rx="3" fill={getColor('abs')} stroke={getStroke('abs')} strokeWidth="1" />
            <rect x="61" y="65" width="9" height="36" rx="3" fill={getColor('abs')} stroke={getStroke('abs')} strokeWidth="1" />
            {/* Oblicuos */}
            <path d="M44 65 L49 67 L49 100 L43 96 Z" fill={getColor('obliques')} />
            <path d="M76 65 L71 67 L71 100 L77 96 Z" fill={getColor('obliques')} />
            {/* Aductores */}
            <path d="M54 108 L59 108 L57 142 L53 138 Z" fill={getColor('adductors')} />
            <path d="M61 108 L66 108 L67 138 L63 142 Z" fill={getColor('adductors')} />
            {/* Cuádriceps */}
            <ellipse cx="47" cy="134" rx="9" ry="26" fill={getColor('quads')} stroke={getStroke('quads')} strokeWidth="1" />
            <ellipse cx="73" cy="134" rx="9" ry="26" fill={getColor('quads')} stroke={getStroke('quads')} strokeWidth="1" />
            {/* Gemelos vista frontal */}
            <ellipse cx="47" cy="182" rx="6.5" ry="20" fill={getColor('calves')} />
            <ellipse cx="73" cy="182" rx="6.5" ry="20" fill={getColor('calves')} />
          </svg>
        </div>

        {/* VISTA POSTERIOR */}
        <div style={{ textAlign: 'center' }}>
          <span className="mono-num" style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
            VISTA POSTERIOR
          </span>
          <svg aria-hidden="true" viewBox="0 0 120 220" style={{ width: compact ? 84 : 112, height: compact ? 150 : 196, display: 'block' }}>
            {/* Cabeza */}
            <circle cx="60" cy="20" r="12" fill="rgba(138,132,124,0.25)" />
            {/* Trapecio */}
            <polygon points="44,35 60,30 76,35 60,56" fill={getColor('traps')} stroke={getStroke('traps')} strokeWidth="1" />
            {/* Deltoides posterior */}
            <ellipse cx="36" cy="48" rx="9" ry="11" fill={getColor('rear_delts', 'side_delts')} stroke={getStroke('rear_delts', 'side_delts')} strokeWidth="1" />
            <ellipse cx="84" cy="48" rx="9" ry="11" fill={getColor('rear_delts', 'side_delts')} stroke={getStroke('rear_delts', 'side_delts')} strokeWidth="1" />
            {/* Espalda media / Romboides */}
            <rect x="49" y="48" width="22" height="18" rx="4" fill={getColor('mid_back')} stroke={getStroke('mid_back')} strokeWidth="1" />
            {/* Dorsales (Lats) */}
            <path d="M42 56 L51 64 L51 86 L43 76 Z" fill={getColor('lats')} stroke={getStroke('lats')} strokeWidth="1" />
            <path d="M78 56 L69 64 L69 86 L77 76 Z" fill={getColor('lats')} stroke={getStroke('lats')} strokeWidth="1" />
            {/* Lumbar */}
            <rect x="51" y="78" width="18" height="20" rx="4" fill={getColor('lower_back')} stroke={getStroke('lower_back')} strokeWidth="1" />
            {/* Tríceps */}
            <ellipse cx="32" cy="70" rx="6.5" ry="13" fill={getColor('triceps')} stroke={getStroke('triceps')} strokeWidth="1" />
            <ellipse cx="88" cy="70" rx="6.5" ry="13" fill={getColor('triceps')} stroke={getStroke('triceps')} strokeWidth="1" />
            {/* Antebrazos */}
            <ellipse cx="28" cy="96" rx="5.5" ry="14" fill={getColor('forearms')} />
            <ellipse cx="92" cy="96" rx="5.5" ry="14" fill={getColor('forearms')} />
            {/* Glúteos */}
            <ellipse cx="51" cy="109" rx="9.5" ry="11" fill={getColor('glutes')} stroke={getStroke('glutes')} strokeWidth="1" />
            <ellipse cx="69" cy="109" rx="9.5" ry="11" fill={getColor('glutes')} stroke={getStroke('glutes')} strokeWidth="1" />
            {/* Isquiotibiales / Femoral */}
            <ellipse cx="48" cy="141" rx="8.5" ry="22" fill={getColor('hamstrings')} stroke={getStroke('hamstrings')} strokeWidth="1" />
            <ellipse cx="72" cy="141" rx="8.5" ry="22" fill={getColor('hamstrings')} stroke={getStroke('hamstrings')} strokeWidth="1" />
            {/* Gemelos */}
            <ellipse cx="48" cy="182" rx="7" ry="20" fill={getColor('calves')} stroke={getStroke('calves')} strokeWidth="1" />
            <ellipse cx="72" cy="182" rx="7" ry="20" fill={getColor('calves')} stroke={getStroke('calves')} strokeWidth="1" />
          </svg>
        </div>
      </div>

      {/* Leyenda muscular */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
        {primary.map((z) => (
          <span
            key={z}
            style={{
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              border: '1px solid var(--accent)',
              borderRadius: 999,
              padding: '2px 8px',
              fontSize: '0.64rem',
              fontWeight: 700,
            }}
          >
            ● Principal: {MUSCLE_LABELS_ES[z]}
          </span>
        ))}
        {secondary.map((z) => (
          <span
            key={z}
            style={{
              background: 'var(--accent-amber-soft)',
              color: 'var(--accent-amber)',
              borderRadius: 999,
              padding: '2px 8px',
              fontSize: '0.62rem',
              fontWeight: 600,
            }}
          >
            ○ Secundario: {MUSCLE_LABELS_ES[z]}
          </span>
        ))}
      </div>
    </div>
  );
};
