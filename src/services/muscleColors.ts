import type { MuscleZone } from '../types';

export type ZoneLevel = 'primary' | 'secondary' | 'none';

/** Nivel de trabajo de una región dibujada con varias zonas: principal si alguna lo es, si no secundaria. */
export function zoneLevel(zones: MuscleZone[], primary: MuscleZone[], secondary: MuscleZone[]): ZoneLevel {
  if (zones.some((zone) => primary.includes(zone))) return 'primary';
  if (zones.some((zone) => secondary.includes(zone))) return 'secondary';
  return 'none';
}
