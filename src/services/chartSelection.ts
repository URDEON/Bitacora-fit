export interface SelectablePoint { label: string; value: number; sub?: string }

/** Índice seleccionado válido para una serie; si no existe, el último punto. */
export function clampSelectedIndex(selected: number | null, length: number): number | null {
  if (length <= 0) return null;
  if (selected === null || !Number.isInteger(selected) || selected < 0 || selected >= length) return length - 1;
  return selected;
}

/** Identidad del contenido de una serie: cambia cuando se cambia de ejercicio o de datos, no en cada render. */
export function chartSignature(points: SelectablePoint[]): string {
  return points.map((point) => `${point.label}|${point.value}|${point.sub ?? ''}`).join(';');
}
