export type CornerStyle = 'sharp' | 'curved';

export type ThemePaletteId =
  | 'niloofar_default'
  | 'emerald_atelier'
  | 'terracotta_sand'
  | 'nordic_indigo'
  | 'velvet_burgundy'
  | 'graphite_cobalt';

export type FontScaleMode = 'normal' | 'large' | 'xlarge';

export interface AccessibilityPrefs {
  fontScale: FontScaleMode;
  highContrast: boolean;
  boldText: boolean;
  reduceMotion: boolean;
}

export interface UserAppearancePrefs extends AccessibilityPrefs {
  cornerStyle: CornerStyle;
  paletteId: ThemePaletteId;
}

export const VALID_THEME_PALETTE_IDS: readonly ThemePaletteId[] = [
  'niloofar_default',
  'emerald_atelier',
  'terracotta_sand',
  'nordic_indigo',
  'velvet_burgundy',
  'graphite_cobalt',
] as const;

export const VALID_FONT_SCALES: readonly FontScaleMode[] = ['normal', 'large', 'xlarge'] as const;

export const DEFAULT_ACCESSIBILITY_PREFS: AccessibilityPrefs = {
  fontScale: 'normal',
  highContrast: false,
  boldText: false,
  reduceMotion: false,
};

export const DEFAULT_USER_APPEARANCE_PREFS: UserAppearancePrefs = {
  cornerStyle: 'curved',
  paletteId: 'niloofar_default',
  ...DEFAULT_ACCESSIBILITY_PREFS,
};

export interface FontScaleOptionSpec {
  id: FontScaleMode;
  label: string;
  shortLabel: string;
  percentLabel: string;
  multiplier: number;
  touchMinPx: number;
  description: string;
}

export const FONT_SCALE_OPTIONS: FontScaleOptionSpec[] = [
  {
    id: 'normal',
    label: 'استاندارد (۱۰۰٪)',
    shortLabel: 'معمولی',
    percentLabel: '۱۰۰٪',
    multiplier: 1,
    touchMinPx: 44,
    description: 'اندازه پیش‌فرض و فشرده برای صفحه موبایل',
  },
  {
    id: 'large',
    label: 'بزرگ • پیرچشمی (۱۱۸٪)',
    shortLabel: 'بزرگ / پیرچشمی',
    percentLabel: '۱۱۸٪',
    multiplier: 1.18,
    touchMinPx: 48,
    description: 'مناسب مطالعه راحت‌تر بدون نیاز به عینک مطالعه',
  },
  {
    id: 'xlarge',
    label: 'خیلی درشت (۱۳۲٪)',
    shortLabel: 'خیلی درشت',
    percentLabel: '۱۳۲٪',
    multiplier: 1.32,
    touchMinPx: 52,
    description: 'بیشترین درشت‌نمایی متون، اعداد، مبالغ و دکمه‌ها',
  },
];

export function isValidFontScale(value: unknown): value is FontScaleMode {
  return typeof value === 'string' && (VALID_FONT_SCALES as readonly string[]).includes(value);
}

export function isValidPaletteId(value: unknown): value is ThemePaletteId {
  return typeof value === 'string' && (VALID_THEME_PALETTE_IDS as readonly string[]).includes(value);
}

/**
 * Pure normalization/merge helper used by both client UI and server PATCH /me/preferences.
 */
export function normalizeUserAppearancePrefs(
  raw?: Partial<UserAppearancePrefs> | null,
  fallback?: Partial<UserAppearancePrefs> | null,
): UserAppearancePrefs {
  const base = fallback ?? {};
  const cornerStyle: CornerStyle =
    raw?.cornerStyle === 'sharp' || raw?.cornerStyle === 'curved'
      ? raw.cornerStyle
      : base.cornerStyle === 'sharp'
        ? 'sharp'
        : 'curved';

  const paletteId: ThemePaletteId = isValidPaletteId(raw?.paletteId)
    ? raw.paletteId
    : isValidPaletteId(base.paletteId)
      ? base.paletteId
      : 'niloofar_default';

  const fontScale: FontScaleMode = isValidFontScale(raw?.fontScale)
    ? raw.fontScale
    : isValidFontScale(base.fontScale)
      ? base.fontScale
      : 'normal';

  const highContrast =
    typeof raw?.highContrast === 'boolean' ? raw.highContrast : Boolean(base.highContrast);

  const boldText = typeof raw?.boldText === 'boolean' ? raw.boldText : Boolean(base.boldText);

  const reduceMotion =
    typeof raw?.reduceMotion === 'boolean' ? raw.reduceMotion : Boolean(base.reduceMotion);

  return {
    cornerStyle,
    paletteId,
    fontScale,
    highContrast,
    boldText,
    reduceMotion,
  };
}

export function getFontScaleSpec(scale: FontScaleMode): FontScaleOptionSpec {
  return FONT_SCALE_OPTIONS.find((opt) => opt.id === scale) ?? FONT_SCALE_OPTIONS[0];
}

export function computeAccessibilityAttributes(prefs: Partial<AccessibilityPrefs> | null | undefined): {
  attributes: {
    'data-font-scale': FontScaleMode;
    'data-high-contrast': 'true' | 'false';
    'data-bold-text': 'true' | 'false';
    'data-reduce-motion': 'true' | 'false';
  };
  cssVars: {
    '--ui-font-mult': string;
    '--ui-touch-min': string;
    '--ui-body-weight': string;
    '--ui-root-font-size': string;
  };
  hasElevatedAccessibility: boolean;
} {
  const fontScale: FontScaleMode = isValidFontScale(prefs?.fontScale) ? prefs.fontScale : 'normal';
  const highContrast = Boolean(prefs?.highContrast);
  const boldText = Boolean(prefs?.boldText);
  const reduceMotion = Boolean(prefs?.reduceMotion);
  const spec = getFontScaleSpec(fontScale);

  const rootPx = Number((14 * spec.multiplier).toFixed(2));

  return {
    attributes: {
      'data-font-scale': fontScale,
      'data-high-contrast': highContrast ? 'true' : 'false',
      'data-bold-text': boldText ? 'true' : 'false',
      'data-reduce-motion': reduceMotion ? 'true' : 'false',
    },
    cssVars: {
      '--ui-font-mult': String(spec.multiplier),
      '--ui-touch-min': `${spec.touchMinPx}px`,
      '--ui-body-weight': boldText ? '600' : '400',
      '--ui-root-font-size': `${rootPx}px`,
    },
    hasElevatedAccessibility: fontScale !== 'normal' || highContrast || boldText || reduceMotion,
  };
}

export function summarizeAccessibilityPrefs(prefs: Partial<AccessibilityPrefs> | null | undefined): string {
  const scale = isValidFontScale(prefs?.fontScale) ? prefs.fontScale : 'normal';
  const parts: string[] = [];
  if (scale === 'large') parts.push('متن بزرگ (۱۱۸٪)');
  else if (scale === 'xlarge') parts.push('متن خیلی درشت (۱۳۲٪)');
  if (prefs?.highContrast) parts.push('کنتراست بالا');
  if (prefs?.boldText) parts.push('متن ضخیم');
  if (prefs?.reduceMotion) parts.push('کاهش انیمیشن');
  return parts.length > 0 ? parts.join(' · ') : 'حالت استاندارد';
}
