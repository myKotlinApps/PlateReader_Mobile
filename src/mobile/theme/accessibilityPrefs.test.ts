import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAccessibilityAttributes,
  DEFAULT_USER_APPEARANCE_PREFS,
  normalizeUserAppearancePrefs,
  summarizeAccessibilityPrefs,
} from './accessibilityPrefs.ts';

test('normalizeUserAppearancePrefs falls back to defaults for missing or invalid values', () => {
  const normalized = normalizeUserAppearancePrefs({
    cornerStyle: 'unknown' as any,
    paletteId: 'bad_palette' as any,
    fontScale: 'huge' as any,
    highContrast: 'yes' as any,
  });

  assert.deepEqual(normalized, DEFAULT_USER_APPEARANCE_PREFS);
});

test('normalizeUserAppearancePrefs merges partial updates over fallback user preferences', () => {
  const existing = normalizeUserAppearancePrefs({
    cornerStyle: 'sharp',
    paletteId: 'emerald_atelier',
    fontScale: 'large',
    highContrast: true,
    boldText: true,
    reduceMotion: false,
  });

  const afterPaletteSwitch = normalizeUserAppearancePrefs(
    { paletteId: 'nordic_indigo' },
    existing,
  );

  assert.equal(afterPaletteSwitch.cornerStyle, 'sharp');
  assert.equal(afterPaletteSwitch.paletteId, 'nordic_indigo');
  assert.equal(afterPaletteSwitch.fontScale, 'large');
  assert.equal(afterPaletteSwitch.highContrast, true);
  assert.equal(afterPaletteSwitch.boldText, true);
  assert.equal(afterPaletteSwitch.reduceMotion, false);
});

test('computeAccessibilityAttributes produces exact scale multipliers, touch targets, and DOM flags', () => {
  const normal = computeAccessibilityAttributes({ fontScale: 'normal' });
  assert.equal(normal.attributes['data-font-scale'], 'normal');
  assert.equal(normal.cssVars['--ui-font-mult'], '1');
  assert.equal(normal.cssVars['--ui-touch-min'], '44px');
  assert.equal(normal.cssVars['--ui-body-weight'], '400');
  assert.equal(normal.hasElevatedAccessibility, false);

  const presbyopia = computeAccessibilityAttributes({
    fontScale: 'large',
    highContrast: true,
    boldText: true,
    reduceMotion: true,
  });
  assert.equal(presbyopia.attributes['data-font-scale'], 'large');
  assert.equal(presbyopia.attributes['data-high-contrast'], 'true');
  assert.equal(presbyopia.attributes['data-bold-text'], 'true');
  assert.equal(presbyopia.attributes['data-reduce-motion'], 'true');
  assert.equal(presbyopia.cssVars['--ui-font-mult'], '1.18');
  assert.equal(presbyopia.cssVars['--ui-touch-min'], '48px');
  assert.equal(presbyopia.cssVars['--ui-body-weight'], '600');
  assert.equal(presbyopia.hasElevatedAccessibility, true);

  const xlarge = computeAccessibilityAttributes({ fontScale: 'xlarge' });
  assert.equal(xlarge.cssVars['--ui-font-mult'], '1.32');
  assert.equal(xlarge.cssVars['--ui-touch-min'], '52px');
});

test('summarizeAccessibilityPrefs returns Persian summary for elevated and default modes', () => {
  assert.equal(summarizeAccessibilityPrefs({}), 'حالت استاندارد');
  assert.equal(
    summarizeAccessibilityPrefs({ fontScale: 'large', highContrast: true }),
    'متن بزرگ (۱۱۸٪) · کنتراست بالا',
  );
  assert.equal(
    summarizeAccessibilityPrefs({
      fontScale: 'xlarge',
      boldText: true,
      reduceMotion: true,
    }),
    'متن خیلی درشت (۱۳۲٪) · متن ضخیم · کاهش انیمیشن',
  );
});
