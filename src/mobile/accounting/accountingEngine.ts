/**
 * Comprehensive Iranian Double-Entry Residential Accounting Engine.
 * Implements standard Iranian Chart of Accounts (کدینگ کل/معین/تفصیلی),
 * balanced Journal Entries (دفتر روزنامه), General/Subsidiary Ledger Cardex (دفتر کل و تفصیلی),
 * 4-Column & 6-Column Trial Balance (تراز آزمایشی), Income Statement (صورت درآمد و هزینه),
 * Balance Sheet (ترازنامه), A/R Aging (جدول سنی مطالبات و ماده ۱۰ مکرر), and Sayadi Checks.
 */

export type AccountGroup = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export interface ChartAccount {
  code: string;
  kolCode: string;
  kolTitle: string;
  title: string;
  group: AccountGroup;
  normalBalance: 'debit' | 'credit';
  isControl?: boolean;
}

export interface JournalLine {
  accountCode: string;
  subsidiary?: string; // تفصیلی: e.g. 'واحد A-104' or 'پمپ‌سازان نوین'
  description?: string;
  debit: number; // تومان
  credit: number; // تومان
}

export interface JournalEntry {
  id: string;
  voucherNo: number;
  date: string; // Jalali YYYY/MM/DD
  description: string;
  source: 'manual' | 'receipt' | 'charge' | 'check' | 'petty_cash' | 'opening' | 'reversal';
  status: 'draft' | 'final';
  refCode?: string;
  lines: JournalLine[];
}

export interface PendingReceipt {
  id: string;
  unitCode: string;
  residentName: string;
  amountTomans: number;
  date: string;
  bankAccountCode: string;
  traceCode: string;
  channel: string;
  approved: boolean;
  voucherNo?: number;
}

export interface SayadiCheck {
  id: string;
  sayadiId: string; // 16-digit Sayadi identifier
  payee: string;
  amountTomans: number;
  dueDate: string;
  bankAccountCode: string;
  expenseAccountCode: string;
  status: 'registered' | 'cleared' | 'pending_sign';
  voucherNo?: number;
}

export interface AgingRow {
  unitCode: string;
  residentName: string;
  block: string;
  daysOverdue: number;
  bucket: '0-30' | '31-60' | '61-90' | '90+';
  principalTomans: number;
  penaltyTomans: number;
  totalTomans: number;
  article10Eligible: boolean;
}

export const ACCOUNT_GROUP_LABELS: Record<AccountGroup, string> = {
  asset: 'دارایی‌ها',
  liability: 'بدهی‌ها',
  equity: 'اندوخته و حقوق مالکین',
  revenue: 'درآمدها',
  expense: 'هزینه‌ها',
};

