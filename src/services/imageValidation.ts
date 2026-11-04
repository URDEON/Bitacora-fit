export type SupportedImageType = 'jpeg' | 'png' | 'webp';
export type DetectedImageType = SupportedImageType | 'heif' | 'unknown';

export const SUPPORTED_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const UNSUPPORTED_FORMAT_MESSAGE = 'Selecciona imágenes JPG, PNG o WebP de hasta 15 MB.';
export const HEIF_MESSAGE = 'Las fotos HEIC/HEIF no son compatibles todavía. Conviértelas a JPG o PNG (en la cámara elige el formato «Más compatible») e inténtalo de nuevo.';

const ascii = (bytes: Uint8Array, start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
const HEIF_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1']);

/** Detecta el formato real por su firma, sin confiar en la extensión ni en `file.type`. */
export function detectImageType(bytes: Uint8Array): DetectedImageType {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)) return 'png';
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return 'webp';
  if (bytes.length >= 12 && ascii(bytes, 4, 8) === 'ftyp' && HEIF_BRANDS.has(ascii(bytes, 8, 12))) return 'heif';
  return 'unknown';
}

/** Valida tamaño y contenido real. Lanza un error con mensaje para el usuario si no es procesable. */
export async function validateImageFile(file: Blob): Promise<SupportedImageType> {
  if (file.size > MAX_IMAGE_BYTES) throw new Error(UNSUPPORTED_FORMAT_MESSAGE);
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const type = detectImageType(header);
  if (type === 'heif') throw new Error(HEIF_MESSAGE);
  if (type === 'unknown') throw new Error(UNSUPPORTED_FORMAT_MESSAGE);
  return type;
}

/** Formato de DataURL que acepta `validateDB` para fotos propias. */
export const STORED_PHOTO_PATTERN = /^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/;
