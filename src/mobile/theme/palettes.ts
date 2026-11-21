export type CornerStyle = 'sharp' | 'curved';

export type ThemePaletteId =
  | 'niloofar_default'
  | 'emerald_atelier'
  | 'terracotta_sand'
  | 'nordic_indigo'
  | 'velvet_burgundy'
  | 'graphite_cobalt';

export interface UserAppearancePrefs {
  cornerStyle: CornerStyle;
  paletteId: ThemePaletteId;
}

export interface PaletteDefinition {
  id: ThemePaletteId;
  name: string;
  tagline: string;
  swatches: [string, string, string]; // [primary, secondary, surface]
  tokens: Record<string, string>;
  darkTokens: Record<string, string>;
}

export const DEFAULT_APPEARANCE_PREFS: UserAppearancePrefs = {
  cornerStyle: 'sharp',
  paletteId: 'niloofar_default',
};

const LIGHT_BASE_NEUTRALS: Record<string, string> = {
  '--color-surface-container-lowest': '#ffffff',
  '--color-surface-bright': '#fafbfd',
  '--color-on-background': '#1b2533',
  '--color-on-surface': '#1b2533',
  '--color-on-surface-variant': '#5b677a',
  '--color-outline': '#8d99ac',
  '--color-error': '#b84448',
  '--color-error-container': '#fdeeee',
  '--color-on-error': '#ffffff',
  '--color-on-error-container': '#8f2d31',
  '--color-tertiary': '#8f4a3c',
  '--color-tertiary-container': '#faece9',
  '--color-on-tertiary': '#ffffff',
  '--color-on-tertiary-container': '#73382c',
  '--color-inverse-surface': '#253142',
  '--color-inverse-on-surface': '#eef2f8',
};

const DARK_BASE_NEUTRALS: Record<string, string> = {
  '--color-surface': '#0e1420',
  '--color-background': '#0e1420',
  '--color-surface-dim': '#0a0f18',
  '--color-surface-bright': '#1b2538',
  '--color-surface-container-lowest': '#151e2e',
  '--color-surface-container-low': '#1c273b',
  '--color-surface-container': '#223047',
  '--color-surface-container-high': '#2a3a54',
  '--color-surface-container-highest': '#334563',
  '--color-surface-variant': '#25334a',
  '--color-on-background': '#edf2fa',
  '--color-on-surface': '#edf2fa',
  '--color-on-surface-variant': '#9fb0ca',
  '--color-outline': '#627491',
  '--color-outline-variant': '#2e3e57',
  '--color-error': '#f28b90',
  '--color-error-container': '#3b1c22',
  '--color-on-error': '#2a0b0e',
  '--color-on-error-container': '#ffd6d8',
  '--color-tertiary': '#e8a898',
  '--color-tertiary-container': '#3b241f',
  '--color-on-tertiary': '#2c1510',
  '--color-on-tertiary-container': '#ffd8ce',
  '--color-inverse-surface': '#e4ecf7',
  '--color-inverse-on-surface': '#172030',
  '--m-bg': '#0e1420',
  '--m-surface': '#151e2e',
  '--m-surface-2': '#1c273b',
  '--m-surface-3': '#24334c',
  '--m-on-surface': '#edf2fa',
  '--m-on-surface-muted': '#9fb0ca',
  '--m-on-surface-faint': '#7385a3',
  '--m-outline': 'rgba(148, 163, 184, 0.22)',
  '--m-outline-strong': 'rgba(148, 163, 184, 0.36)',
};

/**
 * 6 curated modern trend palettes — #1 preserves the exact current Niloofar color system as default.
 * Every palette includes full Light AND Dark surface/ink/accent tokens for crisp high-contrast dark mode.
 */
