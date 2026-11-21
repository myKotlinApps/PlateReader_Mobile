import React, { useEffect, useMemo, useRef, useState } from 'react';

export type IranPlateKind =
  | 'personal'
  | 'taxi'
  | 'public'
  | 'agriculture'
  | 'government'
  | 'police'
  | 'irgc'
  | 'military_hq'
  | 'army'
  | 'diplomatic'
  | 'disabled'
  | 'temporary'
  | 'freezone'
  | 'motorcycle';

export interface IranPlateStyleMeta {
  kind: IranPlateKind;
  label: string;
  shortLabel: string;
  bg: string;
  fg: string;
  border: string;
  stripBg?: string;
  letters: string[];
  layout: 'national' | 'temporary' | 'freezone' | 'motorcycle';
  description: string;
}

export const FREE_ZONES = [
  { id: 'kish', name: 'کیش', en: 'KISH', code: '۱۱', accent: '#0f766e' },
  { id: 'aras', name: 'ارس', en: 'ARAS', code: '۳۳', accent: '#1d4ed8' },
  { id: 'anzali', name: 'انزلی', en: 'ANZALI', code: '۴۴', accent: '#0369a1' },
  { id: 'qeshm', name: 'قشم', en: 'QESHM', code: '۲۲', accent: '#0e7490' },
  { id: 'arvand', name: 'اروند', en: 'ARVAND', code: '۵۵', accent: '#b45309' },
  { id: 'chabahar', name: 'چابهار', en: 'CHABAHAR', code: '۶۶', accent: '#4338ca' },
  { id: 'maku', name: 'ماکو', en: 'MAKU', code: '۷۷', accent: '#475569' },
] as const;

export const PERSONAL_LETTERS = [
  'ب',
  'ج',
  'د',
  'س',
  'ص',
  'ط',
  'ق',
  'ل',
  'م',
  'ن',
  'و',
  'هـ',
  'ی',
];

