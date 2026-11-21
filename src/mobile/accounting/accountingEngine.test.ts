import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAccountLedger,
  computeAgingReport,
  computeFinancialStatements,
  computeTrialBalance,
  INITIAL_AGING_DEBTORS,
  INITIAL_JOURNAL_ENTRIES,
  validateJournalEntry,
} from './accountingEngine';
import { formatIranPlate, parseIranPlate } from '../ui/IranPlate';

test('initial journal entries produce a perfectly balanced trial balance and balance sheet', () => {
  const tb = computeTrialBalance(INITIAL_JOURNAL_ENTRIES);
  assert.equal(tb.isBalanced, true);
  assert.equal(tb.totalTurnoverDebit, tb.totalTurnoverCredit);
  assert.equal(tb.totalEndingDebit, tb.totalEndingCredit);

  const fs = computeFinancialStatements(INITIAL_JOURNAL_ENTRIES);
  assert.equal(fs.balanceSheetBalanced, true);
  assert.equal(fs.totalAssets, fs.totalLiabilities + fs.totalEquityWithSurplus);
});

test('validateJournalEntry rejects unbalanced entries and accepts balanced ones', () => {
  const bad = validateJournalEntry([
    { accountCode: '1102', debit: 1000, credit: 0 },
    { accountCode: '1105', debit: 0, credit: 900 },
  ]);
  assert.equal(bad.isValid, false);
  assert.equal(bad.diff, 100);

  const good = validateJournalEntry([
    { accountCode: '1102', debit: 1000, credit: 0 },
    { accountCode: '1105', debit: 0, credit: 1000 },
  ]);
  assert.equal(good.isValid, true);
  assert.equal(good.diff, 0);
});

test('account cardex computes accurate running balance for bank 1102', () => {
  const cardex = computeAccountLedger(INITIAL_JOURNAL_ENTRIES, '1102');
  assert.ok(cardex.lines.length >= 4);
  assert.equal(cardex.endingSide, 'بد');
  assert.equal(cardex.endingBalance, 108_500_000 + 49_850_000 - 24_300_000 - 7_400_000);
});

test('aging report flags >= 60 days overdue units for Article 10 with late penalty', () => {
  const rows = computeAgingReport(INITIAL_AGING_DEBTORS, 2);
  const b202 = rows.find((r) => r.unitCode === 'B-202');
  assert.ok(b202);
  assert.equal(b202.article10Eligible, true);
  assert.ok(b202.penaltyTomans > 0);
});

test('Iranian license plate parser detects all major Iranian plate types accurately', () => {
  const personal = parseIranPlate('۶۸ د ۷۹۱ - ایران ۲۲');
  assert.equal(personal?.kind, 'personal');
  assert.equal(personal?.left2, '68');
  assert.equal(personal?.letter, 'د');
  assert.equal(personal?.right3, '791');
  assert.equal(personal?.iran2, '22');

  const irgc = parseIranPlate('12ث345-11');
  assert.equal(irgc?.kind, 'irgc');
  assert.equal(formatIranPlate(irgc!), '۱۲ ث ۳۴۵ - ایران ۱۱');

  const taxi = parseIranPlate('22ت450-11');
  assert.equal(taxi?.kind, 'taxi');

  const gov = parseIranPlate('11الف234-11');
  assert.equal(gov?.kind, 'government');

  const diplomatic = parseIranPlate('23 D 412 - 11');
  assert.equal(diplomatic?.kind, 'diplomatic');

  const moto = parseIranPlate('موتور ۵۴۳-۸۷۲۱۹');
  assert.equal(moto?.kind, 'motorcycle');
  assert.equal(moto?.motoTop3, '543');
  assert.equal(moto?.motoBottom5, '87219');

  const freezone = parseIranPlate('منطقه آزاد کیش ۴۸۲۱۰ - ۱۱');
  assert.equal(freezone?.kind, 'freezone');
  assert.equal(freezone?.zoneId, 'kish');
});
