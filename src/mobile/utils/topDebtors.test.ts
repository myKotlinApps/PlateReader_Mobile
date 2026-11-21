import assert from 'node:assert/strict';
import test from 'node:test';
import { getTopDebtorUnits, type UnitDebtRow } from './topDebtors.ts';

const SAMPLE_UNITS: UnitDebtRow[] = [
  { id: '1', unitCode: 'A-101', blockId: 'A', residentName: 'ساکن ۱', debtTomans: 0 },
  { id: '2', unitCode: 'A-104', blockId: 'A', residentName: 'ساکن ۲', debtTomans: 1_100_000 },
  { id: '3', unitCode: 'B-08', blockId: 'B', residentName: 'ساکن ۳', debtTomans: 1_450_000 },
  { id: '4', unitCode: 'B-11', blockId: 'B', residentName: 'ساکن ۴', debtTomans: 1_550_000 },
  { id: '5', unitCode: 'B-15', blockId: 'B', residentName: 'ساکن ۵', debtTomans: 1_920_000 },
  { id: '6', unitCode: 'B-208', blockId: 'B', residentName: 'ساکن ۶', debtTomans: 1_120_000 },
  { id: '7', unitCode: 'B-302', blockId: 'B', residentName: 'ساکن ۷', debtTomans: 480_000 },
  { id: '8', unitCode: 'C-102', blockId: 'C', residentName: 'ساکن ۸', debtTomans: 1_150_000 },
];

test('getTopDebtorUnits returns top 5 units sorted descending by debtTomans', () => {
  const top5 = getTopDebtorUnits(SAMPLE_UNITS, 5);
  assert.equal(top5.length, 5);
  assert.deepEqual(
    top5.map((u) => u.unitCode),
    ['B-15', 'B-11', 'B-08', 'C-102', 'B-208'],
  );
  assert.deepEqual(
    top5.map((u) => u.debtTomans),
    [1_920_000, 1_550_000, 1_450_000, 1_150_000, 1_120_000],
  );
});

test('getTopDebtorUnits excludes settled or zero-debt units and handles empty arrays', () => {
  const onlySettled: UnitDebtRow[] = [
    { id: 's1', unitCode: 'A-101', blockId: 'A', residentName: 'تسویه', debtTomans: 0 },
    { id: 's2', unitCode: 'A-102', blockId: 'A', residentName: 'بستانکار', debtTomans: -50_000 },
  ];
  assert.equal(getTopDebtorUnits(onlySettled, 5).length, 0);
  assert.equal(getTopDebtorUnits([], 5).length, 0);
});

test('getTopDebtorUnits handles fewer than 5 indebted units and tie-breaks deterministically', () => {
  const tied: UnitDebtRow[] = [
    { id: 't2', unitCode: 'C-102', blockId: 'C', residentName: 'دو', debtTomans: 500_000 },
    { id: 't1', unitCode: 'A-101', blockId: 'A', residentName: 'یک', debtTomans: 500_000 },
  ];
  const res = getTopDebtorUnits(tied, 5);
  assert.equal(res.length, 2);
  assert.deepEqual(
    res.map((u) => u.unitCode),
    ['A-101', 'C-102'],
  );
});
