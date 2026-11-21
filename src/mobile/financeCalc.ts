export interface ChargeFormulaInput {
  baseFixedTomans: number;
  areaSqm: number;
  ratePerSqmTomans: number;
  occupants: number;
  perOccupantTomans: number;
  parkingCount?: number;
  perParkingTomans?: number;
}

export interface BudgetCategoryItem {
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  spentTomans: number;
  budgetTomans: number;
}

export interface BudgetVarianceMetrics {
  utilizationPct: number;
  varianceTomans: number;
  variancePct: number;
  isOverBudget: boolean;
}

export function calculateUnitChargeTomans(input: ChargeFormulaInput): number {
  const area = Math.max(0, Number(input.areaSqm) || 0);
  const occupants = Math.max(0, Number(input.occupants) || 0);
  const parking = Math.max(0, Number(input.parkingCount) || 0);
  return Math.round(
    (Number(input.baseFixedTomans) || 0) +
      area * (Number(input.ratePerSqmTomans) || 0) +
      occupants * (Number(input.perOccupantTomans) || 0) +
      parking * (Number(input.perParkingTomans) || 0),
  );
}

export function computeBudgetVariance(
  spentTomans: number,
  budgetTomans: number,
): BudgetVarianceMetrics {
  const spent = Math.max(0, Number(spentTomans) || 0);
  const budget = Math.max(1, Number(budgetTomans) || 1);
  const utilizationPct = Number(((spent / budget) * 100).toFixed(1));
  const varianceTomans = budget - spent; // positive = savings, negative = over-budget
  const variancePct = Number((Math.abs((spent - budget) / budget) * 100).toFixed(1));
  return {
    utilizationPct,
    varianceTomans,
    variancePct,
    isOverBudget: spent > budget,
  };
}

export function resolveMobileRoute(target: string): string {
  const cleaned = target.trim();
  if (!cleaned || cleaned === 'dashboard') return '/m';
  if (cleaned.startsWith('/m')) return cleaned;
  if (cleaned.startsWith('dashboard?')) return `/m${cleaned.slice('dashboard'.length)}`;
  return `/m/${cleaned.replace(/^\/+/, '')}`;
}
