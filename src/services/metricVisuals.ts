const boundedPercent = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;

/** Level of a circle of radius 146: filled AREA, rather than height, equals progress. */
export function waterSurfaceY(percent: number): number {
  const fraction = boundedPercent(percent) / 100;
  if (fraction === 0) return 306;
  if (fraction === .5) return 160;
  if (fraction === 1) return 14;
  let low = -1;
  let high = 1;
  for (let iteration = 0; iteration < 28; iteration++) {
    const offset = (low + high) / 2;
    const area = (Math.acos(offset) - offset * Math.sqrt(1 - offset * offset)) / Math.PI;
    if (area > fraction) low = offset;
    else high = offset;
  }
  return 160 + 146 * (low + high) / 2;
}

/** Continuous progress through discrete cells; a partially filled cell stays partial. */
export function chargeFraction(percent: number, index: number, count: number): number {
  if (!Number.isInteger(count) || count < 1 || !Number.isInteger(index) || index < 0 || index >= count) return 0;
  return Math.max(0, Math.min(1, boundedPercent(percent) / 100 * count - index));
}