export const CHART_OF_ACCOUNTS: ChartAccount[] = [
  // 11 — دارایی‌های جاری
  { code: '1101', kolCode: '11', kolTitle: 'دارایی‌های جاری', title: 'صندوق نقدی مجتمع', group: 'asset', normalBalance: 'debit' },
  { code: '1102', kolCode: '11', kolTitle: 'دارایی‌های جاری', title: 'بانک پاسارگاد — حساب جاری شارژ', group: 'asset', normalBalance: 'debit' },
  { code: '1103', kolCode: '11', kolTitle: 'دارایی‌های جاری', title: 'بانک سامان — صندوق ذخیره عمرانی', group: 'asset', normalBalance: 'debit' },
  { code: '1104', kolCode: '11', kolTitle: 'دارایی‌های جاری', title: 'تنخواه‌گردان اجرایی بلوک B', group: 'asset', normalBalance: 'debit' },
  { code: '1105', kolCode: '11', kolTitle: 'دارایی‌های جاری', title: 'حساب‌های دریافتنی ساکنین (شارژ)', group: 'asset', normalBalance: 'debit', isControl: true },

  // 21 — بدهی‌های جاری
  { code: '2101', kolCode: '21', kolTitle: 'بدهی‌های جاری', title: 'حساب‌های پرداختنی پیمانکاران', group: 'liability', normalBalance: 'credit', isControl: true },
  { code: '2102', kolCode: '21', kolTitle: 'بدهی‌های جاری', title: 'اسناد و چک‌های پرداختنی صیادی', group: 'liability', normalBalance: 'credit' },
  { code: '2103', kolCode: '21', kolTitle: 'بدهی‌های جاری', title: 'پیش‌دریافت شارژ ساکنین', group: 'liability', normalBalance: 'credit' },
  { code: '2104', kolCode: '21', kolTitle: 'بدهی‌های جاری', title: 'حق بیمه و مالیات تکلیفی پرسنل', group: 'liability', normalBalance: 'credit' },

  // 31 — اندوخته و حقوق مالکین
  { code: '3101', kolCode: '31', kolTitle: 'اندوخته و حقوق مالکین', title: 'اندوخته قانونی صندوق ذخیره عمرانی', group: 'equity', normalBalance: 'credit' },
  { code: '3102', kolCode: '31', kolTitle: 'اندوخته و حقوق مالکین', title: 'مازاد (کسری) انباشته سنواتی', group: 'equity', normalBalance: 'credit' },

  // 41 — درآمدهای عملیاتی
  { code: '4101', kolCode: '41', kolTitle: 'درآمدهای مجتمع', title: 'درآمد شارژ جاری ماهانه (۴۸ واحد)', group: 'revenue', normalBalance: 'credit' },
  { code: '4102', kolCode: '41', kolTitle: 'درآمدهای مجتمع', title: 'سهم صندوق ذخیره عمرانی ماهانه', group: 'revenue', normalBalance: 'credit' },
  { code: '4103', kolCode: '41', kolTitle: 'درآمدهای مجتمع', title: 'درآمد اجاره سالن و جریمه تاخیر', group: 'revenue', normalBalance: 'credit' },

  // 51 — هزینه‌های مشاعات
  { code: '5101', kolCode: '51', kolTitle: 'هزینه‌های مشاعات', title: 'آب، برق و گاز مشاعات', group: 'expense', normalBalance: 'debit' },
  { code: '5102', kolCode: '51', kolTitle: 'هزینه‌های مشاعات', title: 'تعمیرات تاسیسات و موتورخانه', group: 'expense', normalBalance: 'debit' },
  { code: '5103', kolCode: '51', kolTitle: 'هزینه‌های مشاعات', title: 'سرویس و نگهداری آسانسورها', group: 'expense', normalBalance: 'debit' },
  { code: '5104', kolCode: '51', kolTitle: 'هزینه‌های مشاعات', title: 'حقوق لابی‌من، سرایداری و انتظامات', group: 'expense', normalBalance: 'debit' },
  { code: '5105', kolCode: '51', kolTitle: 'هزینه‌های مشاعات', title: 'نظافت، فضای سبز و ملزومات', group: 'expense', normalBalance: 'debit' },
];

export const ACCOUNT_BY_CODE: Record<string, ChartAccount> = Object.fromEntries(
  CHART_OF_ACCOUNTS.map((a) => [a.code, a]),
);

