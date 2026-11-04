import sharp from 'sharp';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.join(project, 'android/app/src/main/res');
const icon = await readFile(path.join(project, 'public/app-icon.svg'));
const factors = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [density, factor] of Object.entries(factors)) {
  const folder = path.join(root, `mipmap-${density}`);
  const size = Math.round(48 * factor);
  const foregroundSize = Math.round(108 * factor);
  const inner = Math.round(70 * factor);
  const png = await sharp(icon).resize(size, size).png().toBuffer();
  await writeFile(path.join(folder, 'ic_launcher.png'), png);
  await writeFile(path.join(folder, 'ic_launcher_round.png'), png);
  await sharp({ create: { width: foregroundSize, height: foregroundSize, channels: 4, background: '#14141600' } })
    .composite([{ input: await sharp(icon).resize(inner, inner).png().toBuffer(), gravity: 'center' }]).png().toFile(path.join(folder, 'ic_launcher_foreground.png'));
}
for (const name of await readdir(root)) {
  if (!name.startsWith('drawable')) continue;
  const file = path.join(root, name, 'splash.png');
  let size;
  try { size = await sharp(file).metadata(); } catch { continue; }
  const mark = Math.min(260, Math.round(Math.min(size.width, size.height) * .28));
  const png = await sharp({ create: { width: size.width, height: size.height, channels: 4, background: '#141416' } })
    .composite([{ input: await sharp(icon).resize(mark, mark).png().toBuffer(), gravity: 'center' }]).png().toBuffer();
  await writeFile(file, png);
}
