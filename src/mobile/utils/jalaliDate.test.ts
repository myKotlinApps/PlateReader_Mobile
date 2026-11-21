import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatJalaliDate,
  formatJalaliDateTime,
  gregorianToJalali,
  isJalaliLeapYear,
  jalaliDateTimeToMs,
  jalaliMonthLength,
  jalaliToGregorian,
  msToJalaliDateTime,
  parseJalaliString,
} from './jalaliDate';

test('gregorianToJalali and jalaliToGregorian round-trip accurately including Nowruz and Esfand', () => {
  // Nowruz 1403 = 2024-03-20
  assert.deepEqual(gregorianToJalali(2024, 3, 20), { jy: 1403, jm: 1, jd: 1 });
  assert.deepEqual(jalaliToGregorian(1403, 1, 1), { gy: 2024, gm: 3, gd: 20 });

  // 1403 is a Jalali leap year (30 Esfand 1403 = 2025-03-20)
  assert.equal(isJalaliLeapYear(1403), true);
  assert.equal(jalaliMonthLength(1403, 12), 30);
  assert.deepEqual(jalaliToGregorian(1403, 12, 30), { gy: 2025, gm: 3, gd: 20 });

  // 1404 is not a leap year
  assert.equal(isJalaliLeapYear(1404), false);
  assert.equal(jalaliMonthLength(1404, 12), 29);
});

test('formatJalaliDateTime and parseJalaliString preserve Jalali dates and times cleanly', () => {
  const dt = { jy: 1405, jm: 8, jd: 30, hour: 18, minute: 30 };
  assert.equal(formatJalaliDate(dt), '۱۴۰۵/۰۸/۳۰');
  const formatted = formatJalaliDateTime(dt);
  assert.equal(formatted, '۱۴۰۵/۰۸/۳۰ • ساعت ۱۸:۳۰');

  const parsed = parseJalaliString(formatted);
  assert.deepEqual(parsed, dt);

  const ms = jalaliDateTimeToMs(dt);
  const back = msToJalaliDateTime(ms);
  assert.deepEqual(back, dt);
});