export const INITIAL_JOURNAL_ENTRIES: JournalEntry[] = [
  {
    id: 'je_101',
    voucherNo: 101,
    date: '۱۴۰۵/۰۸/۰۱',
    description: 'سند افتتاحیه دوره آبان ۱۴۰۵ — انتقال مانده بانک‌ها، صندوق ذخیره و مطالبات',
    source: 'opening',
    status: 'final',
    refCode: 'OPEN-1405-08',
    lines: [
      { accountCode: '1102', description: 'مانده بانک پاسارگاد', debit: 108_500_000, credit: 0 },
      { accountCode: '1103', description: 'مانده بانک سامان (عمرانی)', debit: 142_000_000, credit: 0 },
      { accountCode: '1104', description: 'مانده تنخواه بلوک B', debit: 12_150_000, credit: 0 },
      { accountCode: '1105', subsidiary: 'واحدهای معوق دوره قبل', debit: 19_850_000, credit: 0 },
      { accountCode: '2102', subsidiary: 'چک صیادی آسانسور البرز', debit: 0, credit: 24_000_000 },
      { accountCode: '2103', subsidiary: 'پیش‌دریافت شارژ بلوک A', debit: 0, credit: 6_500_000 },
      { accountCode: '3101', description: 'اندوخته صندوق ذخیره عمرانی', debit: 0, credit: 142_000_000 },
      { accountCode: '3102', description: 'مازاد انباشته سنواتی', debit: 0, credit: 110_000_000 },
    ],
  },
  {
    id: 'je_102',
    voucherNo: 102,
    date: '۱۴۰۵/۰۸/۰۲',
    description: 'صدور جمعی قبوض شارژ آبان ۱۴۰۵ (۴۸ واحد — ۳ بلوک)',
    source: 'charge',
    status: 'final',
    refCode: 'CHG-1405-08',
    lines: [
      { accountCode: '1105', subsidiary: 'کل واحدهای مجتمع (۴۸ واحد)', debit: 54_000_000, credit: 0 },
      { accountCode: '4101', description: 'درآمد شارژ جاری آبان', debit: 0, credit: 45_000_000 },
      { accountCode: '4102', description: 'سهم صندوق ذخیره عمرانی', debit: 0, credit: 9_000_000 },
    ],
  },
  {
    id: 'je_103',
    voucherNo: 103,
    date: '۱۴۰۵/۰۸/۱۰',
    description: 'وصول شارژ واحدهای بلوک A و C — واریز تجمیعی به بانک پاسارگاد',
    source: 'receipt',
    status: 'final',
    refCode: 'BNK-88201',
    lines: [
      { accountCode: '1102', description: 'واریز شارژ ۴۲ واحد', debit: 49_850_000, credit: 0 },
      { accountCode: '1105', subsidiary: 'تسویه ۴۲ واحد بلوک A/B/C', debit: 0, credit: 49_850_000 },
    ],
  },
  {
    id: 'je_104',
    voucherNo: 104,
    date: '۱۴۰۵/۰۸/۱۵',
    description: 'پرداخت حقوق و بیمه پرسنل لابی‌من و انتظامات گیت (آبان ۱۴۰۵)',
    source: 'manual',
    status: 'final',
    refCode: 'PAY-1405-08',
    lines: [
      { accountCode: '5104', description: 'حقوق ۳ نفر لابی‌من و نگهبانی', debit: 28_500_000, credit: 0 },
      { accountCode: '2104', description: 'حق بیمه تامین اجتماعی سهم کارفرما', debit: 0, credit: 4_200_000 },
      { accountCode: '1102', description: 'پرداخت خالص حقوق از پاسارگاد', debit: 0, credit: 24_300_000 },
    ],
  },
  {
    id: 'je_105',
    voucherNo: 105,
    date: '۱۴۰۵/۰۸/۲۰',
    description: 'ثبت سند پایا VCH-402-882 — اورهال بوسترپمپ آبرسانی بلوک B',
    source: 'petty_cash',
    status: 'final',
    refCode: 'VCH-402-882',
    lines: [
      { accountCode: '5102', subsidiary: 'پمپ‌سازان نوین', description: 'اورهال الکتروپمپ و سیم‌پیچی', debit: 18_500_000, credit: 0 },
      { accountCode: '2101', subsidiary: 'پمپ‌سازان نوین', description: 'بستانکاری پیمانکار بابت فاکتور ۸۸۲', debit: 0, credit: 18_500_000 },
    ],
  },
  {
    id: 'je_106',
    voucherNo: 106,
    date: '۱۴۰۵/۰۸/۲۴',
    description: 'پرداخت قبوض برق، آب و گاز مشاعات و سرویس نظافت دوره آبان',
    source: 'manual',
    status: 'draft',
    refCode: 'UTL-1405-08',
    lines: [
      { accountCode: '5101', description: 'قبوض انرژی مشاعات ۳ بلوک', debit: 7_400_000, credit: 0 },
      { accountCode: '5105', description: 'مواد شوینده و رسیدگی فضای سبز', debit: 3_650_000, credit: 0 },
      { accountCode: '1104', description: 'پرداخت از محل تنخواه بلوک B', debit: 0, credit: 3_650_000 },
      { accountCode: '1102', description: 'پرداخت قبوض از بانک پاسارگاد', debit: 0, credit: 7_400_000 },
    ],
  },
];

