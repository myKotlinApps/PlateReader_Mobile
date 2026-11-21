import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractUnitSuffixFromAmount,
  matchBankStatementRows,
  parseBankAmount,
  type ExcelBankPatternConfig,
} from './excelMatcher';
import type { UnitDoc } from '../../server/nosqlStore';

const SAMPLE_UNITS: UnitDoc[] = [
  {
    id: 'u_b08',
    blockId: 'B',
    unitCode: 'B-08',
    unitNumber: 8,
    floor: 2,
    residentUserId: 'usr_res_b08',
    residentName: 'آقای حسینی',
    occupancyType: 'مالک ساکن',
    phone: '09194567123',
    plateText: '۸۸ ط ۵۱۲ - ایران ۱۱',
    parkingCode: 'P-08',
    storageCode: 'S-08',
    balanceTomans: 0,
    debtTomans: 1_450_000,
    expectedChargeTomans: 1_450_000,
  },
  {
    id: 'u_b11',
    blockId: 'B',
    unitCode: 'B-11',
    unitNumber: 11,
    floor: 3,
    residentUserId: 'usr_res_b11',
    residentName: 'خانم کریمی',
    occupancyType: 'مالک ساکن',
    phone: '09132214567',
    plateText: '۴۴ ج ۲۱۸ - ایران ۶۶',
    parkingCode: 'P-11',
    storageCode: 'S-11',
    balanceTomans: 0,
    debtTomans: 1_550_000,
    expectedChargeTomans: 1_550_000,
  },
];

test('parseBankAmount normalizes Persian digits and separators accurately', () => {
  assert.equal(parseBankAmount('۱۲,۳۵۶,۰۰۸ ریال'), 12356008);
  assert.equal(parseBankAmount('54430011'), 54430011);
});

test('extractUnitSuffixFromAmount extracts unit 8 from 12356008 and unit 11 from 54430011', () => {
  assert.equal(extractUnitSuffixFromAmount(12356008, 2), 8);
  assert.equal(extractUnitSuffixFromAmount(54430011, 2), 11);
  assert.equal(extractUnitSuffixFromAmount(1450208, 3), 208);
});

test('matchBankStatementRows matches exact columns, enriches resident name, and builds custom 3-field records', () => {
  const pattern: ExcelBankPatternConfig = {
    name: 'الگوی دو رقم آخر بانک پاسارگاد',
    blockId: 'B',
    amountColumn: 'واریز',
    dateColumn: 'تاریخ واریز',
    traceColumn: 'شماره پیگیری',
    descriptionColumn: 'شرح تراکنش',
    currencyUnit: 'rials',
    unitMatchMode: 'last_digits_and_charge',
    suffixDigitCount: 2,
    chargeToleranceTomans: 2000,
    customFields: [
      { id: 'f1', fieldLabel: 'شماره واحد', sourceType: 'unit_from_last_digits' },
      { id: 'f2', fieldLabel: 'واریزکننده (ساکن)', sourceType: 'resident_from_unit' },
      { id: 'f3', fieldLabel: 'زمان واریز', sourceType: 'column', columnName: 'تاریخ واریز' },
    ],
  };

  const rows = [
    { 'واریز': '14500008', 'تاریخ واریز': '۱۴۰۵/۰۸/۰۵ - ۱۰:۲۴', 'شماره پیگیری': 'TRX-1' },
    { 'واریز': '12356008', 'تاریخ واریز': '۱۴۰۵/۰۸/۰۶ - ۱۱:۰۰', 'شماره پیگیری': 'TRX-2' },
    { 'واریز': '54430011', 'تاریخ واریز': '۱۴۰۵/۰۸/۰۷ - ۱۴:۱۵', 'شماره پیگیری': 'TRX-3' },
    { 'واریز': '0', 'تاریخ واریز': '۱۴۰۵/۰۸/۰۸ - ۰۹:۰۰', 'شماره پیگیری': 'TRX-4' },
  ];

  const result = matchBankStatementRows(rows, pattern, SAMPLE_UNITS);
  assert.equal(result.totalRows, 4);
  assert.equal(result.matchedCount, 3);
  assert.equal(result.exactCount, 1);

  // Row 1: 14,500,008 Rials = 1,450,001 Tomans -> exact match to Unit B-08 (1,450,000 Tomans)
  assert.equal(result.rows[0].extractedUnitNum, 8);
  assert.equal(result.rows[0].matchedUnitCode, 'B-08');
  assert.equal(result.rows[0].residentName, 'آقای حسینی');
  assert.equal(result.rows[0].status, 'matched_exact');
  assert.equal(result.rows[0].customRecord['شماره واحد'], 'B-08');
  assert.equal(result.rows[0].customRecord['واریزکننده (ساکن)'], 'آقای حسینی');
  assert.equal(result.rows[0].customRecord['زمان واریز'], '۱۴۰۵/۰۸/۰۵ - ۱۰:۲۴');

  // Row 2: 12,356,008 Rials -> Unit 8 partial
  assert.equal(result.rows[1].extractedUnitNum, 8);
  assert.equal(result.rows[1].matchedUnitCode, 'B-08');
  assert.equal(result.rows[1].status, 'matched_partial');

  // Row 3: 54,430,011 Rials -> Unit 11 overpaid / arrears settlement
  assert.equal(result.rows[2].extractedUnitNum, 11);
  assert.equal(result.rows[2].matchedUnitCode, 'B-11');
  assert.equal(result.rows[2].residentName, 'خانم کریمی');
  assert.equal(result.rows[2].status, 'matched_overpaid');

  // Row 4: 0 deposit ignored
  assert.equal(result.rows[3].status, 'ignored_zero');
});
