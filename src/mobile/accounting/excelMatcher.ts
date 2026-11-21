import type { UnitDoc } from '../../server/nosqlStore';

export type ExcelUnitMatchMode =
  | 'unit_column'
  | 'last_digits'
  | 'last_digits_and_charge'
  | 'exact_charge';

export interface ExcelCustomFieldMapping {
  id: string;
  fieldLabel: string;
  sourceType: 'column' | 'unit_from_column' | 'unit_from_last_digits' | 'resident_from_unit';
  columnName?: string;
}

export interface ExcelBankPatternConfig {
  id?: string;
  name: string;
  blockId: string; // 'ALL' or 'A' | 'B' | 'C'
  unitColumn?: string;
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
  rawUnitRef: string;
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

/**
 * Strips potentially dangerous leading spreadsheet formula prefixes (=, +, @)
 * and limits text length to protect display & NoSQL storage.
 */
export function sanitizeCellText(raw: unknown, maxLen = 180): string {
  let s = String(raw ?? '').trim();
  while (s.length > 0 && (s[0] === '=' || s[0] === '+' || s[0] === '@')) {
    s = s.slice(1).trim();
  }
  return s.slice(0, maxLen);
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
 * Parses a unit identifier cell from bank Excel statements.
 * Examples:
 *  - "B-208" -> { blockHint: "B", unitNum: 208, normalizedCode: "B-208" }
 *  - "واحد ۸" -> { blockHint: null, unitNum: 8, normalizedCode: "8" }
 *  - "بلوک A واحد ۱۰۱" -> { blockHint: "A", unitNum: 101, normalizedCode: "A-101" }
 *  - "۰۱۱" -> { blockHint: null, unitNum: 11, normalizedCode: "11" }
 */
export function parseUnitReference(raw: unknown): {
  blockHint: string | null;
  unitNum: number | null;
  normalizedCode: string;
} {
  const clean = normalizeDigits(sanitizeCellText(raw, 60)).toUpperCase();
  if (!clean) {
    return { blockHint: null, unitNum: null, normalizedCode: '' };
  }
  const blockMatch = clean.match(/\b([A-Z])\s*[-_/\s]?\s*(\d{1,4})\b/);
  if (blockMatch) {
    const blk = blockMatch[1];
    const num = Number(blockMatch[2]);
    return {
      blockHint: blk,
      unitNum: Number.isFinite(num) && num > 0 ? num : null,
      normalizedCode: `${blk}-${blockMatch[2]}`,
    };
  }
  const blockWordMatch = clean.match(/(?:بلوک|BLOCK)\s*([A-Z])/);
  const blockHint = blockWordMatch ? blockWordMatch[1] : null;
  const numMatches = clean.match(/\d{1,4}/g);
  const lastNumStr = numMatches ? numMatches[numMatches.length - 1] : null;
  const unitNum = lastNumStr ? Number(lastNumStr) : null;
  const validNum = unitNum !== null && Number.isFinite(unitNum) && unitNum > 0 ? unitNum : null;
  return {
    blockHint,
    unitNum: validNum,
    normalizedCode:
      blockHint && validNum !== null
        ? `${blockHint}-${validNum}`
        : validNum !== null
          ? String(validNum)
          : clean,
  };
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
    return sanitizeCellText(row[target]);
  }
  // Case/whitespace-insensitive fallback for messy bank Excel headers
  const targetNorm = normalizeDigits(target).replace(/\s+/g, ' ').toLowerCase();
  for (const key of Object.keys(row)) {
    const keyNorm = normalizeDigits(key).trim().replace(/\s+/g, ' ').toLowerCase();
    if (keyNorm === targetNorm) {
      return sanitizeCellText(row[key]);
    }
  }
  return '';
}

function findUnitByReference(
  ref: { blockHint: string | null; unitNum: number | null; normalizedCode: string },
  scopedUnits: UnitDoc[],
  unitByNum: Map<number, UnitDoc>,
): UnitDoc | null {
  if (!ref.normalizedCode && ref.unitNum === null) return null;

  // 1. Exact unitCode match (case/digit normalized), e.g., "B-08" or "B-208"
  const exact = scopedUnits.find(
    (u) => normalizeDigits(u.unitCode).trim().toUpperCase() === ref.normalizedCode,
  );
  if (exact) return exact;

  // 2. Match by blockHint + numeric unit number (handles "B-8" matching "B-08")
  if (ref.blockHint && ref.unitNum !== null) {
    const byBlockAndNum = scopedUnits.find(
      (u) => u.blockId.toUpperCase() === ref.blockHint && extractNumericUnitId(u) === ref.unitNum,
    );
    if (byBlockAndNum) return byBlockAndNum;
  }

  // 3. Match by numeric unit number within scoped units
  if (ref.unitNum !== null) {
    return unitByNum.get(ref.unitNum) ?? null;
  }

  return null;
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
    if (num !== null && !unitByNum.has(num)) {
      unitByNum.set(num, u);
    }
  }

  const tolerance = Math.max(0, pattern.chargeToleranceTomans ?? 1500);
  const matchedRows: MatchedBankRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rawUnitRef = getColumnValue(row, pattern.unitColumn);
    const rawAmountStr = getColumnValue(row, pattern.amountColumn);
    const rawNumericAmount = parseBankAmount(rawAmountStr);
    const depositDate = getColumnValue(row, pattern.dateColumn) || 'بدون تاریخ';
    const traceCode =
      getColumnValue(row, pattern.traceColumn) || `BNK-${(1000 + i).toString()}`;
    const description = getColumnValue(row, pattern.descriptionColumn);