export const INITIAL_PENDING_RECEIPTS: PendingReceipt[] = [
  {
    id: 'rcp_1',
    unitCode: 'A-104',
    residentName: 'دکتر محمدی',
    amountTomans: 3_200_000,
    date: '۱۴۰۵/۰۸/۲۶',
    bankAccountCode: '1102',
    traceCode: 'پایا ۶۸۴۱۲۳',
    channel: 'انتقال پایا',
    approved: false,
  },
  {
    id: 'rcp_2',
    unitCode: 'B-208',
    residentName: 'آقای حسینی',
    amountTomans: 2_850_000,
    date: '۱۴۰۵/۰۸/۲۷',
    bankAccountCode: '1102',
    traceCode: 'کارت‌خوان مرکزی ۹۱۲۰',
    channel: 'کارت‌خوان لابی',
    approved: false,
  },
  {
    id: 'rcp_3',
    unitCode: 'C-301',
    residentName: 'خانم رضوی',
    amountTomans: 1_950_000,
    date: '۱۴۰۵/۰۸/۲۸',
    bankAccountCode: '1102',
    traceCode: 'فیش پاسارگاد ۴۴۰۹',
    channel: 'واریز بانکی',
    approved: false,
  },
];

export const INITIAL_SAYADI_CHECKS: SayadiCheck[] = [
  {
    id: 'chk_1',
    sayadiId: '4105882100492184',
    payee: 'شرکت آسانسور البرز',
    amountTomans: 24_000_000,
    dueDate: '۱۴۰۵/۰۹/۰۵',
    bankAccountCode: '1102',
    expenseAccountCode: '2102',
    status: 'registered',
  },
  {
    id: 'chk_2',
    sayadiId: '4105882100492219',
    payee: 'شرکت پمپ‌سازان نوین',
    amountTomans: 18_500_000,
    dueDate: '۱۴۰۵/۰۹/۱۲',
    bankAccountCode: '1103',
    expenseAccountCode: '2101',
    status: 'pending_sign',
  },
];

export const INITIAL_AGING_DEBTORS: Array<{
  unitCode: string;
  residentName: string;
  block: string;
  daysOverdue: number;
  principalTomans: number;
}> = [
  { unitCode: 'B-208', residentName: 'آقای حسینی', block: 'بلوک B', daysOverdue: 76, principalTomans: 6_400_000 },
  { unitCode: 'B-202', residentName: 'مهندس شریفی', block: 'بلوک B', daysOverdue: 98, principalTomans: 8_950_000 },
  { unitCode: 'A-104', residentName: 'دکتر محمدی', block: 'بلوک A', daysOverdue: 45, principalTomans: 4_850_000 },
  { unitCode: 'C-304', residentName: 'خانم نوری', block: 'بلوک C', daysOverdue: 22, principalTomans: 3_800_000 },
];

export interface TrialBalanceRow {
  account: ChartAccount;
  turnoverDebit: number;
  turnoverCredit: number;
  endingDebit: number;
  endingCredit: number;
}

export interface TrialBalanceSummary {
  rows: TrialBalanceRow[];
  totalTurnoverDebit: number;
  totalTurnoverCredit: number;
  totalEndingDebit: number;
  totalEndingCredit: number;
  isBalanced: boolean;
}

export function validateJournalEntry(lines: JournalLine[]): {
  totalDebit: number;
  totalCredit: number;
  diff: number;
  isBalanced: boolean;
  isValid: boolean;
} {
  const clean = lines.filter((l) => l.accountCode && (l.debit > 0 || l.credit > 0));
  const totalDebit = clean.reduce((acc, l) => acc + Math.max(0, Number(l.debit) || 0), 0);
  const totalCredit = clean.reduce((acc, l) => acc + Math.max(0, Number(l.credit) || 0), 0);
  const diff = totalDebit - totalCredit;
  const isBalanced = diff === 0 && totalDebit > 0;
  return {
    totalDebit,
    totalCredit,
    diff,
    isBalanced,
    isValid: isBalanced && clean.length >= 2,
  };
}

