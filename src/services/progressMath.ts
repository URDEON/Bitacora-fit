/** Un cambio de peso es favorable si acerca (o mantiene) el peso a la meta, sea para bajar o para subir. */
export function isFavorableWeightChange(firstKg: number, latestKg: number, targetKg: number): boolean {
  return Math.abs(latestKg - targetKg) <= Math.abs(firstKg - targetKg);
}