export const THEME_PALETTES: PaletteDefinition[] = [
  {
    id: 'niloofar_default',
    name: 'سرمه‌ای نیلوفر (اصلی)',
    tagline: 'پالت رسمی فعلی سامانه با کنتراست آرام',
    swatches: ['#3b5998', '#2b7a5e', '#f6f8fb'],
    tokens: {
      ...LIGHT_BASE_NEUTRALS,
      '--color-primary': '#3b5998',
      '--color-primary-container': '#e8eefb',
      '--color-on-primary': '#ffffff',
      '--color-on-primary-container': '#243b6b',
      '--color-secondary': '#2b7a5e',
      '--color-secondary-container': '#e7f5ef',
      '--color-on-secondary-container': '#1f5c46',
      '--color-surface': '#f6f8fb',
      '--color-background': '#f6f8fb',
      '--color-surface-container-low': '#f1f4f9',
      '--color-surface-container': '#e9eef6',
      '--color-surface-container-high': '#e1e8f3',
      '--color-outline-variant': '#d6dde8',
      '--bs-primary': '#3b5998',
      '--m-accent': '#3b5998',
      '--m-accent-strong': '#2c467c',
      '--m-accent-soft': '#e8eefb',
      '--m-btn-primary-bg': '#3b5998',
      '--m-btn-primary-hover-bg': '#314b82',
      '--m-primary-container': '#e8eefb',
      '--m-on-primary-container': '#243b6b',
    },
    darkTokens: {
      ...DARK_BASE_NEUTRALS,
      '--color-primary': '#7aa2f7',
      '--color-primary-container': '#1e3054',
      '--color-on-primary': '#0c162b',
      '--color-on-primary-container': '#dbe7ff',
      '--color-secondary': '#4fd1a5',
      '--color-secondary-container': '#15362c',
      '--color-on-secondary-container': '#b9f3dd',
      '--bs-primary': '#7aa2f7',
      '--m-accent': '#7aa2f7',
      '--m-accent-strong': '#9cbaff',
      '--m-accent-soft': '#1e3054',
      '--m-btn-primary-bg': '#4d76cc',
      '--m-btn-primary-hover-bg': '#5c85da',
      '--m-primary-container': '#1e3054',
      '--m-on-primary-container': '#dbe7ff',
    },
  },
  {
    id: 'emerald_atelier',
    name: 'زمردی آتلیه (Emerald)',
    tagline: 'سبز یشمی معماری با زمینه مهتابی خنک',
    swatches: ['#0f6b56', '#2563eb', '#f4f8f6'],
    tokens: {
      ...LIGHT_BASE_NEUTRALS,
      '--color-primary': '#0f6b56',
      '--color-primary-container': '#dff3ec',
      '--color-on-primary': '#ffffff',
      '--color-on-primary-container': '#0a4739',
      '--color-secondary': '#1d5fa8',
      '--color-secondary-container': '#e6f0fb',
      '--color-on-secondary-container': '#144378',
      '--color-surface': '#f4f8f6',
      '--color-background': '#f4f8f6',
      '--color-surface-container-low': '#edf4f1',
      '--color-surface-container': '#e3eee9',
      '--color-surface-container-high': '#d7e6e0',
      '--color-outline-variant': '#cddcd6',
      '--bs-primary': '#0f6b56',
      '--m-accent': '#0f6b56',
      '--m-accent-strong': '#0a4e3f',
      '--m-accent-soft': '#dff3ec',
      '--m-btn-primary-bg': '#0f6b56',
      '--m-btn-primary-hover-bg': '#0b5745',
      '--m-primary-container': '#dff3ec',
      '--m-on-primary-container': '#0a4739',
    },
    darkTokens: {
      ...DARK_BASE_NEUTRALS,
      '--color-surface': '#0c1614',
      '--color-background': '#0c1614',
      '--color-surface-container-lowest': '#12211e',
      '--color-surface-container-low': '#182b27',
      '--color-surface-container': '#1f3631',
      '--color-surface-container-high': '#27423c',
      '--color-outline-variant': '#2a4740',
      '--color-primary': '#34d399',
      '--color-primary-container': '#12382c',
      '--color-on-primary': '#06241a',
      '--color-on-primary-container': '#c8fae6',
      '--color-secondary': '#60a5fa',
      '--color-secondary-container': '#172f4d',
      '--color-on-secondary-container': '#cfe4ff',
      '--bs-primary': '#34d399',
      '--m-bg': '#0c1614',
      '--m-surface': '#12211e',
      '--m-surface-2': '#182b27',
      '--m-surface-3': '#1f3631',
      '--m-accent': '#34d399',
      '--m-accent-strong': '#6ee7b7',
      '--m-accent-soft': '#12382c',
      '--m-btn-primary-bg': '#15805d',
      '--m-btn-primary-hover-bg': '#1a966e',
      '--m-primary-container': '#12382c',
      '--m-on-primary-container': '#c8fae6',
    },
  },
  {
    id: 'terracotta_sand',
    name: 'تراکوتا و شن گرم (Warm)',
    tagline: 'آجری گرم مدرن و بژ کاغذی مینیمال',
    swatches: ['#b3532c', '#2c6e58', '#faf7f4'],
    tokens: {
      ...LIGHT_BASE_NEUTRALS,
      '--color-primary': '#b3532c',
      '--color-primary-container': '#f9eae2',
      '--color-on-primary': '#ffffff',
      '--color-on-primary-container': '#7b3418',
      '--color-secondary': '#2c6e58',
      '--color-secondary-container': '#e6f4ee',
      '--color-on-secondary-container': '#1e503f',
      '--color-surface': '#faf7f4',
      '--color-background': '#faf7f4',
      '--color-surface-container-low': '#f4efe9',
      '--color-surface-container': '#ece5dd',
      '--color-surface-container-high': '#e3d9cf',
      '--color-outline-variant': '#dcd0c4',
      '--bs-primary': '#b3532c',
      '--m-accent': '#b3532c',
      '--m-accent-strong': '#8f3f1e',
      '--m-accent-soft': '#f9eae2',
      '--m-btn-primary-bg': '#b3532c',
      '--m-btn-primary-hover-bg': '#974422',
      '--m-primary-container': '#f9eae2',
      '--m-on-primary-container': '#7b3418',
    },
    darkTokens: {
      ...DARK_BASE_NEUTRALS,
      '--color-surface': '#171311',
      '--color-background': '#171311',
      '--color-surface-container-lowest': '#211b18',
      '--color-surface-container-low': '#2a221e',
      '--color-surface-container': '#342a25',
      '--color-surface-container-high': '#40342e',
      '--color-outline-variant': '#473932',
      '--color-on-surface': '#f6efe9',
      '--color-on-surface-variant': '#c4b5a9',
      '--color-primary': '#f09468',
      '--color-primary-container': '#472518',
      '--color-on-primary': '#291006',
      '--color-on-primary-container': '#ffe2d4',
      '--color-secondary': '#57c7a0',
      '--color-secondary-container': '#17362c',
      '--color-on-secondary-container': '#c5f5e3',
      '--bs-primary': '#f09468',
      '--m-bg': '#171311',
      '--m-surface': '#211b18',
      '--m-surface-2': '#2a221e',
      '--m-surface-3': '#342a25',
      '--m-on-surface': '#f6efe9',
      '--m-on-surface-muted': '#c4b5a9',
      '--m-accent': '#f09468',
      '--m-accent-strong': '#f7b290',
      '--m-accent-soft': '#472518',
      '--m-btn-primary-bg': '#c76238',
      '--m-btn-primary-hover-bg': '#da7348',
      '--m-primary-container': '#472518',
      '--m-on-primary-container': '#ffe2d4',
    },
  },
  {
    id: 'nordic_indigo',
    name: 'نیلی نوردیک (Nordic)',
    tagline: 'بنفش-نیلی اسکاندیناوی با توناژ تیز و خوانا',
    swatches: ['#46439e', '#0d7a6c', '#f6f6fc'],
    tokens: {
      ...LIGHT_BASE_NEUTRALS,
      '--color-primary': '#46439e',
      '--color-primary-container': '#ebeafc',
      '--color-on-primary': '#ffffff',
      '--color-on-primary-container': '#2d2b70',
      '--color-secondary': '#0d7a6c',
      '--color-secondary-container': '#e2f5f2',
      '--color-on-secondary-container': '#09594e',
      '--color-surface': '#f6f6fc',
      '--color-background': '#f6f6fc',
      '--color-surface-container-low': '#efeff9',
      '--color-surface-container': '#e6e6f5',
      '--color-surface-container-high': '#dcdcf0',
      '--color-outline-variant': '#d2d2e8',
      '--bs-primary': '#46439e',
      '--m-accent': '#46439e',
      '--m-accent-strong': '#33307c',
      '--m-accent-soft': '#ebeafc',
      '--m-btn-primary-bg': '#46439e',
      '--m-btn-primary-hover-bg': '#393687',
      '--m-primary-container': '#ebeafc',
      '--m-on-primary-container': '#2d2b70',
    },
    darkTokens: {
      ...DARK_BASE_NEUTRALS,
      '--color-surface': '#101120',
      '--color-background': '#101120',
      '--color-surface-container-lowest': '#17192d',
      '--color-surface-container-low': '#20223b',
      '--color-surface-container': '#282b4a',
      '--color-surface-container-high': '#32365c',
      '--color-outline-variant': '#363b63',
      '--color-primary': '#9fa0ff',
      '--color-primary-container': '#28275e',
      '--color-on-primary': '#121138',
      '--color-on-primary-container': '#e6e6ff',
      '--color-secondary': '#3dd4be',
      '--color-secondary-container': '#123834',
      '--color-on-secondary-container': '#bdf7ee',
      '--bs-primary': '#9fa0ff',
      '--m-bg': '#101120',
      '--m-surface': '#17192d',
      '--m-surface-2': '#20223b',
      '--m-surface-3': '#282b4a',
      '--m-accent': '#9fa0ff',
      '--m-accent-strong': '#bcbdff',
      '--m-accent-soft': '#28275e',
      '--m-btn-primary-bg': '#5d5ac2',
      '--m-btn-primary-hover-bg': '#6f6cd4',
      '--m-primary-container': '#28275e',
      '--m-on-primary-container': '#e6e6ff',
    },
  },
  {
    id: 'velvet_burgundy',
    name: 'زرشکی مخملی (Burgundy)',
    tagline: 'شرابی اصیل و خنثی‌های مرمری لوکس',
    swatches: ['#7d2e4a', '#266d5c', '#faf6f8'],
    tokens: {
      ...LIGHT_BASE_NEUTRALS,
      '--color-primary': '#7d2e4a',
      '--color-primary-container': '#f7e6ec',
      '--color-on-primary': '#ffffff',
      '--color-on-primary-container': '#571c31',
      '--color-secondary': '#266d5c',
      '--color-secondary-container': '#e5f4f0',
      '--color-on-secondary-container': '#1a5043',
      '--color-surface': '#faf6f8',
      '--color-background': '#faf6f8',
      '--color-surface-container-low': '#f4edf0',
      '--color-surface-container': '#ece2e6',
      '--color-surface-container-high': '#e3d6dc',
      '--color-outline-variant': '#dbcad2',
      '--bs-primary': '#7d2e4a',
      '--m-accent': '#7d2e4a',
      '--m-accent-strong': '#5e2036',
      '--m-accent-soft': '#f7e6ec',
      '--m-btn-primary-bg': '#7d2e4a',
      '--m-btn-primary-hover-bg': '#66243b',
      '--m-primary-container': '#f7e6ec',
      '--m-on-primary-container': '#571c31',
    },
    darkTokens: {
      ...DARK_BASE_NEUTRALS,
      '--color-surface': '#181116',
      '--color-background': '#181116',
      '--color-surface-container-lowest': '#22181f',
      '--color-surface-container-low': '#2c2028',
      '--color-surface-container': '#372832',
      '--color-surface-container-high': '#43313d',
      '--color-outline-variant': '#4c3845',
      '--color-on-surface': '#f7edf2',
      '--color-on-surface-variant': '#c4aeb9',
      '--color-primary': '#f08db0',
      '--color-primary-container': '#4a1d2f',
      '--color-on-primary': '#2d0b18',
      '--color-on-primary-container': '#ffdce8',
      '--color-secondary': '#4fd1b0',
      '--color-secondary-container': '#153830',
      '--color-on-secondary-container': '#c0f5e6',
      '--bs-primary': '#f08db0',
      '--m-bg': '#181116',
      '--m-surface': '#22181f',
      '--m-surface-2': '#2c2028',
      '--m-surface-3': '#372832',
      '--m-on-surface': '#f7edf2',
      '--m-on-surface-muted': '#c4aeb9',
      '--m-accent': '#f08db0',
      '--m-accent-strong': '#f7adc7',
      '--m-accent-soft': '#4a1d2f',
      '--m-btn-primary-bg': '#9e3e60',
      '--m-btn-primary-hover-bg': '#b54b70',
      '--m-primary-container': '#4a1d2f',
      '--m-on-primary-container': '#ffdce8',
    },
  },
  {
    id: 'graphite_cobalt',
    name: 'کبالت و گرافیت (Cobalt)',
    tagline: 'آبی کبالت مهندسی با خاکستری صنعتی مدرن',
    swatches: ['#1d4ed8', '#0e7490', '#f5f7fa'],
    tokens: {
      ...LIGHT_BASE_NEUTRALS,
      '--color-primary': '#1d4ed8',
      '--color-primary-container': '#e5edff',
      '--color-on-primary': '#ffffff',
      '--color-on-primary-container': '#16389c',
      '--color-secondary': '#0e7490',
      '--color-secondary-container': '#e2f4f8',
      '--color-on-secondary-container': '#0a5469',
      '--color-surface': '#f5f7fa',
      '--color-background': '#f5f7fa',
      '--color-surface-container-low': '#edf1f6',
      '--color-surface-container': '#e4eaf2',
      '--color-surface-container-high': '#dae2ec',
      '--color-outline-variant': '#ced7e4',
      '--bs-primary': '#1d4ed8',
      '--m-accent': '#1d4ed8',
      '--m-accent-strong': '#153ba8',
      '--m-accent-soft': '#e5edff',
      '--m-btn-primary-bg': '#1d4ed8',
      '--m-btn-primary-hover-bg': '#1740b5',
      '--m-primary-container': '#e5edff',
      '--m-on-primary-container': '#16389c',
    },
    darkTokens: {
      ...DARK_BASE_NEUTRALS,
      '--color-surface': '#0d1117',
      '--color-background': '#0d1117',
      '--color-surface-container-lowest': '#141a23',
      '--color-surface-container-low': '#1b2330',
      '--color-surface-container': '#222c3c',
      '--color-surface-container-high': '#2a364a',
      '--color-outline-variant': '#303e54',
      '--color-primary': '#60a5fa',
      '--color-primary-container': '#162d54',
      '--color-on-primary': '#091b38',
      '--color-on-primary-container': '#d8e9ff',
      '--color-secondary': '#38bdf8',
      '--color-secondary-container': '#103142',
      '--color-on-secondary-container': '#c8eefc',
      '--bs-primary': '#60a5fa',
      '--m-bg': '#0d1117',
      '--m-surface': '#141a23',
      '--m-surface-2': '#1b2330',
      '--m-surface-3': '#222c3c',
      '--m-accent': '#60a5fa',
      '--m-accent-strong': '#93c5fd',
      '--m-accent-soft': '#162d54',
      '--m-btn-primary-bg': '#2563eb',
      '--m-btn-primary-hover-bg': '#3b82f6',
      '--m-primary-container': '#162d54',
      '--m-on-primary-container': '#d8e9ff',
    },
  },
];