export const IRAN_PLATE_CATALOG: Record<IranPlateKind, IranPlateStyleMeta> = {
  personal: {
    kind: 'personal',
    label: 'شخصی (ملی سفید)',
    shortLabel: 'شخصی',
    bg: '#ffffff',
    fg: '#111827',
    border: '#1f2937',
    letters: PERSONAL_LETTERS,
    layout: 'national',
    description: 'خودروهای سواری شخصی و ملکی',
  },
  taxi: {
    kind: 'taxi',
    label: 'تاکسی (زرد)',
    shortLabel: 'تاکسی',
    bg: '#f7c926',
    fg: '#111827',
    border: '#1f2937',
    letters: ['ت'],
    layout: 'national',
    description: 'تاکسی‌های شهری و فرودگاهی',
  },
  public: {
    kind: 'public',
    label: 'عمومی بار و مسافر (زرد)',
    shortLabel: 'عمومی',
    bg: '#f7c926',
    fg: '#111827',
    border: '#1f2937',
    letters: ['ع'],
    layout: 'national',
    description: 'اتوبوس، وانت بار و حمل‌ونقل عمومی',
  },
  agriculture: {
    kind: 'agriculture',
    label: 'کشاورزی (زرد)',
    shortLabel: 'کشاورزی',
    bg: '#f7c926',
    fg: '#111827',
    border: '#1f2937',
    letters: ['ک'],
    layout: 'national',
    description: 'ماشین‌آلات و ادوات کشاورزی',
  },
  government: {
    kind: 'government',
    label: 'دولتی (قرمز)',
    shortLabel: 'دولتی',
    bg: '#c8232c',
    fg: '#ffffff',
    border: '#7f1d1d',
    letters: ['الف'],
    layout: 'national',
    description: 'خودروهای دستگاه‌ها و سازمان‌های دولتی',
  },
  police: {
    kind: 'police',
    label: 'انتظامی / فراجا (سبز)',
    shortLabel: 'انتظامی',
    bg: '#185a37',
    fg: '#ffffff',
    border: '#0f3d25',
    letters: ['پ'],
    layout: 'national',
    description: 'خودروهای پلیس و نیروی انتظامی',
  },
  irgc: {
    kind: 'irgc',
    label: 'سپاه پاسداران (سبز)',
    shortLabel: 'سپاه',
    bg: '#185a37',
    fg: '#ffffff',
    border: '#0f3d25',
    letters: ['ث'],
    layout: 'national',
    description: 'خودروهای سپاه پاسداران انقلاب اسلامی',
  },
  military_hq: {
    kind: 'military_hq',
    label: 'ستاد کل / وزارت دفاع (آبی تیره)',
    shortLabel: 'نیروهای مسلح',
    bg: '#1d3c78',
    fg: '#ffffff',
    border: '#13274f',
    letters: ['ف', 'ز'],
    layout: 'national',
    description: 'ستاد کل (ف) و وزارت دفاع (ز)',
  },
  army: {
    kind: 'army',
    label: 'ارتش (کرم خاکی)',
    shortLabel: 'ارتش',
    bg: '#dcc9a3',
    fg: '#1f2937',
    border: '#7c6a46',
    letters: ['ش'],
    layout: 'national',
    description: 'خودروهای ارتش جمهوری اسلامی ایران',
  },
  diplomatic: {
    kind: 'diplomatic',
    label: 'دیپلماتیک و سرویس (آبی روشن)',
    shortLabel: 'سیاسی',
    bg: '#6cbce8',
    fg: '#111827',
    border: '#1e3a5f',
    letters: ['D', 'S'],
    layout: 'national',
    description: 'سفارتخانه‌ها (D) و کادر اداری (S)',
  },
  disabled: {
    kind: 'disabled',
    label: 'جانبازان و معلولین (نشان ویلچر)',
    shortLabel: 'ویلچر',
    bg: '#ffffff',
    fg: '#111827',
    border: '#1f2937',
    letters: ['ژ'],
    layout: 'national',
    description: 'خودروهای ویژه جانبازان و توان‌یابان',
  },
  temporary: {
    kind: 'temporary',
    label: 'گذر موقت (حرف گ + تاریخ)',
    shortLabel: 'گذر موقت',
    bg: '#ffffff',
    fg: '#111827',
    border: '#1f2937',
    letters: ['گ'],
    layout: 'temporary',
    description: 'خودروهای وارداتی با اعتبار ماه/سال',
  },
  freezone: {
    kind: 'freezone',
    label: 'مناطق آزاد تجاری',
    shortLabel: 'منطقه آزاد',
    bg: '#ffffff',
    fg: '#111827',
    border: '#1f2937',
    letters: [],
    layout: 'freezone',
    description: 'کیش، ارس، انزلی، قشم، اروند، چابهار، ماکو',
  },
  motorcycle: {
    kind: 'motorcycle',
    label: 'موتورسیکلت (دوردیفه)',
    shortLabel: 'موتورسیکلت',
    bg: '#ffffff',
    fg: '#111827',
    border: '#1f2937',
    letters: [],
    layout: 'motorcycle',
    description: 'پلاک دوردیفه ۳ رقم بالا + ۵ رقم پایین',
  },
};

export const PLATE_KIND_ORDER: IranPlateKind[] = [
  'personal',
  'taxi',
  'public',
  'disabled',
  'government',
  'police',
  'irgc',
  'army',
  'military_hq',
  'diplomatic',
  'temporary',
  'freezone',
  'motorcycle',
  'agriculture',
];

export interface ParsedIranPlate {
  kind: IranPlateKind;
  /** Standard national: 2 digits left */
  left2: string;
  /** Standard national: Persian/Latin letter */
  letter: string;
  /** Standard national: 3 digits middle */
  right3: string;
  /** Standard national: 2 digits province code OR temporary MM/YY */
  iran2: string;
  /** Motorcycle top 3 digits */
  motoTop3: string;
  /** Motorcycle bottom 5 digits */
  motoBottom5: string;
  /** Freezone id & 5-digit number & 2-digit zone code */
  zoneId: string;
  zoneNum5: string;
  zoneCode2: string;
}

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function toLatinDigits(str: string): string {
  return String(str || '')
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));
}

export function toPersianDigits(str: string): string {
  return String(str || '').replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)] ?? d);
}

export function detectKindFromLetter(rawLetter: string): IranPlateKind {
  const l = rawLetter.trim().toUpperCase();
  if (l === 'ت') return 'taxi';
  if (l === 'ع') return 'public';
  if (l === 'ک' || l === 'ك') return 'agriculture';
  if (l === 'الف' || l === 'ا') return 'government';
  if (l === 'پ') return 'police';
  if (l === 'ث') return 'irgc';
  if (l === 'ف' || l === 'ز') return 'military_hq';
  if (l === 'ش') return 'army';
  if (l === 'D' || l === 'S') return 'diplomatic';
  if (l === 'ژ' || l === '♿') return 'disabled';
  if (l === 'گ') return 'temporary';
  return 'personal';
}

