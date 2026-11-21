import type { UnitDoc } from '../../server/nosqlStore';

export type ExcelUnitMatchMode =
  | 'last_digits'
  | 'last_digits_and_charge'
  | 'exact_charge';

export interface ExcelCustomFieldMapping {
  id: string;
  fieldLabel: string;
  sourceType: 'column' | 'unit_from_last_digits' | 'resident_from_unit';
  columnName?: string;
}

export interface ExcelBankPatternConfig {
  id?: string;
  name: string;
  blockId: string; // 'ALL' or 'A' | 'B' | 'C'
  amountColumn: string;
  dateColumn: string;
  traceColumn?: string;
  descriptionColumn?: string;
  currencyUnit: 'tomans' | 'rials';
  unitMatchMode: ExcelUnitMatchMode;
  suffixDigitCount: 1 | 2 | 3;
  chargeToleranceTomans?: number;
  customFields: ExcelCustomFieldMapping[];
}

export type BankRowMatchStatus =
  | 'matched_exact'
  | 'matched_partial'
  | 'matched_overpaid'
  | 'unmatched_unit'
  | 'ignored_zero';

export interface MatchedBankRow {
  rowIndex: number;
  rawAmountStr: string;
  rawNumericAmount: number;
  amountTomans: number;
  extractedUnitNum: number | null;
  matchedUnitId: string | null;
  matchedUnitCode: string | null;
  matchedBlockId: string | null;
  residentName: string | null;
  expectedChargeTomans: number | null;
  diffTomans: number | null;
  depositDate: string;
  traceCode: string;
  description: string;
  customRecord: Record<string, string>;
  status: BankRowMatchStatus;
  statusLabel: string;
}

export interface BankStatementMatchSummary {
  totalRows: number;
  matchedCount: number;
  exactCount: number;
  partialOrOverCount: number;
  unmatchedCount: number;
  totalMatchedTomans: number;
  rows: MatchedBankRow[];
}

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function normalizeDigits(input: unknown): string {
  const s = String(input ?? '');
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const pIdx = PERSIAN_DIGITS.indexOf(ch);
    if (pIdx >= 0) {
      out += String(pIdx);
      continue;
    }
    const aIdx = ARABIC_DIGITS.indexOf(ch);
    if (aIdx >= 0) {
      out += String(aIdx);
      continue;
    }
    out += ch;
  }
  return out;
}

export function parseBankAmount(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.round(Math.abs(raw));
  }
  const normalized = normalizeDigits(raw);
  // Strip currency words, commas, Persian thousands separators, spaces
  const cleaned = normalized.replace(/[^0-9.-]/g, '');
  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? Math.round(Math.abs(parsed)) : 0;
}

/**
 * Extracts unit number from the last N digits of a raw deposit figure.
 * Examples (suffixDigitCount = 2):
 *  - 12356008 -> 8
 *  - 54430011 -> 11
 * Example (suffixDigitCount = 3):
 *  - 1450208  -> 208
 */
export function extractUnitSuffixFromAmount(
  rawNumericAmount: number,
  suffixDigitCount: 1 | 2 | 3 = 2,
): number | null {
  const n = Math.floor(Math.abs(rawNumericAmount));
  if (!Number.isFinite(n) || n <= 0) return null;
  const mod = Math.pow(10, suffixDigitCount);
  const extracted = n % mod;
  return extracted > 0 ? extracted : null;
}

/**
 * Extracts the numeric part of a unitCode such as "B-08" -> 8, "B-208" -> 208, "11" -> 11.
 */
export function extractNumericUnitId(unit: Pick<UnitDoc, 'unitCode' | 'unitNumber'>): number | null {
  if (typeof unit.unitNumber === 'number' && Number.isFinite(unit.unitNumber) && unit.unitNumber > 0) {
    return unit.unitNumber;
  }
  const norm = normalizeDigits(unit.unitCode);
  const m = norm.match(/(\d+)\s*$/);
  if (!m) return null;
  const val = Number(m[1]);
  return Number.isFinite(val) && val > 0 ? val : null;
}

function getColumnValue(row: Record<string, unknown>, colName?: string): string {
  if (!colName || !colName.trim()) return '';
  const target = colName.trim();
  if (Object.prototype.hasOwnProperty.call(row, target)) {
    return String(row[target] ?? '').trim();
  }
  // Case/whitespace-insensitive fallback for messy bank Excel headers
  const targetNorm = normalizeDigits(target).replace(/\s+/g, ' ').toLowerCase();
  for (const key of Object.keys(row)) {
    const keyNorm = normalizeDigits(key).trim().replace(/\s+/g, ' ').toLowerCase();
    if (keyNorm === targetNorm) {
      return String(row[key] ?? '').trim();
    }
  }
  return '';
}

