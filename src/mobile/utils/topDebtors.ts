export interface UnitDebtRow {
  id: string;
  unitCode: string;
  blockId: string;
  residentName: string;
  debtTomans: number;
}

export function getTopDebtorUnits<T extends UnitDebtRow>(units: readonly T[], limit = 5): T[] {
  const max = Math.max(0, Math.floor(limit));
  if (max === 0) return [];
  return units
    .filter((u) => Number(u.debtTomans) > 0)
    .slice()
    .sort((a, b) => {
      const diff = Number(b.debtTomans) - Number(a.debtTomans);
      if (diff !== 0) return diff;
      return String(a.unitCode || '').localeCompare(String(b.unitCode || ''), 'fa');
    })
    .slice(0, max);
}