export function createEmptyPlate(kind: IranPlateKind = 'personal'): ParsedIranPlate {
  const meta = IRAN_PLATE_CATALOG[kind];
  return {
    kind,
    left2: '',
    letter: meta.letters[0] ?? 'ب',
    right3: '',
    iran2: kind === 'temporary' ? '۰۵/۰۹' : '۱۱',
    motoTop3: '',
    motoBottom5: '',
    zoneId: 'kish',
    zoneNum5: '',
    zoneCode2: '۱۱',
  };
}

export function parseIranPlate(raw: string): ParsedIranPlate | null {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  const normalized = toLatinDigits(trimmed).replace(/ي/g, 'ی').replace(/ك/g, 'ک');

  // 1. Motorcycle detection: "موتور 543-87219" or "543 / 87219"
  if (normalized.includes('موتور') || /^\d{3}\s*[-/]\s*\d{5}$/.test(normalized)) {
    const m = normalized.match(/(\d{3})\D+(\d{5})/);
    if (m) {
      return {
        ...createEmptyPlate('motorcycle'),
        motoTop3: m[1],
        motoBottom5: m[2],
      };
    }
  }

  // 2. Free zone detection: "منطقه آزاد کیش 48210 - 11" or "کیش 48210-11"
  const matchedZone = FREE_ZONES.find(
    (z) => normalized.includes(z.name) || normalized.toUpperCase().includes(z.en),
  );
  if (matchedZone || normalized.includes('منطقه آزاد')) {
    const nums = normalized.match(/\d+/g) ?? [];
    const zoneNum5 = (nums.find((n) => n.length >= 4) || nums[0] || '').slice(0, 5);
    const zoneCode2 = (nums.find((n) => n.length === 2) || matchedZone?.code || '11').slice(0, 2);
    return {
      ...createEmptyPlate('freezone'),
      zoneId: matchedZone?.id || 'kish',
      zoneNum5,
      zoneCode2,
    };
  }

  // 3. Temporary transit detection: "12 گ 345 - 04/05"
  const tempMatch = normalized.match(/(\d{2})\s*گ\s*(\d{3})(?:\D+(\d{2}\s*\/\s*\d{2}))?/);
  if (tempMatch) {
    return {
      ...createEmptyPlate('temporary'),
      left2: tempMatch[1],
      letter: 'گ',
      right3: tempMatch[2],
      iran2: (tempMatch[3] || '05/09').replace(/\s+/g, ''),
    };
  }

  // 4. Standard Iranian National Plate: "12 ب 345 - ایران 11", "68ب742-21", "12الف345-11", "23 D 412 - 11"
  const natMatch = normalized.match(
    /(\d{2})\s*(الف|هـ|ه|[بجدرسصطقفلمنوهیپتثزژشکعگ]|D|S|d|s)\s*(\d{3})(?:\D*(?:ایران)?\D*(\d{2}))?/,
  );
  if (natMatch) {
    const rawLetter = natMatch[2] === 'ه' ? 'هـ' : natMatch[2].toUpperCase();
    const kind = detectKindFromLetter(rawLetter);
    return {
      ...createEmptyPlate(kind),
      left2: natMatch[1],
      letter: rawLetter,
      right3: natMatch[3],
      iran2: natMatch[4] || '11',
    };
  }

  return null;
}

export function formatIranPlate(p: ParsedIranPlate): string {
  if (p.kind === 'motorcycle') {
    if (!p.motoTop3 && !p.motoBottom5) return '';
    return toPersianDigits(`موتور ${p.motoTop3 || '---'}-${p.motoBottom5 || '-----'}`);
  }
  if (p.kind === 'freezone') {
    if (!p.zoneNum5) return '';
    const z = FREE_ZONES.find((item) => item.id === p.zoneId) ?? FREE_ZONES[0];
    return toPersianDigits(`منطقه آزاد ${z.name} ${p.zoneNum5} - ${p.zoneCode2 || z.code}`);
  }
  if (p.kind === 'temporary') {
    if (!p.left2 && !p.right3) return '';
    return toPersianDigits(`${p.left2 || '--'} گ ${p.right3 || '---'} - ${p.iran2 || '05/09'}`);
  }
  if (!p.left2 && !p.right3) return '';
  return toPersianDigits(
    `${p.left2 || '--'} ${p.letter || 'ب'} ${p.right3 || '---'} - ایران ${p.iran2 || '11'}`,
  );
}