export function matchBankStatementRows(
  rows: Array<Record<string, unknown>>,
  pattern: ExcelBankPatternConfig,
  units: UnitDoc[],
): BankStatementMatchSummary {
  const scopedUnits =
    pattern.blockId && pattern.blockId !== 'ALL'
      ? units.filter((u) => u.blockId === pattern.blockId)
      : units;

  const unitByNum = new Map<number, UnitDoc>();
  for (const u of scopedUnits) {
    const num = extractNumericUnitId(u);
    if (num !== null) {
      unitByNum.set(num, u);
    }
  }

  const tolerance = Math.max(0, pattern.chargeToleranceTomans ?? 1500);
  const matchedRows: MatchedBankRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rawAmountStr = getColumnValue(row, pattern.amountColumn);
    const rawNumericAmount = parseBankAmount(rawAmountStr);
    const depositDate = getColumnValue(row, pattern.dateColumn) || 'بدون تاریخ';
    const traceCode =
      getColumnValue(row, pattern.traceColumn) || `BNK-${(1000 + i).toString()}`;
    const description = getColumnValue(row, pattern.descriptionColumn);

    if (rawNumericAmount <= 0) {
      matchedRows.push({
        rowIndex: i + 1,
        rawAmountStr,
        rawNumericAmount: 0,
        amountTomans: 0,
        extractedUnitNum: null,
        matchedUnitId: null,
        matchedUnitCode: null,
        matchedBlockId: null,
        residentName: null,
        expectedChargeTomans: null,
        diffTomans: null,
        depositDate,
        traceCode,
        description,
        customRecord: {},
        status: 'ignored_zero',
        statusLabel: 'بدون واریز',
      });
      continue;
    }

    const amountTomans =
      pattern.currencyUnit === 'rials'
        ? Math.round(rawNumericAmount / 10)
        : rawNumericAmount;

    let extractedUnitNum: number | null = null;
    let matchedUnit: UnitDoc | null = null;

    if (pattern.unitMatchMode === 'exact_charge') {
      matchedUnit =
        scopedUnits.find(
          (u) =>
            u.expectedChargeTomans &&
            Math.abs(amountTomans - u.expectedChargeTomans) <= tolerance,
        ) ??
        scopedUnits.find(
          (u) => u.debtTomans > 0 && Math.abs(amountTomans - u.debtTomans) <= tolerance,
        ) ??
        null;
      extractedUnitNum = matchedUnit ? extractNumericUnitId(matchedUnit) : null;
    } else {
      // 'last_digits' or 'last_digits_and_charge': extract unit number from last N digits of raw deposit
      extractedUnitNum = extractUnitSuffixFromAmount(
        rawNumericAmount,
        pattern.suffixDigitCount,
      );
      if (extractedUnitNum !== null) {
        matchedUnit = unitByNum.get(extractedUnitNum) ?? null;
      }
    }

    let status: BankRowMatchStatus = 'unmatched_unit';
    let statusLabel = extractedUnitNum
      ? `واحد ${extractedUnitNum.toLocaleString('fa-IR')} در بلوک یافت نشد`
      : 'شماره واحد قابل تشخیص نیست';
    let expectedChargeTomans: number | null = null;
    let diffTomans: number | null = null;

    if (matchedUnit) {
      expectedChargeTomans =
        matchedUnit.expectedChargeTomans && matchedUnit.expectedChargeTomans > 0
          ? matchedUnit.expectedChargeTomans
          : matchedUnit.debtTomans > 0
            ? matchedUnit.debtTomans
            : amountTomans;
      diffTomans = amountTomans - expectedChargeTomans;

      // In suffix-coded deposits (like 1,450,008 for 1,450,000 charge), a small suffix offset <= tolerance is treated as exact match!
      const effectiveTolerance = Math.max(tolerance, Math.pow(10, pattern.suffixDigitCount));
      if (Math.abs(diffTomans) <= effectiveTolerance) {
        status = 'matched_exact';
        statusLabel = 'تطابق کامل شارژ ✓';
      } else if (diffTomans < 0) {
        status = 'matched_partial';
        statusLabel = 'واریز کمتر از شارژ';
      } else {
        status = 'matched_overpaid';
        statusLabel = 'واریز بیشتر / تسویه معوقه';
      }
    }

    // Build custom user-defined extracted fields record (e.g. 3 custom fields configured by manager)
    const customRecord: Record<string, string> = {};
    for (const cf of pattern.customFields || []) {
      if (!cf.fieldLabel.trim()) continue;
      if (cf.sourceType === 'unit_from_last_digits') {
        customRecord[cf.fieldLabel] = matchedUnit
          ? matchedUnit.unitCode
          : extractedUnitNum !== null
            ? `واحد ${extractedUnitNum.toLocaleString('fa-IR')}`
            : 'نامشخص';
      } else if (cf.sourceType === 'resident_from_unit') {
        customRecord[cf.fieldLabel] = matchedUnit?.residentName || 'ثبت‌نشده';
      } else if (cf.columnName) {
        customRecord[cf.fieldLabel] = getColumnValue(row, cf.columnName);
      }
    }

    matchedRows.push({
      rowIndex: i + 1,
      rawAmountStr,
      rawNumericAmount,
      amountTomans,
      extractedUnitNum,
      matchedUnitId: matchedUnit?.id ?? null,
      matchedUnitCode: matchedUnit?.unitCode ?? null,
      matchedBlockId: matchedUnit?.blockId ?? null,
      residentName: matchedUnit?.residentName ?? null,
      expectedChargeTomans,
      diffTomans,
      depositDate,
      traceCode,
      description,
      customRecord,
      status,
      statusLabel,
    });
  }

  const matchedOnly = matchedRows.filter((r) => r.matchedUnitId !== null);
  return {
    totalRows: matchedRows.length,
    matchedCount: matchedOnly.length,
    exactCount: matchedRows.filter((r) => r.status === 'matched_exact').length,
    partialOrOverCount: matchedRows.filter(
      (r) => r.status === 'matched_partial' || r.status === 'matched_overpaid',
    ).length,
    unmatchedCount: matchedRows.filter((r) => r.status === 'unmatched_unit').length,
    totalMatchedTomans: matchedOnly.reduce((s, r) => s + r.amountTomans, 0),
    rows: matchedRows,
  };
}

