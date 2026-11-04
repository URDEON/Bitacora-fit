/** Suma `delta` a `value` respetando los límites y evitando errores de coma flotante. */
export function stepValue(value: number, delta: number, min = 0, max = Number.POSITIVE_INFINITY): number {
  const current = Number.isFinite(value) ? value : 0;
  return Math.min(max, Math.max(min, Number((current + delta).toFixed(1))));
}
