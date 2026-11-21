import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateUnitChargeTomans,
  computeBudgetVariance,
  resolveMobileRoute,
} from './financeCalc';

test('calculateUnitChargeTomans computes Niloofar charge formula accurately', () => {
  const total = calculateUnitChargeTomans({
    baseFixedTomans: 1_500_000,
    areaSqm: 125,
    ratePerSqmTomans: 8_500,
    occupants: 3,
    perOccupantTomans: 150_000,
  });
  // 1,500,000 + 1,062,500 + 450,000 = 3,012,500
  assert.equal(total, 3_012_500);
});

test('computeBudgetVariance flags over-budget elevator category and savings pump category', () => {
  const pumps = computeBudgetVariance(18_500_000, 25_000_000);
  assert.equal(pumps.isOverBudget, false);
  assert.equal(pumps.utilizationPct, 74);
  assert.equal(pumps.varianceTomans, 6_500_000);
  assert.equal(pumps.variancePct, 26);

  const elevators = computeBudgetVariance(19_200_000, 18_000_000);
  assert.equal(elevators.isOverBudget, true);
  assert.equal(elevators.varianceTomans, -1_200_000);
  assert.equal(elevators.utilizationPct, 106.7);

  const elevatorsBalanced = computeBudgetVariance(19_200_000, 19_200_000);
  assert.equal(elevatorsBalanced.isOverBudget, false);
  assert.equal(elevatorsBalanced.varianceTomans, 0);
});

test('resolveMobileRoute preserves query params and normalizes dashboard routes', () => {
  assert.equal(resolveMobileRoute('dashboard'), '/m');
  assert.equal(resolveMobileRoute('dashboard?view=executive'), '/m?view=executive');
  assert.equal(resolveMobileRoute('finance?tab=petty'), '/m/finance?tab=petty');
  assert.equal(resolveMobileRoute('/m/facilities?tab=blueprints'), '/m/facilities?tab=blueprints');
  assert.equal(resolveMobileRoute('guard?tab=directives'), '/m/guard?tab=directives');
});
