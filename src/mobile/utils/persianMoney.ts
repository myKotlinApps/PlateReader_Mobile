const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toEnglishDigits(input: string | number): string {
  const s = String(input ?? '');
  return s
    .replace(/[۰-۹]/g, (ch) => String(ch.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (ch) => String(ch.charCodeAt(0) - 0x0660));
}

export function toPersianDigits(input: string | number): string {
  return String(input ?? '').replace(/\d/g, (d) => FA_DIGITS[Number(d)] ?? d);
}

/**
 * Parses a Persian/Arabic/English formatted currency string into a clean integer.
 * Strips commas, spaces, and currency labels safely without floating-point drift.
 */
export function parsePersianAmount(raw: string | number): number {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0;
  }
  const digitsOnly = toEnglishDigits(raw).replace(/[^0-9]/g, '');
  if (!digitsOnly) return 0;
  // Cap at 15 digits (safe JS integer)
  const safeStr = digitsOnly.slice(0, 15);
  const n = Number(safeStr);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

/**
 * Formats an integer using Persian digits and 3-digit comma separators (e.g. 1450000 -> "۱,۴۵۰,۰۰۰").
 */
export function formatAmountFa(amount: number | string): string {
  const n = typeof amount === 'number' ? Math.max(0, Math.round(amount)) : parsePersianAmount(amount);
  const grouped = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return toPersianDigits(grouped);
}

const ONES = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
const TEENS = [
  'ده',
  'یازده',
  'دوازده',
  'سیزده',
  'چهارده',
  'پانزده',
  'شانزده',
  'هفده',
  'هجده',
  'نوزده',
];
const TENS = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
const HUNDREDS = [
  '',
  'صد',
  'دویست',
  'سیصد',
  'چهارصد',
  'پانصد',
  'ششصد',
  'هفتصد',
  'هشتصد',
  'نهصد',
];
const SCALES = ['', 'هزار', 'میلیون', 'میلیارد', 'هزار میلیارد'];

function chunkToPersianWords(n: number): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const rem = n % 100;
  if (h > 0) parts.push(HUNDREDS[h]);
  if (rem >= 10 && rem <= 19) {
    parts.push(TEENS[rem - 10]);
  } else {
    const t = Math.floor(rem / 10);
    const o = rem % 10;
    if (t > 0) parts.push(TENS[t]);
    if (o > 0) parts.push(ONES[o]);
  }
  return parts.join(' و ');
}

/**
 * Converts a non-negative Toman amount into natural Persian words.
 * Example: 1450000 -> "یک میلیون و چهارصد و پنجاه هزار تومان"
 */
export function amountToPersianWords(amount: number, unitLabel = 'تومان'): string {
  const n = Math.max(0, Math.floor(Number.isFinite(amount) ? amount : 0));
  if (n === 0) return `صفر ${unitLabel}`;

  const chunks: number[] = [];
  let cur = n;
  while (cur > 0) {
    chunks.push(cur % 1000);
    cur = Math.floor(cur / 1000);
  }

  const parts: string[] = [];
  for (let i = chunks.length - 1; i >= 0; i--) {
    const val = chunks[i];
    if (val === 0) continue;
    const words = chunkToPersianWords(val);
    const scale = SCALES[i] || '';
    parts.push(scale ? `${words} ${scale}` : words);
  }

  return `${parts.join(' و ')} ${unitLabel}`;
}