/**
 * Realistic sample Iranian bank statement rows matching the user's exact pattern:
 * - Last 2 digits encode unit number (e.g. 12356008 -> Unit 8, 54430011 -> Unit 11, 1450008 / 1850011)
 */
export const SAMPLE_BANK_STATEMENT_ROWS: Array<Record<string, string | number>> = [
  {
    'تاریخ واریز': '۱۴۰۵/۰۸/۰۵ - ۱۰:۲۴',
    'واریز': '12356008',
    'برداشت': '0',
    'شماره پیگیری': 'SHB-8810042',
    'شرح تراکنش': 'انتقال وجه پایا - شارژ واحد ۸',
  },
  {
    'تاریخ واریز': '۱۴۰۵/۰۸/۰۷ - ۱۴:۱۵',
    'واریز': '54430011',
    'برداشت': '0',
    'شماره پیگیری': 'SHB-8810099',
    'شرح تراکنش': 'واریز کارت به کارت - واحد ۱۱',
  },
  {
    'تاریخ واریز': '۱۴۰۵/۰۸/۰۹ - ۰۹:۰۸',
    'واریز': '14500008',
    'برداشت': '0',
    'شماره پیگیری': 'SHB-8810121',
    'شرح تراکنش': 'شارژ ماهانه آبان - واحد ۸ (ریال)',
  },
  {
    'تاریخ واریز': '۱۴۰۵/۰۸/۱۱ - ۱۷:۴۲',
    'واریز': '15500011',
    'برداشت': '0',
    'شماره پیگیری': 'SHB-8810185',
    'شرح تراکنش': 'شارژ ماهانه آبان - واحد ۱۱ (ریال)',
  },
  {
    'تاریخ واریز': '۱۴۰۵/۰۸/۱۲ - ۱۲:۳۰',
    'واریز': '19200015',
    'برداشت': '0',
    'شماره پیگیری': 'SHB-8810210',
    'شرح تراکنش': 'شارژ آبان واحد ۱۵ بلوک B',
  },
  {
    'تاریخ واریز': '۱۴۰۵/۰۸/۱۴ - ۰۸:۵۰',
    'واریز': '0',
    'برداشت': '45000000',
    'شماره پیگیری': 'CHK-90211',
    'شرح تراکنش': 'پرداخت فاکتور سرویس آسانسور',
  },
];