    if (rawNumericAmount <= 0) {
      matchedRows.push({
        rowIndex: i + 1,
        rawUnitRef,
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

    if (pattern.unitMatchMode === 'unit_column') {
      const parsedRef = parseUnitReference(rawUnitRef);
      extractedUnitNum = parsedRef.unitNum;
      matchedUnit = findUnitByReference(parsedRef, scopedUnits, unitByNum);
      // Fallback: if unit column is empty on a row, try exact charge match within tolerance
      if (!matchedUnit && !rawUnitRef) {
        matchedUnit =
          scopedUnits.find(
            (u) =>
              u.expectedChargeTomans &&
              Math.abs(amountTomans - u.expectedChargeTomans) <= tolerance,
          ) ?? null;
        if (matchedUnit) extractedUnitNum = extractNumericUnitId(matchedUnit);
      }
    } else if (pattern.unitMatchMode === 'exact_charge') {
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
      // Bonus fallback: if unitColumn was also mapped and suffix didn't match, check unitColumn
      if (!matchedUnit && rawUnitRef) {
        const parsedRef = parseUnitReference(rawUnitRef);
        extractedUnitNum = parsedRef.unitNum ?? extractedUnitNum;
        matchedUnit = findUnitByReference(parsedRef, scopedUnits, unitByNum);
      }
    }

    let status: BankRowMatchStatus = 'unmatched_unit';
    let statusLabel = rawUnitRef
      ? `واحد «${rawUnitRef}» یافت نشد`
      : extractedUnitNum
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
      const effectiveTolerance =
        pattern.unitMatchMode === 'unit_column' || pattern.unitMatchMode === 'exact_charge'
          ? tolerance
          : Math.max(tolerance, Math.pow(10, pattern.suffixDigitCount));
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

    // Build custom user-defined extracted fields record
    const customRecord: Record<string, string> = {};
    for (const cf of pattern.customFields || []) {
      if (!cf.fieldLabel.trim()) continue;
      if (cf.sourceType === 'unit_from_column' || cf.sourceType === 'unit_from_last_digits') {
        customRecord[cf.fieldLabel] = matchedUnit
          ? matchedUnit.unitCode
          : rawUnitRef || (extractedUnitNum !== null ? `واحد ${extractedUnitNum.toLocaleString('fa-IR')}` : 'نامشخص');
      } else if (cf.sourceType === 'resident_from_unit') {
        customRecord[cf.fieldLabel] = matchedUnit?.residentName || 'ثبت‌نشده';
      } else if (cf.columnName) {
        customRecord[cf.fieldLabel] = getColumnValue(row, cf.columnName);
      }
    }

    matchedRows.push({
      rowIndex: i + 1,
      rawUnitRef,
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
 * Sample 1: Standard bank Excel file with explicit Unit Number & Amount columns
 * (نگاشت مستقیم ستون شماره واحد + مبلغ واریزی و تطبیق خودکار با شارژ واحدها)
 */
export const SAMPLE_UNIT_COLUMN_BANK_ROWS: Array<Record<string, string | number>> = [
  {
    'شماره واحد': 'B-08',
    'مبلغ واریزی': '1450000',
    'تاریخ واریز': '۱۴۰۵/۰۸/۰۵ - ۱۰:۲۴',
    'شماره پیگیری': 'SHB-9910421',
    'شرح تراکنش': 'واریز پایا شارژ ماهانه آبان — واحد ۸',
  },
  {
    'شماره واحد': 'B-11',
    'مبلغ واریزی': '1550000',
    'تاریخ واریز': '۱۴۰۵/۰۸/۰۷ - ۱۴:۱۵',
    'شماره پیگیری': 'SHB-9910488',
    'شرح تراکنش': 'کارت به کارت شارژ آبان — واحد ۱۱',
  },
  {
    'شماره واحد': 'واحد ۲۰۸',
    'مبلغ واریزی': '1250000',
    'تاریخ واریز': '۱۴۰۵/۰۸/۰۹ - ۱۱:۳۰',
    'شماره پیگیری': 'SHB-9910530',
    'شرح تراکنش': 'واریز بخشی از شارژ آبان واحد ۲۰۸',
  },
  {
    'شماره واحد': 'B-15',
    'مبلغ واریزی': '2400000',
    'تاریخ واریز': '۱۴۰۵/۰۸/۱۲ - ۱۶:۴۵',
    'شماره پیگیری': 'SHB-9910612',
    'شرح تراکنش': 'تسویه شارژ جاری و معوقه واحد ۱۵',
  },
  {
    'شماره واحد': '—',
    'مبلغ واریزی': '0',
    'تاریخ واریز': '۱۴۰۵/۰۸/۱۴ - ۰۸:۵۰',
    'شماره پیگیری': 'CHK-90211',
    'شرح تراکنش': 'برداشت بابت سرویس دوره‌ای آسانسور',
  },
];

/**
 * Sample 2: Realistic Iranian bank statement rows where the last 2 digits encode the unit number
 * (e.g. 12356008 -> Unit 8, 54430011 -> Unit 11, 14500008 -> Unit 8 exact charge)
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