export function computeTrialBalance(entries: JournalEntry[]): TrialBalanceSummary {
  const agg: Record<string, { debit: number; credit: number }> = {};
  for (const acc of CHART_OF_ACCOUNTS) {
    agg[acc.code] = { debit: 0, credit: 0 };
  }
  for (const je of entries) {
    for (const line of je.lines) {
      if (!agg[line.accountCode]) {
        agg[line.accountCode] = { debit: 0, credit: 0 };
      }
      agg[line.accountCode].debit += Math.max(0, Number(line.debit) || 0);
      agg[line.accountCode].credit += Math.max(0, Number(line.credit) || 0);
    }
  }

  const rows: TrialBalanceRow[] = CHART_OF_ACCOUNTS.map((account) => {
    const { debit, credit } = agg[account.code] || { debit: 0, credit: 0 };
    const net = debit - credit;
    return {
      account,
      turnoverDebit: debit,
      turnoverCredit: credit,
      endingDebit: net > 0 ? net : 0,
      endingCredit: net < 0 ? Math.abs(net) : 0,
    };
  }).filter((r) => r.turnoverDebit > 0 || r.turnoverCredit > 0);

  const totalTurnoverDebit = rows.reduce((s, r) => s + r.turnoverDebit, 0);
  const totalTurnoverCredit = rows.reduce((s, r) => s + r.turnoverCredit, 0);
  const totalEndingDebit = rows.reduce((s, r) => s + r.endingDebit, 0);
  const totalEndingCredit = rows.reduce((s, r) => s + r.endingCredit, 0);

  return {
    rows,
    totalTurnoverDebit,
    totalTurnoverCredit,
    totalEndingDebit,
    totalEndingCredit,
    isBalanced: totalTurnoverDebit === totalTurnoverCredit && totalEndingDebit === totalEndingCredit,
  };
}

export interface LedgerCardexLine {
  voucherNo: number;
  date: string;
  description: string;
  subsidiary?: string;
  debit: number;
  credit: number;
  runningBalance: number;
  balanceSide: 'بد' | 'بس' | 'صفر';
}

export function computeAccountLedger(
  entries: JournalEntry[],
  accountCode: string,
): {
  account: ChartAccount | undefined;
  lines: LedgerCardexLine[];
  totalDebit: number;
  totalCredit: number;
  endingBalance: number;
  endingSide: 'بد' | 'بس' | 'صفر';
} {
  const account = ACCOUNT_BY_CODE[accountCode];
  let running = 0;
  let totalDebit = 0;
  let totalCredit = 0;
  const lines: LedgerCardexLine[] = [];

  for (const je of entries) {
    for (const ln of je.lines) {
      if (ln.accountCode !== accountCode) continue;
      const d = Math.max(0, Number(ln.debit) || 0);
      const c = Math.max(0, Number(ln.credit) || 0);
      totalDebit += d;
      totalCredit += c;
      running += d - c;
      lines.push({
        voucherNo: je.voucherNo,
        date: je.date,
        description: ln.description || je.description,
        subsidiary: ln.subsidiary,
        debit: d,
        credit: c,
        runningBalance: Math.abs(running),
        balanceSide: running > 0 ? 'بد' : running < 0 ? 'بس' : 'صفر',
      });
    }
  }

  return {
    account,
    lines,
    totalDebit,
    totalCredit,
    endingBalance: Math.abs(running),
    endingSide: running > 0 ? 'بد' : running < 0 ? 'بس' : 'صفر',
  };
}

export interface FinancialStatements {
  revenues: Array<{ code: string; title: string; amount: number }>;
  expenses: Array<{ code: string; title: string; amount: number }>;
  totalRevenue: number;
  totalExpense: number;
  netSurplus: number;
  assets: Array<{ code: string; title: string; amount: number }>;
  liabilities: Array<{ code: string; title: string; amount: number }>;
  equities: Array<{ code: string; title: string; amount: number }>;
  totalAssets: number;
  totalLiabilities: number;
  totalEquityWithSurplus: number;
  balanceSheetBalanced: boolean;
}

