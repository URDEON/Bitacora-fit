import sharp from 'sharp';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.join(project, 'android/app/src/main/res');
const icon = await readFile(path.join(project, 'public/app-icon.svg'));
const emblemBackground = '#202321';
const launchBackground = { light: '#F5F2EB', dark: '#0F1114' };
const factors = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

// Web installs and every native density are rendered from the header's SVG.
for (const size of [192, 512]) {
  await sharp(icon).resize(size, size).png().toFile(path.join(project, `public/icon-${size}.png`));
}
await sharp({ create: { width: 512, height: 512, channels: 4, background: emblemBackground } })
  .composite([{ input: await sharp(icon).png().toBuffer() }])
  .png().toFile(path.join(project, 'public/icon-maskable-512.png'));

for (const [density, factor] of Object.entries(factors)) {
  const folder = path.join(root, `mipmap-${density}`);
  await mkdir(folder, { recursive: true });
  const size = Math.round(48 * factor);
  const foregroundSize = Math.round(108 * factor);
  const inner = Math.round(70 * factor);
  const png = await sharp(icon).resize(size, size).png().toBuffer();
  await writeFile(path.join(folder, 'ic_launcher.png'), png);
  const circle = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/></svg>`);
  await sharp(png).composite([{ input: circle, blend: 'dest-in' }]).png().toFile(path.join(folder, 'ic_launcher_round.png'));
  // The pulse stays inside Android's 66 dp safe zone on its 108 dp canvas.
  await sharp({ create: { width: foregroundSize, height: foregroundSize, channels: 4, background: '#00000000' } })
    .composite([{ input: await sharp(icon).resize(inner, inner).png().toBuffer(), gravity: 'center' }]).png().toFile(path.join(folder, 'ic_launcher_foreground.png'));
}
for (const name of await readdir(root)) {
  if (!name.startsWith('drawable') || name.includes('night')) continue;
  const file = path.join(root, name, 'splash.png');
  let size;
  try { size = await sharp(file).metadata(); } catch { continue; }
  const scale = factors[name.split('-').at(-1)] ?? 1;
  const mark = Math.min(Math.round(96 * scale), Math.round(Math.min(size.width, size.height) * .28));
  const badge = await sharp(icon).resize(mark, mark).png().toBuffer();
  for (const [theme, background] of Object.entries(launchBackground)) {
    // Android qualifiers put orientation before night, then density.
    const nightName = name.replace(/^(drawable(?:-(?:land|port))?)/, '$1-night');
    const folder = path.join(root, theme === 'dark' ? nightName : name);
    await mkdir(folder, { recursive: true });
    await sharp({ create: { width: size.width, height: size.height, channels: 4, background } })
      .composite([{ input: badge, gravity: 'center' }]).png().toFile(path.join(folder, 'splash.png'));
  }
}