/** Miniature authentic Iranian flag (3 horizontal stripes + central emblem dot) */
const MiniIranFlag: React.FC<{ compact?: boolean }> = ({ compact }) => (
  <span
    className={`inline-flex flex-col overflow-hidden rounded-[1.5px] border border-white/25 shrink-0 ${
      compact ? 'w-[11px] h-[7px]' : 'w-[15px] h-[10px]'
    }`}
    aria-hidden="true"
  >
    <span className="flex-1 bg-[#239f40]" />
    <span className="flex-1 bg-white flex items-center justify-center">
      <span className="w-[2.5px] h-[2.5px] rounded-full bg-[#da0000]" />
    </span>
    <span className="flex-1 bg-[#da0000]" />
  </span>
);

/** Miniature wheelchair glyph for Disabled (ژ) plates */
const WheelchairIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-label="جانبازان و معلولین">
    <circle cx="12" cy="4.5" r="2" />
    <path d="M12.5 8.5h-2v5.5h5.2l1.8 4.2 1.8-.8-2.3-5.4h-4.5V8.5z" />
    <path d="M10.5 19a4.5 4.5 0 1 1-3.8-6.9l-.9-1.8A6.5 6.5 0 1 0 16 19.3l-1.4-1.4A4.48 4.48 0 0 1 10.5 19z" />
  </svg>
);

/**
 * Authentic Iranian License Plate Visual Component.
 * Automatically parses any plate string and renders the exact real-world Iranian template.
 */
