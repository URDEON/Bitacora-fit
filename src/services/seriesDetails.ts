export interface SeriesDetail { reps: number; weight: number }

/** Keep hidden rows when the count is edited: typing 12 commonly passes through 1. */
export function ensureSeriesDetails(
  previous: SeriesDetail[], count: number, defaults: SeriesDetail,
): SeriesDetail[] {
  if (!Number.isInteger(count) || count < 1 || count > 30 || previous.length >= count) return previous;
  return Array.from({ length: count }, (_, index) => previous[index] || { ...defaults });
}

/** Only active rows belong to a saved workout; the rest are an editing buffer. */
export function activeSeriesDetails(previous: SeriesDetail[], count: number): SeriesDetail[] {
  if (!Number.isInteger(count) || count < 1 || count > 30) return [];
  return previous.slice(0, count).map(set => ({ ...set }));
}

/** JSON encodes an empty numeric input (NaN) as null; restore it as empty, never zero. */
export function restoreSeriesDetails(value: unknown): SeriesDetail[] | null {
  if (!Array.isArray(value) || value.length > 30) return null;
  const numeric = (n: unknown) => n === null || (typeof n === 'number' && Number.isFinite(n));
  if (!value.every(item => item && numeric(item.reps) && numeric(item.weight))) return null;
  return value.map(item => ({ reps: item.reps === null ? Number.NaN : item.reps, weight: item.weight === null ? Number.NaN : item.weight }));
}
