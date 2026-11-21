import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractUnitSuffixFromAmount,
  matchBankStatementRows,
  parseBankAmount,
  parseUnitReference,
  sanitizeCellText,
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
  {
    id: 'u_b208',
    blockId: 'B',
    unitCode: 'B-208',
    unitNumber: 208,
    floor: 4,
    residentUserId: 'usr_res_b208',
    residentName: 'مهندس شریفی',
    occupancyType: 'مستأجر',
    phone: '09123334455',
    plateText: '۲۲ ب ۶۱۴ - ایران ۱۱',
    parkingCode: 'P-31',
    storageCode: 'S-22',
    balanceTomans: 0,
    debtTomans: 1_800_000,
    expectedChargeTomans: 1_800_000,
  },
];

test('parseBankAmount normalizes Persian digits and separators accurately', () => {
  assert.equal(parseBankAmount('۱۲,۳۵۶,۰۰۸ ریال'), 12356008);
  assert.equal(parseBankAmount('54430011'), 54430011);
});

test('sanitizeCellText strips leading spreadsheet formula injection prefixes', () => {
  assert.equal(sanitizeCellText('=SUM(A1:A5)'), 'SUM(A1:A5)');
  assert.equal(sanitizeCellText('+CMD|calc'), 'CMD|calc');
  assert.equal(sanitizeCellText('  @HYPERLINK("x") '), 'HYPERLINK("x")');
  assert.equal(sanitizeCellText('واحد ۲۰۸'), 'واحد ۲۰۸');
});

test('parseUnitReference handles Persian digits, block prefixes, and plain numbers', () => {
  assert.deepEqual(parseUnitReference('B-08'), {
    blockHint: 'B',
    unitNum: 8,
    normalizedCode: 'B-08',
  });
  assert.deepEqual(parseUnitReference('واحد ۲۰۸'), {
    blockHint: null,
    unitNum: 208,
    normalizedCode: '208',
  });
  assert.deepEqual(parseUnitReference('بلوک A واحد ۱۰۱'), {
    blockHint: 'A',
    unitNum: 101,
    normalizedCode: 'A-101',
  });
});

test('extractUnitSuffixFromAmount extracts unit 8 from 12356008 and unit 11 from 54430011', () => {
  assert.equal(extractUnitSuffixFromAmount(12356008, 2), 8);
  assert.equal(extractUnitSuffixFromAmount(54430011, 2), 11);
  assert.equal(extractUnitSuffixFromAmount(1450208, 3), 208);
});

test('matchBankStatementRows supports direct unit_column mapping + charge reconciliation', () => {
  const pattern: ExcelBankPatternConfig = {
    name: 'نگاشت مستقیم ستون شماره واحد و مبلغ',
    blockId: 'B',
    unitColumn: 'شماره واحد',
    amountColumn: 'مبلغ واریزی',
    dateColumn: 'تاریخ واریز',
    traceColumn: 'شماره پیگیری',
    descriptionColumn: 'شرح تراکنش',
    currencyUnit: 'tomans',
    unitMatchMode: 'unit_column',
    suffixDigitCount: 2,
    chargeToleranceTomans: 2000,
    customFields: [
      { id: 'f1', fieldLabel: 'واحد شناسایی‌شده', sourceType: 'unit_from_column' },
      { id: 'f2', fieldLabel: 'ساکن', sourceType: 'resident_from_unit' },
      { id: 'f3', fieldLabel: 'شرح', sourceType: 'column', columnName: 'شرح تراکنش' },
    ],
  };

  const rows = [
    { 'شماره واحد': 'B-08', 'مبلغ واریزی': '۱,۴۵۰,۰۰۰', 'تاریخ واریز': '۱۴۰۵/۰۸/۰۵', 'شماره پیگیری': 'T-1', 'شرح تراکنش': 'شارژ آبان' },
    { 'شماره واحد': 'واحد ۲۰۸', 'مبلغ واریزی': '1250000', 'تاریخ واریز': '۱۴۰۵/۰۸/۰۶', 'شماره پیگیری': 'T-2', 'شرح تراکنش': 'بخشی از شارژ' },
    { 'شماره واحد': '۱۱', 'مبلغ واریزی': '2100000', 'تاریخ واریز': '۱۴۰۵/۰۸/۰۷', 'شماره پیگیری': 'T-3', 'شرح تراکنش': 'تسویه معوقه' },
    { 'شماره واحد': 'B-999', 'مبلغ واریزی': '1450000', 'تاریخ واریز': '۱۴۰۵/۰۸/۰۸', 'شماره پیگیری': 'T-4', 'شرح تراکنش': 'واحد نامعتبر' },
    { 'شماره واحد': '', 'مبلغ واریزی': '0', 'تاریخ واریز': '۱۴۰۵/۰۸/۰۹', 'شماره پیگیری': 'T-5', 'شرح تراکنش': 'برداشت' },
  ];

  const summary = matchBankStatementRows(rows, pattern, SAMPLE_UNITS);
  assert.equal(summary.totalRows, 5);
  assert.equal(summary.matchedCount, 3);
  assert.equal(summary.exactCount, 1);
  assert.equal(summary.partialOrOverCount, 2);
  assert.equal(summary.unmatchedCount, 1);
  assert.equal(summary.totalMatchedTomans, 1_450_000 + 1_250_000 + 2_100_000);

  assert.equal(summary.rows[0].matchedUnitCode, 'B-08');
  assert.equal(summary.rows[0].status, 'matched_exact');
  assert.equal(summary.rows[0].customRecord['واحد شناسایی‌شده'], 'B-08');
  assert.equal(summary.rows[0].customRecord['ساکن'], 'آقای حسینی');

  assert.equal(summary.rows[1].matchedUnitCode, 'B-208');
  assert.equal(summary.rows[1].status, 'matched_partial');
  assert.equal(summary.rows[1].diffTomans, -550_000);

  assert.equal(summary.rows[2].matchedUnitCode, 'B-11');
  assert.equal(summary.rows[2].status, 'matched_overpaid');
  assert.equal(summary.rows[2].diffTomans, 550_000);

  assert.equal(summary.rows[3].status, 'unmatched_unit');
  assert.equal(summary.rows[4].status, 'ignored_zero');
});

test('matchBankStatementRows matches last_digits_and_charge mode and builds custom 3-field records', () => {
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

  assert.equal(result.rows[0].extractedUnitNum, 8);
  assert.equal(result.rows[0].matchedUnitCode, 'B-08');
  assert.equal(result.rows[0].residentName, 'آقای حسینی');
  assert.equal(result.rows[0].status, 'matched_exact');
  assert.equal(result.rows[0].customRecord['شماره واحد'], 'B-08');
  assert.equal(result.rows[0].customRecord['واریزکننده (ساکن)'], 'آقای حسینی');
  assert.equal(result.rows[0].customRecord['زمان واریز'], '۱۴۰۵/۰۸/۰۵ - ۱۰:۲۴');

  assert.equal(result.rows[1].extractedUnitNum, 8);
  assert.equal(result.rows[1].matchedUnitCode, 'B-08');
  assert.equal(result.rows[1].status, 'matched_partial');

  assert.equal(result.rows[2].extractedUnitNum, 11);
  assert.equal(result.rows[2].matchedUnitCode, 'B-11');
  assert.equal(result.rows[2].residentName, 'خانم کریمی');
  assert.equal(result.rows[2].status, 'matched_overpaid');

  assert.equal(result.rows[3].status, 'ignored_zero');
});