export const PALETTE_BY_ID: Record<ThemePaletteId, PaletteDefinition> = Object.fromEntries(
  THEME_PALETTES.map((p) => [p.id, p]),
) as Record<ThemePaletteId, PaletteDefinition>;

let lastAppliedPrefs: UserAppearancePrefs = { ...DEFAULT_APPEARANCE_PREFS };

export function applyAppearancePrefs(
  prefs: Partial<UserAppearancePrefs> | null | undefined,
  explicitDark?: boolean,
): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const cornerStyle: CornerStyle = prefs?.cornerStyle === 'curved' ? 'curved' : 'sharp';
  const paletteId: ThemePaletteId =
    prefs?.paletteId && PALETTE_BY_ID[prefs.paletteId]
      ? prefs.paletteId
      : 'niloofar_default';

  lastAppliedPrefs = { cornerStyle, paletteId };

  const isDark =
    typeof explicitDark === 'boolean'
      ? explicitDark
      : root.getAttribute('data-theme') === 'dark' || root.classList.contains('app-skin-dark');

  root.setAttribute('data-corner-style', cornerStyle);
  root.setAttribute('data-palette', paletteId);
  root.style.colorScheme = isDark ? 'dark' : 'light';

  // Sharp = crisp 2px angular corners for cards & buttons; Curved = soft 16px/12px.
  // NOTE: Digikala floating dock (.dk-dock-*) is intentionally unaffected!
  root.style.setProperty('--ui-card-radius', cornerStyle === 'curved' ? '16px' : '2px');
  root.style.setProperty('--ui-btn-radius', cornerStyle === 'curved' ? '12px' : '2px');

  const palette = PALETTE_BY_ID[paletteId];
  const tokenMap = isDark ? palette.darkTokens : palette.tokens;
  for (const [k, v] of Object.entries(tokenMap)) {
    root.style.setProperty(k, v);
  }
}

export function reapplyAppearanceForTheme(isDark: boolean): void {
  applyAppearancePrefs(lastAppliedPrefs, isDark);
}