export const IranPlateBadge: React.FC<{
  value?: string | null;
  size?: 'sm' | 'md' | 'lg';
  showTypeLabel?: boolean;
  className?: string;
}> = ({ value, size = 'sm', showTypeLabel = false, className = '' }) => {
  const parsed = useMemo(() => (value ? parseIranPlate(value) : null), [value]);

  if (!value || !parsed) {
    return (
      <span className={`text-[12.5px] text-on-surface-variant font-numeric-stat ${className}`}>
        {value || 'بدون پلاک'}
      </span>
    );
  }

  const meta = IRAN_PLATE_CATALOG[parsed.kind];

  // Motorcycle 2-row compact plate
  if (parsed.kind === 'motorcycle') {
    const boxSize =
      size === 'lg'
        ? 'min-w-[116px] text-[15px]'
        : size === 'md'
          ? 'min-w-[96px] text-[13px]'
          : 'min-w-[80px] text-[11.5px]';
    return (
      <span className={`inline-flex items-center gap-1.5 ${className}`}>
        <span
          dir="ltr"
          className={`inline-flex items-stretch rounded-[6px] overflow-hidden border-[1.5px] shadow-[0_1px_2px_rgba(15,23,42,0.12)] font-numeric-stat select-none ${boxSize}`}
          style={{ backgroundColor: meta.bg, color: meta.fg, borderColor: meta.border }}
        >
          <span className="bg-[#0e4aa6] text-white px-1 py-1 flex flex-col items-center justify-between gap-0.5 shrink-0">
            <MiniIranFlag compact={size === 'sm'} />
            <span className="text-[5.5px] font-bold leading-none tracking-tight">IR</span>
          </span>
          <span className="flex-1 flex flex-col items-center justify-center px-1.5 py-0.5 leading-tight font-extrabold">
            <span className="tracking-wider">{toPersianDigits(parsed.motoTop3)}</span>
            <span className="w-full h-px bg-slate-300 my-0.5" />
            <span className="tracking-wider">{toPersianDigits(parsed.motoBottom5)}</span>
          </span>
        </span>
        {showTypeLabel && (
          <span className="text-[11px] text-on-surface-variant">{meta.shortLabel}</span>
        )}
      </span>
    );
  }

  // Free Trade Zone Plate
  if (parsed.kind === 'freezone') {
    const zone = FREE_ZONES.find((z) => z.id === parsed.zoneId) ?? FREE_ZONES[0];
    const hCls =
      size === 'lg'
        ? 'h-[40px] text-[16px]'
        : size === 'md'
          ? 'h-[32px] text-[14px]'
          : 'h-[26px] text-[12px]';
    return (
      <span className={`inline-flex items-center gap-1.5 ${className}`}>
        <span
          dir="ltr"
          className={`inline-flex items-stretch rounded-[6px] overflow-hidden border-[1.5px] shadow-[0_1px_2px_rgba(15,23,42,0.12)] font-numeric-stat select-none ${hCls}`}
          style={{ backgroundColor: '#ffffff', color: '#111827', borderColor: '#1f2937' }}
        >
          <span
            className="text-white px-1.5 flex flex-col items-center justify-center leading-none shrink-0"
            style={{ backgroundColor: zone.accent }}
          >
            <span className="text-[7px] font-bold tracking-wider">{zone.en}</span>
            <span className="text-[8px] font-semibold mt-0.5">{zone.name}</span>
          </span>
          <span className="px-2 flex items-center font-extrabold tracking-widest">
            {toPersianDigits(parsed.zoneNum5)}
          </span>
          <span className="border-l border-slate-400 px-1.5 flex flex-col items-center justify-center leading-none bg-slate-50">
            <span className="text-[6.5px] font-semibold text-slate-600">منطقه آزاد</span>
            <span className="font-extrabold text-[11px] mt-0.5">
              {toPersianDigits(parsed.zoneCode2)}
            </span>
          </span>
        </span>
        {showTypeLabel && (
          <span className="text-[11px] text-on-surface-variant">منطقه آزاد {zone.name}</span>
        )}
      </span>
    );
  }

  // Standard National / Taxi / Public / Gov / Military / Diplomatic / Temporary / Disabled
  const heightCls =
    size === 'lg'
      ? 'h-[40px]'
      : size === 'md'
        ? 'h-[32px]'
        : 'h-[26px]';
  const numTextCls =
    size === 'lg'
      ? 'text-[17px]'
      : size === 'md'
        ? 'text-[14px]'
        : 'text-[12px]';
  const iranTextCls =
    size === 'lg'
      ? 'text-[14px]'
      : size === 'md'
        ? 'text-[12px]'
        : 'text-[10.5px]';
  const iranLabelCls =
    size === 'lg' ? 'text-[8px]' : size === 'md' ? 'text-[7px]' : 'text-[6px]';

  const isTemp = parsed.kind === 'temporary';
  const isDisabled = parsed.kind === 'disabled';

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span
        dir="ltr"
        className={`inline-flex items-stretch rounded-[6px] overflow-hidden border-[1.5px] shadow-[0_1px_2px_rgba(15,23,42,0.12)] font-numeric-stat select-none shrink-0 ${heightCls}`}
        style={{ backgroundColor: meta.bg, color: meta.fg, borderColor: meta.border }}
        title={`${meta.label} — ${formatIranPlate(parsed)}`}
      >
        {/* Left iconic blue I.R. IRAN strip */}
        <span
          className={`bg-[#0e4aa6] text-white flex flex-col items-center justify-between shrink-0 ${
            size === 'lg' ? 'w-[22px] py-1' : size === 'md' ? 'w-[18px] py-0.5' : 'w-[15px] py-0.5'
          }`}
        >
          <MiniIranFlag compact={size === 'sm'} />
          <span className="text-[5px] font-bold leading-none tracking-tighter text-center">
            I.R.
            <br />
            IRAN
          </span>
        </span>

        {/* Main 2-digit + Letter + 3-digit */}
        <span
          className={`flex items-center justify-center gap-1 font-extrabold leading-none ${
            size === 'lg' ? 'px-2.5 gap-2' : size === 'md' ? 'px-2 gap-1.5' : 'px-1.5 gap-1'
          } ${numTextCls}`}
        >
          <span className="tracking-tight">{toPersianDigits(parsed.left2)}</span>
          {isDisabled ? (
            <span className="inline-flex items-center justify-center rounded bg-[#0e4aa6] text-white p-0.5">
              <WheelchairIcon className={size === 'lg' ? 'w-4 h-4' : 'w-3 h-3'} />
            </span>
          ) : (
            <span className="font-black leading-none px-0.5">{parsed.letter}</span>
          )}
          <span className="tracking-tight">{toPersianDigits(parsed.right3)}</span>
        </span>

        {/* Right separator box: ایران + 2-digit province code (or expiry for temporary) */}
        <span
          className={`flex flex-col items-center justify-center leading-none border-l shrink-0 ${
            size === 'lg' ? 'w-[38px] px-1' : size === 'md' ? 'w-[31px] px-1' : 'w-[26px] px-0.5'
          }`}
          style={{
            borderColor: meta.fg === '#ffffff' ? 'rgba(255,255,255,0.45)' : 'rgba(17,24,39,0.35)',
          }}
        >
          <span className={`font-semibold opacity-85 ${iranLabelCls}`}>
            {isTemp ? 'اعتبار' : 'ایران'}
          </span>
          <span className={`font-extrabold mt-0.5 ${iranTextCls}`}>
            {toPersianDigits(parsed.iran2)}
          </span>
        </span>
      </span>
      {showTypeLabel && (
        <span className="text-[11px] text-on-surface-variant whitespace-nowrap">
          {meta.shortLabel}
        </span>
      )}
    </span>
  );
};

