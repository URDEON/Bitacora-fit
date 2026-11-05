export const APPEARANCE_KEY = 'bitacora_fit_appearance_v1';

export const COLOR_ROLES = ['primary', 'fit', 'finance', 'notes', 'tools', 'icons', 'charts', 'calendar', 'progress', 'active'] as const;
export type ColorRole = typeof COLOR_ROLES[number];
export type AppearanceColors = Record<ColorRole, string>;
export interface AppearanceEffects { glass: 'full' | 'reduced'; motion: 'system' | 'reduced'; }
export interface AppearancePreferences { version: 1; colors: AppearanceColors; effects: AppearanceEffects; }
export interface AppearancePatch { colors?: Partial<AppearanceColors>; effects?: Partial<AppearanceEffects>; }

export const DEFAULT_APPEARANCE: AppearancePreferences = {
  version: 1,
  colors: {
    primary: '#D8E1E4', fit: '#D8E1E4', finance: '#CDB28D', notes: '#CCBEA0', tools: '#BCC8CF',
    icons: '#D8E1E4', charts: '#D8E1E4', calendar: '#D8E1E4', progress: '#D8E1E4', active: '#D8E1E4',
  },
  effects: { glass: 'full', motion: 'system' },
};

/** Preserve the chosen color; contrast adjustments only affect its rendered tokens. */
export function normalizeHex(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const hex = value.trim().replace(/^#/, '');
  if (/^[\da-f]{3}$/i.test(hex)) return `#${hex.split('').map(x => x + x).join('').toUpperCase()}`;
  return /^[\da-f]{6}$/i.test(hex) ? `#${hex.toUpperCase()}` : null;
}

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

export function normalizeAppearance(raw: unknown): AppearancePreferences {
  const colors = { ...DEFAULT_APPEARANCE.colors };
  const effects = { ...DEFAULT_APPEARANCE.effects };
  if (object(raw)) {
    if (object(raw.colors)) for (const key of COLOR_ROLES) colors[key] = normalizeHex(raw.colors[key]) ?? colors[key];
    if (object(raw.effects)) {
      if (raw.effects.glass === 'full' || raw.effects.glass === 'reduced') effects.glass = raw.effects.glass;
      if (raw.effects.motion === 'system' || raw.effects.motion === 'reduced') effects.motion = raw.effects.motion;
    }
  }
  return { version: 1, colors, effects };
}

export function patchAppearance(current: AppearancePreferences, patch: AppearancePatch): AppearancePreferences {
  return normalizeAppearance({ colors: { ...current.colors, ...patch.colors }, effects: { ...current.effects, ...patch.effects } });
}

function rgb(hex: string): [number, number, number] {
  const value = normalizeHex(hex) ?? '#000000';
  return [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16)) as [number, number, number];
}

export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map(value => {
    const channel = value / 255;
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
  });
  return .2126 * r + .7152 * g + .0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const first = luminance(a), second = luminance(b);
  return (Math.max(first, second) + .05) / (Math.min(first, second) + .05);
}

export function mixColor(a: string, b: string, fraction: number): string {
  const first = rgb(a), second = rgb(b), amount = Math.max(0, Math.min(1, fraction));
  return `#${first.map((value, i) => Math.round(value + (second[i] - value) * amount).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

export function textOnColor(color: string): '#FFFFFF' | '#101315' {
  return contrastRatio(color, '#101315') >= contrastRatio(color, '#FFFFFF') ? '#101315' : '#FFFFFF';
}

/** Find the closest mix toward white/black that reaches AA on the reading surface. */
export function readableAccent(color: string, background: string, minimum = 4.5): string {
  const normalized = normalizeHex(color) ?? '#D8E1E4';
  if (contrastRatio(normalized, background) >= minimum) return normalized;
  const destination = contrastRatio('#FFFFFF', background) > contrastRatio('#000000', background) ? '#FFFFFF' : '#000000';
  let lo = 0, hi = 1;
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2;
    if (contrastRatio(mixColor(normalized, destination, mid), background) >= minimum) hi = mid;
    else lo = mid;
  }
  return mixColor(normalized, destination, hi);
}

const rgba = (color: string, alpha: number): string => `rgba(${rgb(color).join(', ')}, ${alpha})`;

/** All surfaces stay neutral. Only text, strokes and small selected states receive color. */
export function appearanceVariables(preferences: AppearancePreferences, dark: boolean, section = 'home'): Record<string, string> {
  // Keep accent text readable even when the floating glass crosses a light photo
  // in dark mode or dark content in light mode. The glass itself stays neutral.
  const readingSurface = dark ? '#586166' : '#B6BABB';
  const colors = Object.fromEntries(COLOR_ROLES.map(role => [role, readableAccent(preferences.colors[role], readingSurface)])) as AppearanceColors;
  const module: ColorRole = ['exercises', 'meals', 'chrono', 'progress', 'fit'].includes(section) ? 'fit'
    : section === 'finance' ? 'finance' : section === 'notes' ? 'notes' : section === 'tools' ? 'tools' : 'primary';
  const accent = colors[module];
  const activeSurface = mixColor(readingSurface, colors.active, dark ? .16 : .11);
  const variables: Record<string, string> = {
    '--brand-primary': accent,
    '--brand-primary-hover': mixColor(accent, dark ? '#FFFFFF' : '#000000', .12),
    '--brand-primary-soft': rgba(accent, dark ? .14 : .10),
    '--text-on-accent': textOnColor(accent),
    '--focus-ring': accent,
    '--hero-cta-bg': accent,
    '--hero-cta-hover': mixColor(accent, dark ? '#FFFFFF' : '#000000', .12),
    '--hero-cta-text': textOnColor(accent),
    '--glass-nav-active': rgba(colors.active, dark ? .16 : .11),
    '--glass-nav-active-text': readableAccent(colors.active, activeSurface),
    '--glass-nav-active-edge': rgba(colors.active, dark ? .35 : .3),
  };
  for (const role of COLOR_ROLES) {
    variables[`--custom-${role}`] = colors[role];
    variables[`--custom-${role}-raw`] = preferences.colors[role];
    variables[`--custom-${role}-on`] = textOnColor(colors[role]);
    variables[`--custom-${role}-soft`] = rgba(colors[role], dark ? .14 : .1);
  }
  for (const [legacy, role] of [['training', 'fit'], ['nutrition', 'fit'], ['hydration', 'fit'], ['progress', 'charts']] as const) {
    variables[`--brand-${legacy}`] = colors[role];
    variables[`--brand-${legacy}-hover`] = mixColor(colors[role], dark ? '#FFFFFF' : '#000000', .12);
    variables[`--brand-${legacy}-soft`] = rgba(colors[role], dark ? .14 : .1);
  }
  return variables;
}

export function parseAppearanceBackup(text: string): AppearancePreferences {
  const raw: unknown = JSON.parse(text);
  if (!object(raw) || raw.version !== 1 || !object(raw.colors) || !object(raw.effects)
    || !COLOR_ROLES.every(role => normalizeHex((raw.colors as Record<string, unknown>)[role]))
    || !['full', 'reduced'].includes(String(raw.effects.glass))
    || !['system', 'reduced'].includes(String(raw.effects.motion))) {
    throw new Error('El archivo no contiene una apariencia válida de Bitácora.');
  }
  return normalizeAppearance(raw);
}
