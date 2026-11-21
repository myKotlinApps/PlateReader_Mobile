import { toEnglishDigits, toPersianDigits } from './persianMoney';

export interface JalaliDate {
  jy: number;
  jm: number; // 1..12
  jd: number; // 1..31
}

export interface JalaliDateTime extends JalaliDate {
  hour: number; // 0..23
  minute: number; // 0..59
}

export const JALALI_MONTH_NAMES = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
] as const;

export const PERSIAN_WEEKDAYS_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'] as const;

/**
 * Standard Gregorian -> Jalali (Solar Hijri) mathematical conversion.
 */
export function gregorianToJalali(gyInput: number, gm: number, gd: number): JalaliDate {
  const gdm = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let gy = gyInput;
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    355666 +
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) +
    gd +
    gdm[gm - 1];
  let jy = -1595 + 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return { jy, jm, jd };
}

/**
 * Standard Jalali (Solar Hijri) -> Gregorian mathematical conversion.
 */
export function jalaliToGregorian(jyInput: number, jm: number, jd: number): {
  gy: number;
  gm: number;
  gd: number;
} {
  let jy = jyInput + 1595;
  let days =
    -355668 +
    365 * jy +
    Math.floor(jy / 33) * 8 +
    Math.floor(((jy % 33) + 3) / 4) +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  let gy = 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const salA = [
    0,
    31,
    (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  let gm = 0;
  for (gm = 1; gm <= 12 && gd > salA[gm]; gm++) {
    gd -= salA[gm];
  }
  return { gy, gm, gd };
}

export function isJalaliLeapYear(jy: number): boolean {
  const g1 = jalaliToGregorian(jy, 12, 30);
  const roundTrip = gregorianToJalali(g1.gy, g1.gm, g1.gd);
  return roundTrip.jy === jy && roundTrip.jm === 12 && roundTrip.jd === 30;
}

export function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isJalaliLeapYear(jy) ? 30 : 29;
}

/**
 * Returns 0 for Shanbeh (Saturday) .. 6 for Jomeh (Friday).
 */
export function getJalaliMonthFirstWeekday(jy: number, jm: number): number {
  const { gy, gm, gd } = jalaliToGregorian(jy, jm, 1);
  const jsDay = new Date(gy, gm - 1, gd).getDay(); // 0=Sun..6=Sat
  return (jsDay + 1) % 7;
}

const pad2 = (n: number) => String(Math.max(0, Math.floor(n))).padStart(2, '0');

export function formatJalaliDate(d: JalaliDate): string {
  return toPersianDigits(`${d.jy}/${pad2(d.jm)}/${pad2(d.jd)}`);
}

export function formatJalaliTime(hour: number, minute: number): string {
  return toPersianDigits(`${pad2(hour)}:${pad2(minute)}`);
}

export function formatJalaliDateTime(dt: JalaliDateTime): string {
  return `${formatJalaliDate(dt)} • ساعت ${formatJalaliTime(dt.hour, dt.minute)}`;
}

export function jalaliDateTimeToMs(dt: JalaliDateTime): number {
  const { gy, gm, gd } = jalaliToGregorian(dt.jy, dt.jm, dt.jd);
  return new Date(gy, gm - 1, gd, dt.hour, dt.minute, 0, 0).getTime();
}

export function msToJalaliDateTime(ms: number): JalaliDateTime {
  const date = new Date(ms);
  const j = gregorianToJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
  return {
    ...j,
    hour: date.getHours(),
    minute: date.getMinutes(),
  };
}

export function getTodayJalali(): JalaliDateTime {
  return msToJalaliDateTime(Date.now());
}

/**
 * Parses a Jalali date string like "۱۴۰۵/۰۸/۳۰" or "1405/08/30 • ساعت 18:30".
 */
export function parseJalaliString(input?: string | null): JalaliDateTime {
  const fallback = getTodayJalali();
  if (!input) return fallback;
  const norm = toEnglishDigits(input);
  const dateMatch = norm.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  const timeMatch = norm.match(/(\d{1,2}):(\d{2})/);
  if (!dateMatch) {
    return {
      ...fallback,
      hour: timeMatch ? Math.min(23, Number(timeMatch[1])) : fallback.hour,
      minute: timeMatch ? Math.min(59, Number(timeMatch[2])) : fallback.minute,
    };
  }
  const jy = Number(dateMatch[1]);
  const jm = Math.min(12, Math.max(1, Number(dateMatch[2])));
  const maxD = jalaliMonthLength(jy, jm);
  const jd = Math.min(maxD, Math.max(1, Number(dateMatch[3])));
  return {
    jy,
    jm,
    jd,
    hour: timeMatch ? Math.min(23, Number(timeMatch[1])) : 9,
    minute: timeMatch ? Math.min(59, Number(timeMatch[2])) : 0,
  };
}