export function computeFinancialStatements(entries: JournalEntry[]): FinancialStatements {
  const tb = computeTrialBalance(entries);
  const revenues: Array<{ code: string; title: string; amount: number }> = [];
  const expenses: Array<{ code: string; title: string; amount: number }> = [];
  const assets: Array<{ code: string; title: string; amount: number }> = [];
  const liabilities: Array<{ code: string; title: string; amount: number }> = [];
  const equities: Array<{ code: string; title: string; amount: number }> = [];

  for (const row of tb.rows) {
    const netCredit = row.endingCredit - row.endingDebit;
    const netDebit = row.endingDebit - row.endingCredit;
    if (row.account.group === 'revenue') {
      revenues.push({ code: row.account.code, title: row.account.title, amount: netCredit });
    } else if (row.account.group === 'expense') {
      expenses.push({ code: row.account.code, title: row.account.title, amount: netDebit });
    } else if (row.account.group === 'asset') {
      assets.push({ code: row.account.code, title: row.account.title, amount: netDebit });
    } else if (row.account.group === 'liability') {
      liabilities.push({ code: row.account.code, title: row.account.title, amount: netCredit });
    } else if (row.account.group === 'equity') {
      equities.push({ code: row.account.code, title: row.account.title, amount: netCredit });
    }
  }

  const totalRevenue = revenues.reduce((s, r) => s + r.amount, 0);
  const totalExpense = expenses.reduce((s, r) => s + r.amount, 0);
  const netSurplus = totalRevenue - totalExpense;

  const totalAssets = assets.reduce((s, r) => s + r.amount, 0);
  const totalLiabilities = liabilities.reduce((s, r) => s + r.amount, 0);
  const baseEquity = equities.reduce((s, r) => s + r.amount, 0);
  const totalEquityWithSurplus = baseEquity + netSurplus;

  return {
    revenues,
    expenses,
    totalRevenue,
    totalExpense,
    netSurplus,
    assets,
    liabilities,
    equities,
    totalAssets,
    totalLiabilities,
    totalEquityWithSurplus,
    balanceSheetBalanced: totalAssets === totalLiabilities + totalEquityWithSurplus,
  };
}

/** Compute A/R Aging with optional monthly late penalty rate (default 2% per 30 days overdue > 30d). */
export function computeAgingReport(
  debtors: typeof INITIAL_AGING_DEBTORS,
  monthlyPenaltyPct = 2,
): AgingRow[] {
  return debtors.map((d) => {
    const bucket: AgingRow['bucket'] =
      d.daysOverdue <= 30
        ? '0-30'
        : d.daysOverdue <= 60
          ? '31-60'
          : d.daysOverdue <= 90
            ? '61-90'
            : '90+';
    const lateMonths = d.daysOverdue > 30 ? Math.floor((d.daysOverdue - 1) / 30) : 0;
    const penaltyTomans = Math.round(
      d.principalTomans * (monthlyPenaltyPct / 100) * lateMonths,
    );
    return {
      ...d,
      bucket,
      penaltyTomans,
      totalTomans: d.principalTomans + penaltyTomans,
      article10Eligible: d.daysOverdue >= 60,
    };
  });
}

export function buildTrialBalanceCsv(tb: TrialBalanceSummary): string {
  const header = 'کد معین,عنوان حساب,گروه,گردش بدهکار (تومان),گردش بستانکار (تومان),مانده بدهکار (تومان),مانده بستانکار (تومان)\n';
  const rows = tb.rows
    .map(
      (r) =>
        `"${r.account.code}","${r.account.title}","${ACCOUNT_GROUP_LABELS[r.account.group]}",${r.turnoverDebit},${r.turnoverCredit},${r.endingDebit},${r.endingCredit}`,
    )
    .join('\n');
  const total = `\n"جمع کل","","",${tb.totalTurnoverDebit},${tb.totalTurnoverCredit},${tb.totalEndingDebit},${tb.totalEndingCredit}`;
  return '\uFEFF' + header + rows + total;
}

export function buildJournalCsv(entries: JournalEntry[]): string {
  const header = 'شماره سند,تاریخ,وضعیت,کد حساب,عنوان حساب,تفصیلی,شرح ردیف,بدهکار (تومان),بستانکار (تومان)\n';
  const lines: string[] = [];
  for (const je of entries) {
    for (const ln of je.lines) {
      const title = ACCOUNT_BY_CODE[ln.accountCode]?.title ?? ln.accountCode;
      lines.push(
        `${je.voucherNo},"${je.date}","${je.status === 'final' ? 'قطعی' : 'موقت'}","${ln.accountCode}","${title}","${ln.subsidiary || ''}","${(ln.description || je.description).replace(/"/g, '""')}",${ln.debit},${ln.credit}`,
      );
    }
  }
  return '\uFEFF' + header + lines.join('\n');
}