/**
 * Interactive Authentic Iranian License Plate Input.
 * Users select any Iranian plate type and type directly inside the real-world plate boxes.
 */
export const IranPlateInput: React.FC<{
  value: string;
  onChange: (formatted: string) => void;
  label?: string;
  compact?: boolean;
}> = ({ value, onChange, label, compact = false }) => {
  const [plate, setPlate] = useState<ParsedIranPlate>(() => {
    return parseIranPlate(value) ?? createEmptyPlate('personal');
  });

  // Sync external pre-fill (e.g., ?plate=... from Unit Dossier)
  useEffect(() => {
    if (!value) {
      setPlate((prev) => ({
        ...prev,
        left2: '',
        right3: '',
        motoTop3: '',
        motoBottom5: '',
        zoneNum5: '',
      }));
      return;
    }
    const parsed = parseIranPlate(value);
    if (parsed && formatIranPlate(parsed) !== formatIranPlate(plate)) {
      setPlate(parsed);
    }
  }, [value]);

  const refRight3 = useRef<HTMLInputElement | null>(null);
  const refIran2 = useRef<HTMLInputElement | null>(null);
  const refMotoBottom = useRef<HTMLInputElement | null>(null);
  const refZoneCode = useRef<HTMLInputElement | null>(null);

  const meta = IRAN_PLATE_CATALOG[plate.kind];

  const emit = (next: ParsedIranPlate) => {
    setPlate(next);
    onChange(formatIranPlate(next));
  };

  const handleKindChange = (nextKind: IranPlateKind) => {
    const nextMeta = IRAN_PLATE_CATALOG[nextKind];
    const next: ParsedIranPlate = {
      ...plate,
      kind: nextKind,
      letter: nextMeta.letters[0] ?? plate.letter,
      iran2:
        nextKind === 'temporary'
          ? plate.iran2.includes('/')
            ? plate.iran2
            : '05/09'
          : plate.iran2.includes('/')
            ? '11'
            : plate.iran2 || '11',
    };
    emit(next);
  };

  const cleanDigits = (raw: string, max: number) =>
    toLatinDigits(raw)
      .replace(/[^0-9]/g, '')
      .slice(0, max);

  const inputContrastCls =
    meta.fg === '#ffffff'
      ? 'bg-white/15 text-white placeholder:text-white/60 border-white/30'
      : 'bg-black/[0.04] text-[#111827] placeholder:text-slate-400 border-black/15';

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12.5px] font-semibold text-on-surface-variant">{label}</span>
          <span className="text-[11.5px] text-primary font-medium">{meta.label}</span>
        </div>
      )}

      {/* Plate Type Selector Strip */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
        {PLATE_KIND_ORDER.map((k) => {
          const item = IRAN_PLATE_CATALOG[k];
          const active = plate.kind === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => handleKindChange(k)}
              className={`shrink-0 h-7 px-2.5 rounded-lg text-[11.5px] font-medium flex items-center gap-1.5 active:scale-[0.96] transition-[transform,background-color,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                active
                  ? 'bg-primary-container text-on-primary-container font-bold'
                  : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full border border-black/20 shrink-0"
                style={{ backgroundColor: item.bg }}
                aria-hidden="true"
              />
              <span>{item.shortLabel}</span>
            </button>
          );
        })}
      </div>

      {/* WYSIWYG Real Iranian License Plate Input Box */}
      <div className="flex justify-center">
        {plate.kind === 'motorcycle' ? (
          <div
            dir="ltr"
            className="inline-flex items-stretch rounded-xl overflow-hidden border-2 shadow-sm w-full max-w-[230px]"
            style={{ backgroundColor: meta.bg, color: meta.fg, borderColor: meta.border }}
          >
            <div className="w-7 bg-[#0e4aa6] text-white flex flex-col items-center justify-between py-2 shrink-0">
              <MiniIranFlag />
              <span className="text-[6.5px] font-bold leading-tight text-center">
                I.R.
                <br />
                IRAN
              </span>
            </div>
            <div className="flex-1 p-2 flex flex-col items-center gap-1.5">
              <input
                type="text"
                inputMode="numeric"
                aria-label="۳ رقم بالای پلاک موتور"
                placeholder="۵۴۳"
                value={toPersianDigits(plate.motoTop3)}
                onChange={(e) => {
                  const v = cleanDigits(e.target.value, 3);
                  emit({ ...plate, motoTop3: v });
                  if (v.length === 3) refMotoBottom.current?.focus();
                }}
                className={`w-24 h-8 text-center rounded-md border font-extrabold font-numeric-stat tracking-widest ${inputContrastCls}`}
              />
              <div className="w-full h-px bg-slate-300" />
              <input
                ref={refMotoBottom}
                type="text"
                inputMode="numeric"
                aria-label="۵ رقم پایین پلاک موتور"
                placeholder="۸۷۲۱۹"
                value={toPersianDigits(plate.motoBottom5)}
                onChange={(e) => emit({ ...plate, motoBottom5: cleanDigits(e.target.value, 5) })}
                className={`w-36 h-8 text-center rounded-md border font-extrabold font-numeric-stat tracking-widest ${inputContrastCls}`}
              />
            </div>
          </div>
        ) : plate.kind === 'freezone' ? (
          <div
            dir="ltr"
            className="flex items-stretch rounded-xl overflow-hidden border-2 shadow-sm w-full max-w-[340px] h-[54px]"
            style={{ backgroundColor: '#ffffff', color: '#111827', borderColor: '#1f2937' }}
          >
            <div
              className="px-2 flex flex-col items-center justify-center shrink-0 text-white"
              style={{
                backgroundColor:
                  (FREE_ZONES.find((z) => z.id === plate.zoneId) ?? FREE_ZONES[0]).accent,
              }}
            >
              <select
                aria-label="انتخاب منطقه آزاد"
                value={plate.zoneId}
                onChange={(e) => {
                  const z = FREE_ZONES.find((item) => item.id === e.target.value) ?? FREE_ZONES[0];
                  emit({ ...plate, zoneId: z.id, zoneCode2: toLatinDigits(z.code) });
                }}
                className="bg-transparent text-white font-bold text-[12px] border-none outline-none cursor-pointer"
                dir="rtl"
              >
                {FREE_ZONES.map((z) => (
                  <option key={z.id} value={z.id} className="text-slate-900">
                    {z.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 px-2 flex items-center justify-center">
              <input
                type="text"
                inputMode="numeric"
                aria-label="شماره ۵ رقمی منطقه آزاد"
                placeholder="۴۸۲۱۰"
                value={toPersianDigits(plate.zoneNum5)}
                onChange={(e) => {
                  const v = cleanDigits(e.target.value, 5);
                  emit({ ...plate, zoneNum5: v });
                  if (v.length === 5) refZoneCode.current?.focus();
                }}
                className="w-full h-9 text-center rounded-md border border-black/15 bg-black/[0.03] text-[#111827] font-extrabold font-numeric-stat tracking-widest"
              />
            </div>
            <div className="w-[62px] border-l border-slate-400 bg-slate-50 px-1.5 flex flex-col items-center justify-center">
              <span className="text-[8px] font-bold text-slate-600">منطقه آزاد</span>
              <input
                ref={refZoneCode}
                type="text"
                inputMode="numeric"
                aria-label="کد ۲ رقمی منطقه آزاد"
                placeholder="۱۱"
                value={toPersianDigits(plate.zoneCode2)}
                onChange={(e) => emit({ ...plate, zoneCode2: cleanDigits(e.target.value, 2) })}
                className="w-11 h-7 mt-0.5 text-center rounded border border-black/15 bg-white text-[#111827] font-extrabold font-numeric-stat"
              />
            </div>
          </div>
        ) : (
          /* Standard National, Taxi, Public, Agriculture, Gov, Police, IRGC, Army, Military HQ, Diplomatic, Disabled, Temporary */
          <div
            dir="ltr"
            className={`flex items-stretch rounded-xl overflow-hidden border-2 shadow-sm w-full max-w-[356px] ${
              compact ? 'h-[50px]' : 'h-[56px]'
            }`}
            style={{ backgroundColor: meta.bg, color: meta.fg, borderColor: meta.border }}
          >
            {/* Left Blue I.R. IRAN Flag Band */}
            <div className="w-7 bg-[#0e4aa6] text-white flex flex-col items-center justify-between py-1.5 shrink-0">
              <MiniIranFlag />
              <span className="text-[6px] font-bold leading-tight text-center">
                I.R.
                <br />
                IRAN
              </span>
            </div>

            {/* 2 digits + Letter + 3 digits */}
            <div className="flex-1 px-2 flex items-center justify-center gap-1.5 min-w-0">
              <input
                type="text"
                inputMode="numeric"
                aria-label="۲ رقم اول پلاک"
                placeholder="۱۲"
                value={toPersianDigits(plate.left2)}
                onChange={(e) => {
                  const v = cleanDigits(e.target.value, 2);
                  emit({ ...plate, left2: v });
                  if (v.length === 2) refRight3.current?.focus();
                }}
                className={`w-[50px] h-9 text-center rounded-md border font-extrabold font-numeric-stat ${inputContrastCls}`}
              />

              {plate.kind === 'disabled' ? (
                <span className="w-10 h-9 rounded-md bg-[#0e4aa6] text-white flex items-center justify-center shrink-0">
                  <WheelchairIcon className="w-5 h-5" />
                </span>
              ) : meta.letters.length === 1 ? (
                <span className="min-w-[36px] h-9 px-1.5 flex items-center justify-center font-black text-[18px] shrink-0">
                  {meta.letters[0]}
                </span>
              ) : (
                <select
                  aria-label="حرف پلاک"
                  value={plate.letter}
                  onChange={(e) => {
                    emit({ ...plate, letter: e.target.value });
                    refRight3.current?.focus();
                  }}
                  className={`w-[54px] h-9 text-center rounded-md border font-black cursor-pointer ${inputContrastCls}`}
                  dir="rtl"
                >
                  {meta.letters.map((l) => (
                    <option key={l} value={l} className="text-slate-900 bg-white">
                      {l}
                    </option>
                  ))}
                </select>
              )}

              <input
                ref={refRight3}
                type="text"
                inputMode="numeric"
                aria-label="۳ رقم وسط پلاک"
                placeholder="۳۴۵"
                value={toPersianDigits(plate.right3)}
                onChange={(e) => {
                  const v = cleanDigits(e.target.value, 3);
                  emit({ ...plate, right3: v });
                  if (v.length === 3) refIran2.current?.focus();
                }}
                className={`w-[68px] h-9 text-center rounded-md border font-extrabold font-numeric-stat ${inputContrastCls}`}
              />
            </div>

            {/* Right Iran Code / Expiry Box */}
            <div
              className="w-[66px] border-l px-1 flex flex-col items-center justify-center shrink-0"
              style={{
                borderColor:
                  meta.fg === '#ffffff' ? 'rgba(255,255,255,0.4)' : 'rgba(17,24,39,0.3)',
              }}
            >
              <span className="text-[8.5px] font-bold leading-none opacity-85">
                {plate.kind === 'temporary' ? 'اعتبار' : 'ایران'}
              </span>
              <input
                ref={refIran2}
                type="text"
                inputMode={plate.kind === 'temporary' ? 'text' : 'numeric'}
                aria-label={plate.kind === 'temporary' ? 'ماه و سال اعتبار' : 'کد استان ایران'}
                placeholder={plate.kind === 'temporary' ? '۰۵/۰۹' : '۱۱'}
                value={toPersianDigits(plate.iran2)}
                onChange={(e) => {
                  const v =
                    plate.kind === 'temporary'
                      ? toLatinDigits(e.target.value)
                          .replace(/[^0-9/]/g, '')
                          .slice(0, 5)
                      : cleanDigits(e.target.value, 2);
                  emit({ ...plate, iran2: v });
                }}
                className={`w-12 h-7 mt-0.5 text-center rounded border font-extrabold font-numeric-stat ${inputContrastCls}`}
              />
            </div>
          </div>
        )}
      </div>

      {!compact && (
        <div className="flex items-center justify-between text-[11.5px] text-on-surface-variant px-0.5">
          <span>{meta.description}</span>
          {value && (
            <button
              type="button"
              onClick={() => emit(createEmptyPlate(plate.kind))}
              className="text-error font-medium hover:underline"
            >
              پاک کردن
            </button>
          )}
        </div>
      )}
    </div>
  );
};
