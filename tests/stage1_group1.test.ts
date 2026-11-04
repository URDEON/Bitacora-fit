import test from 'node:test';
import assert from 'node:assert/strict';
import { detectImageType, validateImageFile, HEIF_MESSAGE, UNSUPPORTED_FORMAT_MESSAGE } from '../src/services/imageValidation';
import { stepValue } from '../src/services/stepper';
import { chartSignature, clampSelectedIndex } from '../src/services/chartSelection';
import { previousComparableWorkout } from '../src/services/workoutCompare';
import { zoneLevel } from '../src/services/muscleColors';
import { isFavorableWeightChange } from '../src/services/progressMath';
import { runningChronoLabel } from '../src/services/chronoLabels';
import type { WorkoutEntry } from '../src/types';

const bytes = (...values: number[]) => new Uint8Array([...values, ...new Array(Math.max(0, 16 - values.length)).fill(0)]);
const text = (value: string, pad = 16) => bytes(...Array.from(value).map((char) => char.charCodeAt(0)), ...new Array(Math.max(0, pad - value.length)).fill(0));
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const WEBP = text('RIFF\0\0\0\0WEBPVP8 ');
const HEIC = bytes(0, 0, 0, 0x18, ...Array.from('ftypheic').map((char) => char.charCodeAt(0)));

test('C-03 detecta el formato real por firma y distingue HEIC/HEIF', () => {
  assert.equal(detectImageType(JPEG), 'jpeg');
  assert.equal(detectImageType(PNG), 'png');
  assert.equal(detectImageType(WEBP), 'webp');
  assert.equal(detectImageType(HEIC), 'heif');
  assert.equal(detectImageType(text('hola mundo')), 'unknown');
  assert.equal(detectImageType(new Uint8Array([])), 'unknown');
});
test('C-03 valida el contenido, no la extensión ni el tipo declarado', async () => {
  assert.equal(await validateImageFile(new Blob([JPEG], { type: 'image/heic' })), 'jpeg');
  assert.equal(await validateImageFile(new Blob([PNG], { type: '' })), 'png');
  await assert.rejects(validateImageFile(new Blob([HEIC], { type: 'image/jpeg' })), { message: HEIF_MESSAGE });
  await assert.rejects(validateImageFile(new Blob([text('<html>')], { type: 'image/png' })), { message: UNSUPPORTED_FORMAT_MESSAGE });
  await assert.rejects(validateImageFile(new Blob([new Uint8Array(15 * 1024 * 1024 + 1)], { type: 'image/jpeg' })), { message: UNSUPPORTED_FORMAT_MESSAGE });
});
test('C-06 los pasos respetan mínimo y máximo y evitan errores de coma flotante', () => {
  assert.equal(stepValue(30, 1, 1, 30), 30);
  assert.equal(stepValue(29, 1, 1, 30), 30);
  assert.equal(stepValue(1, -1, 1, 30), 1);
  assert.equal(stepValue(1499, 2.5, 0, 1500), 1500);
  assert.equal(stepValue(0.1, 0.2, 0, 10), 0.3);
  assert.equal(stepValue(Number.NaN, 1, 1, 30), 1);
  assert.equal(stepValue(50, 1, 0), 51);
});
test('C-07 la selección del gráfico se mantiene válida y se reinicia al cambiar de serie', () => {
  assert.equal(clampSelectedIndex(null, 0), null);
  assert.equal(clampSelectedIndex(5, 3), 2);
  assert.equal(clampSelectedIndex(1, 3), 1);
  assert.equal(clampSelectedIndex(-1, 3), 2);
  const press = [{ label: '2026-11-01', value: 40 }, { label: '2026-11-02', value: 45 }];
  const sentadilla = [{ label: '2026-11-01', value: 60 }];
  assert.notEqual(chartSignature(press), chartSignature(sentadilla));
  assert.equal(chartSignature(press), chartSignature(press.map((point) => ({ ...point }))));
});
test('C-12 la comparación de carga desempata por hora e identificador', () => {
  const base = { category: 'Pecho', name: 'Press', mode: 'strength' as const };
  const entries: WorkoutEntry[] = [
    { ...base, id: 1, date: '2026-11-01', time: '09:00', weight: 40 },
    { ...base, id: 2, date: '2026-11-01', time: '18:00', weight: 50 },
    { ...base, id: 3, date: '2026-11-01', time: '18:00', weight: 55 },
    { ...base, id: 4, date: '2026-11-02', time: '10:00', weight: 60 },
  ];
  assert.equal(previousComparableWorkout(entries, entries[3])?.id, 3);
  assert.equal(previousComparableWorkout([...entries].reverse(), entries[3])?.id, 3);
  assert.equal(previousComparableWorkout(entries, entries[0]), null);
  assert.equal(previousComparableWorkout(entries, { ...entries[3], name: 'otro' }), null);
});
test('C-12 el mapa muscular reconoce zonas secundarias y el peso favorable depende de la meta', () => {
  assert.equal(zoneLevel(['front_delts', 'side_delts'], [], ['side_delts']), 'secondary');
  assert.equal(zoneLevel(['upper_chest', 'chest'], [], ['upper_chest']), 'secondary');
  assert.equal(zoneLevel(['front_delts', 'side_delts'], ['side_delts'], ['front_delts']), 'primary');
  assert.equal(zoneLevel(['biceps'], ['chest'], ['abs']), 'none');
  assert.equal(isFavorableWeightChange(70, 72, 80), true);
  assert.equal(isFavorableWeightChange(70, 72, 65), false);
  assert.equal(isFavorableWeightChange(80, 78, 75), true);
});
test('C-12 el aviso del reloj describe el modo y la fase reales', () => {
  assert.equal(runningChronoLabel({ mode: 'countdown', hiitPhase: 'work' }), 'Descanso');
  assert.equal(runningChronoLabel({ mode: 'stopwatch', hiitPhase: 'work' }), 'Cronómetro');
  assert.equal(runningChronoLabel({ mode: 'hiit', hiitPhase: 'work' }), 'Trabajo HIIT');
  assert.equal(runningChronoLabel({ mode: 'hiit', hiitPhase: 'rest' }), 'Descanso HIIT');
});
