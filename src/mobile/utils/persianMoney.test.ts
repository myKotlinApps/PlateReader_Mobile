import test from 'node:test';
import assert from 'node:assert/strict';
import {
  amountToPersianWords,
  formatAmountFa,
  parsePersianAmount,
  toEnglishDigits,
  toPersianDigits,
} from './persianMoney';

test('parsePersianAmount accepts Persian, Arabic, and English digits with commas', () => {
  assert.equal(parsePersianAmount('۱,۴۵۰,۰۰۰'), 1450000);
  assert.equal(parsePersianAmount('12,356,008'), 12356008);
  assert.equal(parsePersianAmount('٥٤٤٣٠٠١١'), 54430011);
  assert.equal(parsePersianAmount(''), 0);
});

test('formatAmountFa adds 3-digit comma grouping in Persian digits', () => {
  assert.equal(formatAmountFa(1450000), '۱,۴۵۰,۰۰۰');
  assert.equal(formatAmountFa(12356008), '۱۲,۳۵۶,۰۰۸');
  assert.equal(formatAmountFa(500), '۵۰۰');
  assert.equal(formatAmountFa(0), '۰');
});

test('amountToPersianWords renders accurate Persian Toman words', () => {
  assert.equal(amountToPersianWords(0), 'صفر تومان');
  assert.equal(amountToPersianWords(1450000), 'یک میلیون و چهارصد و پنجاه هزار تومان');
  assert.equal(amountToPersianWords(12000000), 'دوازده میلیون تومان');
  assert.equal(amountToPersianWords(12356008), 'دوازده میلیون و سیصد و پنجاه و شش هزار و هشت تومان');
  assert.equal(toEnglishDigits(toPersianDigits('208')), '208');
});
