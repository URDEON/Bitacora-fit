import assert from 'node:assert/strict';
import test from 'node:test';
import { appearanceVariables, COLOR_ROLES, contrastRatio, DEFAULT_APPEARANCE, normalizeAppearance, normalizeHex, parseAppearanceBackup, patchAppearance, readableAccent, textOnColor } from '../src/services/appearance';

test('Apariencia: valida HEX y conserva el color elegido sin aceptar CSS arbitrario', () => {
  assert.equal(normalizeHex(' aBc '), '#AABBCC');
  assert.equal(normalizeHex('#a0b1c2'), '#A0B1C2');
  for (const value of ['', 'red', '#11223344', '#ff', 'var(--x)', 'url(x)', null, 123, {}, '#GGGGGG']) assert.equal(normalizeHex(value), null);
});

test('Apariencia: configuración dañada y campos desconocidos recuperan valores seguros', () => {
  for (const raw of [null, undefined, [], 'invalid', 14]) assert.deepEqual(normalizeAppearance(raw), DEFAULT_APPEARANCE);
  const normalized = normalizeAppearance({ colors: { primary: '#123456', fit: 'red', unknown: '#FFFFFF' }, effects: { glass: 'none', motion: 'reduced' } });
  assert.equal(normalized.colors.primary, '#123456');
  assert.equal(normalized.colors.fit, DEFAULT_APPEARANCE.colors.fit);
  assert.equal(normalized.effects.glass, 'full');
  assert.equal(normalized.effects.motion, 'reduced');
  assert.deepEqual(Object.keys(normalized.colors), COLOR_ROLES);
  const updated = patchAppearance(normalized, { colors: { charts: '#ff0' }, effects: { glass: 'reduced' } });
  assert.equal(updated.colors.charts, '#FFFF00');
  assert.equal(updated.colors.primary, '#123456');
  assert.equal(normalized.colors.charts, DEFAULT_APPEARANCE.colors.charts);
});

test('Apariencia: colores extremos mantienen AA en texto y controles sin perder el HEX original', () => {
  for (const background of ['#353B3E', '#DFE2DF']) for (const chosen of ['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#808080', '#D8E1E4']) {
    const rendered = readableAccent(chosen, background);
    assert.ok(contrastRatio(rendered, background) >= 4.5, `${chosen} on ${background}: ${rendered}`);
    assert.ok(contrastRatio(rendered, textOnColor(rendered)) >= 4.5, `Button ${rendered}`);
  }
  assert.equal(contrastRatio('#000000', '#FFFFFF'), 21);
  const pref = patchAppearance(DEFAULT_APPEARANCE, { colors: { primary: '#000000' } });
  const variables = appearanceVariables(pref, true);
  assert.equal(pref.colors.primary, '#000000');
  assert.notEqual(variables['--brand-primary'], '#000000');
  assert.equal(variables['--custom-primary-raw'], '#000000');
  assert.ok(!Object.keys(variables).some(key => key.startsWith('--bg-') || key === '--glass-face'));
});

test('Apariencia: cada función recibe su color y los módulos conservan su acento', () => {
  const pref = patchAppearance(DEFAULT_APPEARANCE, { colors: { fit: '#D3A18E', finance: '#D5BA97', icons: '#AFC4CD', active: '#CCBEA0' } });
  for (const dark of [false, true]) {
    const home = appearanceVariables(pref, dark, 'home');
    const fit = appearanceVariables(pref, dark, 'exercises');
    const finance = appearanceVariables(pref, dark, 'finance');
    assert.notEqual(home['--brand-primary'], fit['--brand-primary']);
    assert.equal(fit['--brand-primary'], fit['--custom-fit']);
    assert.equal(finance['--brand-primary'], finance['--custom-finance']);
    for (const role of COLOR_ROLES) {
      assert.ok(home[`--custom-${role}`]);
      assert.equal(home[`--custom-${role}-raw`], pref.colors[role]);
    }
  }
});

test('Apariencia: su respaldo es independiente y rechaza un respaldo de registros u otro formato', () => {
  assert.deepEqual(parseAppearanceBackup(JSON.stringify(DEFAULT_APPEARANCE)), DEFAULT_APPEARANCE);
  for (const raw of ['not json', '{}', '{"version":5,"workouts":[]}', JSON.stringify({ ...DEFAULT_APPEARANCE, colors: { primary: '#000000' } }), JSON.stringify({ ...DEFAULT_APPEARANCE, version: 2 })]) {
    assert.throws(() => parseAppearanceBackup(raw));
  }
});
