import React, { useEffect, useMemo, useState } from 'react';
import {
  ACCOUNT_BY_CODE,
  ACCOUNT_GROUP_LABELS,
  buildJournalCsv,
  buildTrialBalanceCsv,
  CHART_OF_ACCOUNTS,
  computeAccountLedger,
  computeAgingReport,
  computeFinancialStatements,
  computeTrialBalance,
  INITIAL_AGING_DEBTORS,
  INITIAL_JOURNAL_ENTRIES,
  INITIAL_PENDING_RECEIPTS,
  INITIAL_SAYADI_CHECKS,
  validateJournalEntry,
  type AccountGroup,
  type JournalEntry,
  type JournalLine,
  type PendingReceipt,
  type SayadiCheck,
} from '../accounting/accountingEngine';
import {
  EmptyState,
  HeroSummaryCard,
  SectionHeader,
  StatusPill,
  StitchButton,
  StitchModal,
  SubMenuTabs,
  SurfaceCard,
} from '../ui/StitchKit';

interface Props {
  onNavigate?: (route: string) => void;
  onFeedback: (msg: string) => void;
}

const STORAGE_KEY = 'niloofar_accounting_suite_v1';

interface AccountingPersistedState {
  entries: JournalEntry[];
  receipts: PendingReceipt[];
  checks: SayadiCheck[];
  penaltyRatePct: number;
  issuedLegalUnits: string[];
}

function loadInitialState(): AccountingPersistedState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AccountingPersistedState>;
      if (Array.isArray(parsed.entries) && parsed.entries.length > 0) {
        return {
          entries: parsed.entries,
          receipts: parsed.receipts ?? INITIAL_PENDING_RECEIPTS,
          checks: parsed.checks ?? INITIAL_SAYADI_CHECKS,
          penaltyRatePct: typeof parsed.penaltyRatePct === 'number' ? parsed.penaltyRatePct : 2,
          issuedLegalUnits: parsed.issuedLegalUnits ?? [],
        };
      }
    }
  } catch {
    /* ignore */
  }
  return {
    entries: INITIAL_JOURNAL_ENTRIES,
    receipts: INITIAL_PENDING_RECEIPTS,
    checks: INITIAL_SAYADI_CHECKS,
    penaltyRatePct: 2,
    issuedLegalUnits: [],
  };
}

const fmtT = (n: number) => Math.round(n).toLocaleString('fa-IR');
const fmtM = (n: number) =>
  `${(n / 1_000_000).toLocaleString('fa-IR', { maximumFractionDigits: 1 })}`;

function downloadCsv(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const FinanceAccountantTab: React.FC<Props> = ({ onNavigate, onFeedback }) => {
  const [accState, setAccState] = useState<AccountingPersistedState>(() => loadInitialState());
  const [deskTab, setDeskTab] = useState<'journal' | 'ledger' | 'reports' | 'treasury'>('journal');
  const [reportView, setReportView] = useState<'tb' | 'pl' | 'bs' | 'aging'>('tb');

  // Journal filters & modals
  const [journalQuery, setJournalQuery] = useState('');
  const [viewingVoucher, setViewingVoucher] = useState<JournalEntry | null>(null);
  const [showNewVoucher, setShowNewVoucher] = useState(false);

  // New double-entry voucher builder state
  const [vDate, setVDate] = useState('۱۴۰۵/۰۸/۲۹');
  const [vDesc, setVDesc] = useState('');
  const [vLines, setVLines] = useState<JournalLine[]>([
    { accountCode: '5102', subsidiary: '', description: '', debit: 0, credit: 0 },
    { accountCode: '1102', subsidiary: '', description: '', debit: 0, credit: 0 },
  ]);

  // Ledger / Chart of Accounts state
  const [selectedGroup, setSelectedGroup] = useState<'all' | AccountGroup>('all');
  const [selectedAccountCode, setSelectedAccountCode] = useState<string>('1102');

  // New Sayadi check modal state
  const [showNewCheck, setShowNewCheck] = useState(false);
  const [chkPayee, setChkPayee] = useState('');
  const [chkSayadiId, setChkSayadiId] = useState('4105882100493011');
  const [chkAmount, setChkAmount] = useState('12000000');
  const [chkDue, setChkDue] = useState('۱۴۰۵/۰۹/۲۵');
  const [chkExpenseCode, setChkExpenseCode] = useState('5103');

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(accState));
    } catch {
      /* ignore */
    }
  }, [accState]);

  const trialBalance = useMemo(() => computeTrialBalance(accState.entries), [accState.entries]);
  const statements = useMemo(
    () => computeFinancialStatements(accState.entries),
    [accState.entries],
  );
  const activeCardex = useMemo(
    () => computeAccountLedger(accState.entries, selectedAccountCode),
    [accState.entries, selectedAccountCode],
  );
  const agingRows = useMemo(
    () => computeAgingReport(INITIAL_AGING_DEBTORS, accState.penaltyRatePct),
    [accState.penaltyRatePct],
  );

  const bankTotal = useMemo(() => {
    const pasar = computeAccountLedger(accState.entries, '1102');
    const saman = computeAccountLedger(accState.entries, '1103');
    return (
      (pasar.endingSide === 'بد' ? pasar.endingBalance : -pasar.endingBalance) +
      (saman.endingSide === 'بد' ? saman.endingBalance : -saman.endingBalance)
    );
  }, [accState.entries]);

  const arTotal = useMemo(() => {
    const ar = computeAccountLedger(accState.entries, '1105');
    return ar.endingSide === 'بد' ? ar.endingBalance : 0;
  }, [accState.entries]);

  const pendingReceiptsCount = accState.receipts.filter((r) => !r.approved).length;
  const openChecksCount = accState.checks.filter((c) => c.status !== 'cleared').length;

  const nextVoucherNo = useMemo(
    () => Math.max(100, ...accState.entries.map((e) => e.voucherNo)) + 1,
    [accState.entries],
  );

  const voucherValidation = useMemo(() => validateJournalEntry(vLines), [vLines]);

  const appendVoucher = (
    entry: Omit<JournalEntry, 'id' | 'voucherNo'>,
    updater?: (prev: AccountingPersistedState, vNo: number) => Partial<AccountingPersistedState>,
  ) => {
    setAccState((prev) => {
      const vNo = Math.max(100, ...prev.entries.map((e) => e.voucherNo)) + 1;
      const created: JournalEntry = {
        ...entry,
        id: `je_${vNo}_${Date.now()}`,
        voucherNo: vNo,
      };
      const extra = updater ? updater(prev, vNo) : {};
      return {
        ...prev,
        ...extra,
        entries: [created, ...prev.entries],
      };
    });
  };

  const handleSaveManualVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!voucherValidation.isValid) return;
    const cleanLines = vLines.filter((l) => l.accountCode && (l.debit > 0 || l.credit > 0));
    appendVoucher({
      date: vDate,
      description: vDesc.trim() || `سند حسابداری شماره ${fmtT(nextVoucherNo)}`,
      source: 'manual',
      status: 'draft',
      lines: cleanLines,
    });
    setShowNewVoucher(false);
    setVDesc('');
    setVLines([
      { accountCode: '5102', subsidiary: '', description: '', debit: 0, credit: 0 },
      { accountCode: '1102', subsidiary: '', description: '', debit: 0, credit: 0 },
    ]);
    onFeedback(`سند دوطرفه شماره #${fmtT(nextVoucherNo)} با تراز صفر در دفتر روزنامه ثبت شد.`);
  };

  const handleAutoBalanceLastLine = () => {
    setVLines((prev) => {
      if (prev.length < 2) return prev;
      const head = prev.slice(0, -1);
      const debitSum = head.reduce((s, l) => s + (Number(l.debit) || 0), 0);
      const creditSum = head.reduce((s, l) => s + (Number(l.credit) || 0), 0);
      const diff = debitSum - creditSum;
      const last = { ...prev[prev.length - 1] };
      if (diff > 0) {
        last.debit = 0;
        last.credit = diff;
      } else if (diff < 0) {
        last.debit = Math.abs(diff);
        last.credit = 0;
      }
      return [...head, last];
    });
  };

  const handleFinalizeVoucher = (id: string) => {
    setAccState((prev) => ({
      ...prev,
      entries: prev.entries.map((je) => (je.id === id ? { ...je, status: 'final' } : je)),
    }));
    setViewingVoucher((cur) => (cur && cur.id === id ? { ...cur, status: 'final' } : cur));
    onFeedback('وضعیت سند به «قطعی» تغییر یافت و در دفاتر قانونی قفل شد.');
  };

  const handleReverseVoucher = (je: JournalEntry) => {
    const reversedLines: JournalLine[] = je.lines.map((ln) => ({
      ...ln,
      debit: ln.credit,
      credit: ln.debit,
      description: `برگشت ردیف سند #${fmtT(je.voucherNo)}`,
    }));
    appendVoucher({
      date: '۱۴۰۵/۰۸/۲۹',
      description: `سند اصلاحی / برگشت سند شماره #${fmtT(je.voucherNo)}`,
      source: 'reversal',
      status: 'final',
      refCode: `REV-${je.voucherNo}`,
      lines: reversedLines,
    });
    setViewingVoucher(null);
    onFeedback(`سند برگشت (استورنو) برای سند #${fmtT(je.voucherNo)} صادر شد.`);
  };

  const handlePostMonthlyChargeAccrual = () => {
    appendVoucher({
      date: '۱۴۰۵/۰۹/۰۱',
      description: 'سند شناسایی درآمد شارژ آذر ۱۴۰۵ (۴۸ واحد — ۳ بلوک)',
      source: 'charge',
      status: 'draft',
      refCode: 'CHG-1405-09',
      lines: [
        { accountCode: '1105', subsidiary: 'کل واحدهای مجتمع (۴۸ واحد)', description: 'بدهکاری شارژ آذر', debit: 54_000_000, credit: 0 },
        { accountCode: '4101', description: 'درآمد شارژ جاری آذر', debit: 0, credit: 45_000_000 },
        { accountCode: '4102', description: 'سهم اندوخته عمرانی آذر', debit: 0, credit: 9_000_000 },
      ],
    });
    onFeedback('سند جمعی شارژ آذر ۱۴۰۵ (۵۴ میلیون تومان) در دفتر روزنامه ثبت شد.');
  };

  const handleApproveReceipt = (rcp: PendingReceipt) => {
    appendVoucher(
      {
        date: rcp.date,
        description: `وصول شارژ واحد ${rcp.unitCode} (${rcp.residentName}) — ${rcp.traceCode}`,
        source: 'receipt',
        status: 'final',
        refCode: rcp.traceCode,
        lines: [
          {
            accountCode: rcp.bankAccountCode,
            description: `واریز ${rcp.channel} (${rcp.traceCode})`,
            debit: rcp.amountTomans,
            credit: 0,
          },
          {
            accountCode: '1105',
            subsidiary: `واحد ${rcp.unitCode} (${rcp.residentName})`,
            description: 'تسویه بدهی شارژ ساکن',
            debit: 0,
            credit: rcp.amountTomans,
          },
        ],
      },
      (prev, vNo) => ({
        receipts: prev.receipts.map((item) =>
          item.id === rcp.id ? { ...item, approved: true, voucherNo: vNo } : item,
        ),
      }),
    );
    onFeedback(
      `فیش واحد ${rcp.unitCode} تایید شد و سند شماره #${fmtT(nextVoucherNo)} خودکار در دفاتر ثبت گردید.`,
    );
  };

  const handleClearCheck = (chk: SayadiCheck) => {
    appendVoucher(
      {
        date: '۱۴۰۵/۰۸/۲۹',
        description: `پاس شدن چک صیادی ${chk.sayadiId} در وجه ${chk.payee}`,
        source: 'check',
        status: 'final',
        refCode: chk.sayadiId.slice(-6),
        lines: [
          {
            accountCode: chk.expenseAccountCode,
            subsidiary: chk.payee,
            description: `تسویه تعهد چک صیادی`,
            debit: chk.amountTomans,
            credit: 0,
          },
          {
            accountCode: chk.bankAccountCode,
            description: `برداشت چک صیادی ${chk.sayadiId.slice(-6)}`,
            debit: 0,
            credit: chk.amountTomans,
          },
        ],
      },
      (prev, vNo) => ({
        checks: prev.checks.map((c) =>
          c.id === chk.id ? { ...c, status: 'cleared', voucherNo: vNo } : c,
        ),
      }),
    );
    onFeedback(`چک صیادی ${chk.payee} پاس شد و سند پرداخت خودکار ثبت گردید.`);
  };

  const handleRegisterCheck = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Math.max(100_000, Number(chkAmount) || 0);
    const created: SayadiCheck = {
      id: `chk_${Date.now()}`,
      sayadiId: chkSayadiId.replace(/\D/g, '').slice(0, 16) || '4105882100493099',
      payee: chkPayee.trim() || 'پیمانکار مجتمع',
      amountTomans: amt,
      dueDate: chkDue,
      bankAccountCode: '1102',
      expenseAccountCode: '2102',
      status: 'registered',
    };
    appendVoucher(
      {
        date: '۱۴۰۵/۰۸/۲۹',
        description: `صدور چک صیادی به نام ${created.payee} (سررسید ${created.dueDate})`,
        source: 'check',
        status: 'final',
        refCode: created.sayadiId.slice(-6),
        lines: [
          {
            accountCode: chkExpenseCode,
            subsidiary: created.payee,
            description: 'شناسایی هزینه / تعهد پیمانکار',
            debit: amt,
            credit: 0,
          },
          {
            accountCode: '2102',
            subsidiary: created.payee,
            description: `چک صیادی ${created.sayadiId}`,
            debit: 0,
            credit: amt,
          },
        ],
      },
      (prev, vNo) => ({
        checks: [{ ...created, voucherNo: vNo }, ...prev.checks],
      }),
    );
    setShowNewCheck(false);
    setChkPayee('');
    onFeedback(`چک صیادی در وجه «${created.payee}» ثبت و سند آن در دفتر روزنامه صادر شد.`);
  };

  const filteredEntries = useMemo(() => {
    const q = journalQuery.trim();
    if (!q) return accState.entries;
    return accState.entries.filter(
      (je) =>
        je.description.includes(q) ||
        String(je.voucherNo).includes(q) ||
        (je.refCode && je.refCode.includes(q)) ||
        je.lines.some(
          (l) =>
            l.accountCode.includes(q) ||
            (l.subsidiary && l.subsidiary.includes(q)) ||
            (ACCOUNT_BY_CODE[l.accountCode]?.title.includes(q) ?? false),
        ),
    );
  }, [accState.entries, journalQuery]);

  const visibleAccounts = useMemo(
    () =>
      CHART_OF_ACCOUNTS.filter((a) => selectedGroup === 'all' || a.group === selectedGroup),
    [selectedGroup],
  );

  return (
    <div className="space-y-3.5 m-panel-in">
      {/* Live Computed Accounting KPI Hero */}
      <HeroSummaryCard
        title="سامانه جامع حسابداری دوطرفه شهرک"
        subtitle={`سال مالی ۱۴۰۵ • ${fmtT(accState.entries.length)} سند ثبت‌شده • کدینگ استاندارد`}
        badge={trialBalance.isBalanced ? 'تراز کامل ✓' : 'عدم تراز'}
        stats={[
          { label: 'بانک‌ها (م.ت)', value: fmtM(bankTotal) },
          {
            label: 'مازاد دوره (م.ت)',
            value: `${statements.netSurplus >= 0 ? '+' : ''}${fmtM(statements.netSurplus)}`,
            accent: statements.netSurplus >= 0 ? 'positive' : 'danger',
          },
          { label: 'مطالبات (م.ت)', value: fmtM(arTotal), accent: 'danger' },
        ]}
      />

      {/* 4 Clean Sub-Menus for the Full Accounting Suite */}
      <SubMenuTabs
        active={deskTab}
        onChange={(id) => setDeskTab(id as typeof deskTab)}
        items={[
          { id: 'journal', label: 'اسناد و روزنامه', icon: 'menu_book', badge: accState.entries.length },
          { id: 'ledger', label: 'کدینگ و دفاتر', icon: 'account_tree' },
          { id: 'reports', label: 'تراز و صورت مالی', icon: 'monitoring' },
          {
            id: 'treasury',
            label: 'خزانه و صیادی',
            icon: 'payments',
            badge: pendingReceiptsCount + openChecksCount,
          },
        ]}
      />

      {/* ================================================================
          SUB 1: JOURNAL BOOK & DOUBLE-ENTRY VOUCHERS (دفتر روزنامه)
          ================================================================ */}
      {deskTab === 'journal' && (
        <div className="space-y-3 m-panel-in">
          <div className="flex items-center gap-2 flex-wrap">
            <StitchButton icon="add" onClick={() => setShowNewVoucher(true)}>
              ثبت سند دوطرفه
            </StitchButton>
            <StitchButton variant="secondary" icon="receipt_long" onClick={handlePostMonthlyChargeAccrual}>
              سند شارژ آذر
            </StitchButton>
            <StitchButton
              variant="secondary"
              icon="sim_card_download"
              onClick={() => {
                downloadCsv('niloofar-journal-1405.csv', buildJournalCsv(accState.entries));
                onFeedback('فایل اکسل دفتر روزنامه (CSV) دانلود شد.');
              }}
            >
              اکسل روزنامه
            </StitchButton>
          </div>

          <div className="relative">
            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">
              search
            </span>
            <input
              type="text"
              aria-label="جستجو در اسناد روزنامه"
              value={journalQuery}
              onChange={(e) => setJournalQuery(e.target.value)}
              placeholder="جستجوی شماره سند، شرح، کد معین یا تفصیلی..."
              className="w-full h-11 pr-9 pl-3 rounded-xl bg-surface-container-lowest text-[13px] border border-outline-variant/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
            />
          </div>

          {filteredEntries.length === 0 ? (
            <EmptyState
              icon="menu_book"
              title="سندی با این جستجو یافت نشد"
              actionLabel="پاک کردن جستجو"
              onAction={() => setJournalQuery('')}
            />
          ) : (
            <div className="space-y-2.5 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
              {filteredEntries.map((je) => {
                const total = je.lines.reduce((s, l) => s + l.debit, 0);
                return (
                  <SurfaceCard key={je.id} className="p-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-bold text-primary font-numeric-stat">
                            سند #{fmtT(je.voucherNo)}
                          </span>
                          <span className="text-[12px] text-on-surface-variant font-numeric-stat">
                            {je.date}
                          </span>
                        </div>
                        <h3 className="text-[14px] font-semibold text-on-surface mb-0 mt-0.5 truncate">
                          {je.description}
                        </h3>
                      </div>
                      <StatusPill
                        label={je.status === 'final' ? 'قطعی' : 'موقت'}
                        tone={je.status === 'final' ? 'positive' : 'primary'}
                      />
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-surface-container-high gap-2 text-[12.5px]">
                      <span className="text-on-surface-variant font-numeric-stat">
                        {fmtT(je.lines.length)} آرتیکل •{' '}
                        <strong className="text-on-surface">{fmtT(total)} ت</strong>
                      </span>
                      <StitchButton
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewingVoucher(je)}
                      >
                        مشاهده آرتیکل‌ها
                      </StitchButton>
                    </div>
                  </SurfaceCard>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================================================================
          SUB 2: CHART OF ACCOUNTS & ACCOUNT LEDGER CARDEX (کدینگ و دفاتر)
          ================================================================ */}
      {deskTab === 'ledger' && (
        <div className="space-y-3.5 m-panel-in lg:grid lg:grid-cols-12 lg:gap-4 lg:space-y-0 lg:items-start">
          {/* Chart of Accounts Column */}
          <SurfaceCard className="space-y-3 lg:col-span-5">
            <SectionHeader title="کدینگ حساب‌ها (کل / معین)" icon="account_tree" />
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {(['all', 'asset', 'liability', 'equity', 'revenue', 'expense'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setSelectedGroup(g)}
                  className={`h-7 px-2.5 rounded-lg text-[11.5px] font-medium whitespace-nowrap transition-colors ${
                    selectedGroup === g
                      ? 'bg-primary-container text-on-primary-container font-semibold'
                      : 'bg-surface-container-low text-on-surface-variant'
                  }`}
                >
                  {g === 'all' ? 'همه' : ACCOUNT_GROUP_LABELS[g]}
                </button>
              ))}
            </div>

            <div className="divide-y divide-surface-container-high max-h-[340px] overflow-y-auto">
              {visibleAccounts.map((acc) => {
                const ldg = computeAccountLedger(accState.entries, acc.code);
                const isSelected = acc.code === selectedAccountCode;
                return (
                  <button
                    key={acc.code}
                    type="button"
                    onClick={() => setSelectedAccountCode(acc.code)}
                    className={`w-full py-2 px-2 flex items-center justify-between gap-2 text-right rounded-lg transition-colors ${
                      isSelected ? 'bg-primary-container/55' : 'hover:bg-surface-container-low/60'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-[11.5px] font-bold text-primary font-numeric-stat ml-1.5">
                        {acc.code}
                      </span>
                      <span className="text-[13px] font-medium text-on-surface truncate">
                        {acc.title}
                      </span>
                    </div>
                    <span className="text-[12px] font-bold font-numeric-stat text-on-surface shrink-0">
                      {fmtT(ldg.endingBalance)}{' '}
                      <span className="text-[10.5px] text-on-surface-variant font-normal">
                        {ldg.endingSide}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </SurfaceCard>

          {/* Interactive Account Ledger Cardex */}
          <SurfaceCard className="space-y-3 lg:col-span-7">
            <SectionHeader
              title={
                activeCardex.account
                  ? `دفتر معین ${activeCardex.account.code} — ${activeCardex.account.title}`
                  : 'کاردکس حساب'
              }
              icon="receipt_long"
              action={
                <StatusPill
                  label={`مانده: ${fmtT(activeCardex.endingBalance)} ت (${activeCardex.endingSide})`}
                  tone={activeCardex.endingSide === 'بد' ? 'primary' : 'positive'}
                />
              }
            />

            {activeCardex.lines.length === 0 ? (
              <p className="text-[13px] text-on-surface-variant text-center py-6 mb-0">
                گردشی برای این حساب ثبت نشده است.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-surface-container-high">
                <table className="w-full text-right border-collapse text-[12px]">
                  <thead>
                    <tr className="bg-surface-container-low text-on-surface-variant border-b border-surface-container-high">
                      <th className="py-2 px-2 font-semibold">سند / تاریخ</th>
                      <th className="py-2 px-2 font-semibold">شرح و تفصیلی</th>
                      <th className="py-2 px-2 font-semibold text-left">بدهکار</th>
                      <th className="py-2 px-2 font-semibold text-left">بستانکار</th>
                      <th className="py-2 px-2 font-semibold text-left">مانده</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container-high font-numeric-stat">
                    {activeCardex.lines.map((ln, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-2 whitespace-nowrap">
                          <strong className="text-primary">#{fmtT(ln.voucherNo)}</strong>
                          <span className="block text-[10.5px] text-on-surface-variant">{ln.date}</span>
                        </td>
                        <td className="py-2 px-2 max-w-[180px]">
                          <span className="block text-on-surface truncate">{ln.description}</span>
                          {ln.subsidiary && (
                            <span className="block text-[11px] text-on-surface-variant truncate">
                              تفصیلی: {ln.subsidiary}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-left text-on-surface">
                          {ln.debit > 0 ? fmtT(ln.debit) : '—'}
                        </td>
                        <td className="py-2 px-2 text-left text-secondary">
                          {ln.credit > 0 ? fmtT(ln.credit) : '—'}
                        </td>
                        <td className="py-2 px-2 text-left font-bold whitespace-nowrap">
                          {fmtT(ln.runningBalance)}{' '}
                          <span className="text-[10px] font-normal text-on-surface-variant">
                            {ln.balanceSide}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SurfaceCard>
        </div>
      )}

      {/* ================================================================
          SUB 3: TRIAL BALANCE, INCOME STATEMENT, BALANCE SHEET & AGING
          ================================================================ */}
      {deskTab === 'reports' && (
        <div className="space-y-3 m-panel-in">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {[
                { id: 'tb', label: 'تراز آزمایشی' },
                { id: 'pl', label: 'درآمد و هزینه' },
                { id: 'bs', label: 'ترازنامه' },
                { id: 'aging', label: 'سنی معوقات' },
              ].map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setReportView(r.id as typeof reportView)}
                  className={`h-8 px-3 rounded-xl text-[12px] font-medium whitespace-nowrap active:scale-[0.96] transition-[transform,background-color] duration-150 ${
                    reportView === r.id
                      ? 'bg-primary-container text-on-primary-container font-bold'
                      : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant/45'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <StitchButton
                variant="secondary"
                size="sm"
                icon="sim_card_download"
                onClick={() => {
                  downloadCsv('niloofar-trial-balance-1405.csv', buildTrialBalanceCsv(trialBalance));
                  onFeedback('فایل تراز آزمایشی ۴ ستونه (CSV) دانلود شد.');
                }}
              >
                اکسل تراز
              </StitchButton>
              <StitchButton variant="secondary" size="sm" icon="print" onClick={() => window.print()}>
                چاپ
              </StitchButton>
            </div>
          </div>

          {/* REPORT A: 4-Column Trial Balance */}
          {reportView === 'tb' && (
            <SurfaceCard className="space-y-3 m-panel-in">
              <SectionHeader
                title="تراز آزمایشی ۴ ستونه (گردش و مانده)"
                icon="balance"
                action={
                  <StatusPill
                    label={trialBalance.isBalanced ? 'متوازن (اختلاف ۰)' : 'نامتوازن'}
                    tone={trialBalance.isBalanced ? 'positive' : 'danger'}
                  />
                }
              />
              <div className="overflow-x-auto rounded-xl border border-surface-container-high">
                <table className="w-full text-right border-collapse text-[11.5px]">
                  <thead>
                    <tr className="bg-surface-container-low text-on-surface-variant border-b border-surface-container-high">
                      <th className="py-2 px-2 font-semibold">کد / عنوان حساب</th>
                      <th className="py-2 px-2 font-semibold text-left">گردش بد</th>
                      <th className="py-2 px-2 font-semibold text-left">گردش بس</th>
                      <th className="py-2 px-2 font-semibold text-left">مانده بد</th>
                      <th className="py-2 px-2 font-semibold text-left">مانده بس</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container-high font-numeric-stat">
                    {trialBalance.rows.map((r) => (
                      <tr key={r.account.code} className="hover:bg-surface-container-low/40">
                        <td className="py-2 px-2">
                          <span className="text-primary font-bold ml-1">{r.account.code}</span>
                          <span className="text-on-surface font-medium">{r.account.title}</span>
                        </td>
                        <td className="py-2 px-2 text-left">{fmtT(r.turnoverDebit)}</td>
                        <td className="py-2 px-2 text-left">{fmtT(r.turnoverCredit)}</td>
                        <td className="py-2 px-2 text-left font-bold text-on-surface">
                          {r.endingDebit > 0 ? fmtT(r.endingDebit) : '—'}
                        </td>
                        <td className="py-2 px-2 text-left font-bold text-secondary">
                          {r.endingCredit > 0 ? fmtT(r.endingCredit) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-primary-container/35 font-bold text-on-surface border-t-2 border-outline-variant/50 font-numeric-stat">
                      <td className="py-2.5 px-2">جمع کل تراز آزمایشی</td>
                      <td className="py-2.5 px-2 text-left">{fmtT(trialBalance.totalTurnoverDebit)}</td>
                      <td className="py-2.5 px-2 text-left">{fmtT(trialBalance.totalTurnoverCredit)}</td>
                      <td className="py-2.5 px-2 text-left">{fmtT(trialBalance.totalEndingDebit)}</td>
                      <td className="py-2.5 px-2 text-left">{fmtT(trialBalance.totalEndingCredit)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </SurfaceCard>
          )}

          {/* REPORT B: Income & Expense Statement */}
          {reportView === 'pl' && (
            <div className="space-y-3 m-panel-in lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
              <SurfaceCard className="space-y-2.5">
                <SectionHeader
                  title="درآمدهای دوره"
                  icon="trending_up"
                  action={<StatusPill label={`${fmtT(statements.totalRevenue)} ت`} tone="positive" />}
                />
                <div className="divide-y divide-surface-container-high text-[13px]">
                  {statements.revenues.map((r) => (
                    <div key={r.code} className="py-2 flex items-center justify-between gap-2">
                      <span className="text-on-surface truncate">
                        <span className="text-primary font-numeric-stat ml-1">{r.code}</span>
                        {r.title}
                      </span>
                      <strong className="font-numeric-stat text-secondary shrink-0">
                        {fmtT(r.amount)} ت
                      </strong>
                    </div>
                  ))}
                </div>
              </SurfaceCard>

              <SurfaceCard className="space-y-2.5">
                <SectionHeader
                  title="هزینه‌های مشاعات"
                  icon="trending_down"
                  action={<StatusPill label={`${fmtT(statements.totalExpense)} ت`} tone="danger" />}
                />
                <div className="space-y-2.5">
                  {statements.expenses.map((ex) => {
                    const sharePct = Math.round(
                      (ex.amount / Math.max(1, statements.totalExpense)) * 100,
                    );
                    return (
                      <div key={ex.code} className="space-y-1">
                        <div className="flex items-center justify-between gap-2 text-[13px]">
                          <span className="text-on-surface truncate">{ex.title}</span>
                          <span className="font-numeric-stat font-semibold shrink-0">
                            {fmtT(ex.amount)} ت ({sharePct.toLocaleString('fa-IR')}٪)
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-surface-container-low overflow-hidden">
                          <div
                            className="h-full bg-primary/70 rounded-full"
                            style={{ width: `${sharePct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="pt-2.5 border-t border-outline-variant/45 flex items-center justify-between">
                  <strong className="text-[13.5px] text-on-surface">
                    {statements.netSurplus >= 0 ? 'مازاد (سود) خالص دوره' : 'کسری عملیاتی دوره'}
                  </strong>
                  <strong
                    className={`text-[15px] font-extrabold font-numeric-stat ${
                      statements.netSurplus >= 0 ? 'text-secondary' : 'text-error'
                    }`}
                  >
                    {statements.netSurplus >= 0 ? '+' : ''}
                    {fmtT(statements.netSurplus)} تومان
                  </strong>
                </div>
              </SurfaceCard>
            </div>
          )}

          {/* REPORT C: Balance Sheet (ترازنامه) */}
          {reportView === 'bs' && (
            <div className="space-y-3 m-panel-in">
              <SurfaceCard className="p-3 flex items-center justify-between gap-2 bg-primary-container/25">
                <span className="text-[13px] font-semibold text-on-surface">
                  معادله اساسی: دارایی‌ها = بدهی‌ها + اندوخته و مازاد دوره
                </span>
                <StatusPill
                  label={statements.balanceSheetBalanced ? 'ترازنامه متوازن ✓' : 'عدم توازن'}
                  tone={statements.balanceSheetBalanced ? 'positive' : 'danger'}
                />
              </SurfaceCard>

              <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
                <SurfaceCard className="space-y-2.5">
                  <SectionHeader
                    title="دارایی‌های مجتمع"
                    icon="account_balance"
                    action={<StatusPill label={`${fmtT(statements.totalAssets)} ت`} tone="primary" />}
                  />
                  <div className="divide-y divide-surface-container-high text-[13px]">
                    {statements.assets.map((a) => (
                      <div key={a.code} className="py-2 flex items-center justify-between gap-2">
                        <span className="text-on-surface truncate">
                          <span className="text-primary font-numeric-stat ml-1">{a.code}</span>
                          {a.title}
                        </span>
                        <strong className="font-numeric-stat shrink-0">{fmtT(a.amount)} ت</strong>
                      </div>
                    ))}
                  </div>
                </SurfaceCard>

                <SurfaceCard className="space-y-2.5">
                  <SectionHeader
                    title="بدهی‌ها و اندوخته مالکین"
                    icon="savings"
                    action={
                      <StatusPill
                        label={`${fmtT(statements.totalLiabilities + statements.totalEquityWithSurplus)} ت`}
                        tone="positive"
                      />
                    }
                  />
                  <div className="divide-y divide-surface-container-high text-[13px]">
                    {statements.liabilities.map((l) => (
                      <div key={l.code} className="py-2 flex items-center justify-between gap-2">
                        <span className="text-on-surface truncate">{l.title}</span>
                        <strong className="font-numeric-stat text-error shrink-0">
                          {fmtT(l.amount)} ت
                        </strong>
                      </div>
                    ))}
                    {statements.equities.map((eq) => (
                      <div key={eq.code} className="py-2 flex items-center justify-between gap-2">
                        <span className="text-on-surface truncate">{eq.title}</span>
                        <strong className="font-numeric-stat text-secondary shrink-0">
                          {fmtT(eq.amount)} ت
                        </strong>
                      </div>
                    ))}
                    <div className="py-2 flex items-center justify-between gap-2">
                      <span className="text-on-surface font-semibold">مازاد (کسری) دوره جاری</span>
                      <strong
                        className={`font-numeric-stat shrink-0 ${
                          statements.netSurplus >= 0 ? 'text-secondary' : 'text-error'
                        }`}
                      >
                        {fmtT(statements.netSurplus)} ت
                      </strong>
                    </div>
                  </div>
                </SurfaceCard>
              </div>
            </div>
          )}

          {/* REPORT D: A/R Aging & Article 10 Legal Notice */}
          {reportView === 'aging' && (
            <SurfaceCard className="space-y-3 m-panel-in">
              <SectionHeader
                title="جدول سنی مطالبات و جریمه تاخیر (ماده ۱۰ مکرر)"
                icon="gavel"
                action={
                  <div className="flex items-center gap-1.5 text-[12px]">
                    <span className="text-on-surface-variant">نرخ جریمه ماهانه:</span>
                    <select
                      aria-label="نرخ جریمه دیرکرد ماهانه"
                      value={accState.penaltyRatePct}
                      onChange={(e) =>
                        setAccState((p) => ({ ...p, penaltyRatePct: Number(e.target.value) }))
                      }
                      className="h-7 px-2 rounded-lg bg-surface-container-low text-[12px] font-bold border border-outline-variant/45"
                    >
                      <option value={0}>۰٪</option>
                      <option value={2}>۲٪</option>
                      <option value={3}>۳٪</option>
                    </select>
                  </div>
                }
              />

              <div className="space-y-2">
                {agingRows.map((row) => {
                  const issued = accState.issuedLegalUnits.includes(row.unitCode);
                  return (
                    <div
                      key={row.unitCode}
                      className="p-3 rounded-xl bg-surface-container-low/80 border border-outline-variant/30 flex items-center justify-between gap-2.5 flex-wrap"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <strong className="text-[14px] font-semibold text-on-surface">
                            واحد {row.unitCode} — {row.residentName}
                          </strong>
                          <StatusPill
                            label={`${row.daysOverdue.toLocaleString('fa-IR')} روز (${row.bucket})`}
                            tone={row.article10Eligible ? 'danger' : 'primary'}
                          />
                        </div>
                        <span className="text-[12.5px] text-on-surface-variant font-numeric-stat block mt-0.5">
                          اصل بدهی: {fmtT(row.principalTomans)} ت • جریمه: {fmtT(row.penaltyTomans)} ت •{' '}
                          <strong className="text-error">جمع: {fmtT(row.totalTomans)} ت</strong>
                        </span>
                      </div>

                      {row.article10Eligible && (
                        issued ? (
                          <StatusPill label="اظهارنامه صادر شد" tone="positive" />
                        ) : (
                          <StitchButton
                            variant="danger"
                            size="sm"
                            icon="gavel"
                            onClick={() => {
                              setAccState((p) => ({
                                ...p,
                                issuedLegalUnits: [...p.issuedLegalUnits, row.unitCode],
                              }));
                              onFeedback(
                                `اخطاریه رسمی ماده ۱۰ مکرر برای واحد ${row.unitCode} به مبلغ ${fmtT(row.totalTomans)} تومان صادر شد.`,
                              );
                            }}
                          >
                            صدور ماده ۱۰
                          </StitchButton>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </SurfaceCard>
          )}
        </div>
      )}

      {/* ================================================================
          SUB 4: TREASURY — RESIDENT RECEIPTS & SAYADI CHECKS
          ================================================================ */}
      {deskTab === 'treasury' && (
        <div className="space-y-3.5 m-panel-in lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 lg:items-start">
          {/* Pending Resident Receipts (Auto-Posts Journal Entry!) */}
          <SurfaceCard className="space-y-3">
            <SectionHeader
              title="فیش‌های واریزی ساکنین (صدور خودکار سند)"
              icon="fact_check"
              action={<StatusPill label={`${fmtT(pendingReceiptsCount)} در انتظار`} tone="primary" />}
            />
            <div className="space-y-2">
              {accState.receipts.map((r) => (
                <div
                  key={r.id}
                  className="p-3 rounded-xl bg-surface-container-low/80 border border-outline-variant/30 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <strong className="text-[14px] font-semibold text-on-surface block truncate">
                      واحد {r.unitCode} ({r.residentName})
                    </strong>
                    <span className="text-[12.5px] text-on-surface-variant font-numeric-stat block truncate mt-0.5">
                      {fmtT(r.amountTomans)} تومان • {r.traceCode}
                    </span>
                  </div>
                  {r.approved ? (
                    <StatusPill
                      label={r.voucherNo ? `سند #${fmtT(r.voucherNo)}` : 'ثبت شد'}
                      tone="positive"
                    />
                  ) : (
                    <StitchButton
                      size="sm"
                      icon="check"
                      onClick={() => handleApproveReceipt(r)}
                    >
                      تایید و سند
                    </StitchButton>
                  )}
                </div>
              ))}
            </div>
          </SurfaceCard>

          {/* Sayadi Checks Ledger */}
          <SurfaceCard className="space-y-3">
            <SectionHeader
              title="دفتر چک‌های صیادی و اسناد پرداختنی"
              icon="payments"
              action={
                <StitchButton
                  variant="secondary"
                  size="sm"
                  icon="add"
                  onClick={() => setShowNewCheck(true)}
                >
                  چک جدید
                </StitchButton>
              }
            />
            <div className="space-y-2">
              {accState.checks.map((c) => (
                <div
                  key={c.id}
                  className="p-3 rounded-xl bg-surface-container-low/80 border border-outline-variant/30 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <strong className="text-[14px] font-semibold text-on-surface block truncate">
                        {c.payee}
                      </strong>
                      <span className="text-[12.5px] text-on-surface-variant font-numeric-stat block mt-0.5">
                        {fmtT(c.amountTomans)} ت • سررسید {c.dueDate}
                      </span>
                      <span className="text-[11.5px] text-primary font-numeric-stat block mt-0.5" dir="ltr">
                        صیادی: {c.sayadiId}
                      </span>
                    </div>
                    <StatusPill
                      label={
                        c.status === 'cleared'
                          ? 'پاس شده'
                          : c.status === 'registered'
                            ? 'ثبت صیادی'
                            : 'در انتظار امضا'
                      }
                      tone={c.status === 'cleared' ? 'positive' : 'primary'}
                    />
                  </div>
                  {c.status !== 'cleared' && (
                    <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-surface-container-high">
                      {onNavigate && (
                        <StitchButton
                          variant="ghost"
                          size="sm"
                          onClick={() => onNavigate('finance?tab=voucher')}
                        >
                          سند پایا
                        </StitchButton>
                      )}
                      <StitchButton
                        size="sm"
                        icon="task_alt"
                        onClick={() => handleClearCheck(c)}
                      >
                        پاس کردن و ثبت سند
                      </StitchButton>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </SurfaceCard>
        </div>
      )}

      {/* ================================================================
          MODAL 1: VIEW JOURNAL VOUCHER LINES & FINALIZE / REVERSE
          ================================================================ */}
      <StitchModal
        open={Boolean(viewingVoucher)}
        onClose={() => setViewingVoucher(null)}
        title={viewingVoucher ? `سند حسابداری #${fmtT(viewingVoucher.voucherNo)}` : ''}
        subtitle={
          viewingVoucher
            ? `${viewingVoucher.date} • ${viewingVoucher.status === 'final' ? 'قطعی' : 'موقت'}`
            : undefined
        }
      >
        {viewingVoucher && (
          <div className="space-y-3">
            <p className="text-[13px] text-on-surface bg-surface-container-low rounded-xl p-2.5 mb-0">
              {viewingVoucher.description}
            </p>
            <div className="overflow-x-auto rounded-xl border border-surface-container-high">
              <table className="w-full text-right border-collapse text-[12px]">
                <thead>
                  <tr className="bg-surface-container-low text-on-surface-variant border-b border-surface-container-high">
                    <th className="py-2 px-2 font-semibold">حساب معین / تفصیلی</th>
                    <th className="py-2 px-2 font-semibold text-left">بدهکار</th>
                    <th className="py-2 px-2 font-semibold text-left">بستانکار</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-high font-numeric-stat">
                  {viewingVoucher.lines.map((ln, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-2">
                        <span className="text-primary font-bold ml-1">{ln.accountCode}</span>
                        <span className="text-on-surface font-medium">
                          {ACCOUNT_BY_CODE[ln.accountCode]?.title ?? ln.accountCode}
                        </span>
                        {ln.subsidiary && (
                          <span className="block text-[11px] text-on-surface-variant">
                            تفصیلی: {ln.subsidiary}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-left">
                        {ln.debit > 0 ? fmtT(ln.debit) : '—'}
                      </td>
                      <td className="py-2 px-2 text-left text-secondary">
                        {ln.credit > 0 ? fmtT(ln.credit) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {viewingVoucher.status === 'draft' && (
                <StitchButton
                  icon="lock"
                  onClick={() => handleFinalizeVoucher(viewingVoucher.id)}
                >
                  قطعی کردن سند
                </StitchButton>
              )}
              <StitchButton
                variant="danger"
                icon="undo"
                className={viewingVoucher.status === 'final' ? 'col-span-2' : ''}
                onClick={() => handleReverseVoucher(viewingVoucher)}
              >
                صدور سند برگشت (اصلاحی)
              </StitchButton>
            </div>
          </div>
        )}
      </StitchModal>

      {/* ================================================================
          MODAL 2: INTERACTIVE DOUBLE-ENTRY VOUCHER BUILDER
          ================================================================ */}
      <StitchModal
        open={showNewVoucher}
        onClose={() => setShowNewVoucher(false)}
        title={`ثبت سند حسابداری جدید (#${fmtT(nextVoucherNo)})`}
        subtitle="ثبت دوطرفه با کنترل خودکار تراز بدهکار و بستانکار"
      >
        <form onSubmit={handleSaveManualVoucher} className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1">
              <label className="block text-[12px] font-medium text-on-surface-variant mb-1">
                تاریخ سند
              </label>
              <input
                type="text"
                value={vDate}
                onChange={(e) => setVDate(e.target.value)}
                className="w-full h-10 px-2.5 rounded-xl bg-surface-container-low text-[12.5px] font-numeric-stat border border-outline-variant/45"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[12px] font-medium text-on-surface-variant mb-1">
                شرح کلی سند
              </label>
              <input
                type="text"
                required
                value={vDesc}
                onChange={(e) => setVDesc(e.target.value)}
                placeholder="مثلاً: پرداخت فاکتور تعویض لامپ مشاعات"
                className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-[13px] border border-outline-variant/45"
              />
            </div>
          </div>

          {/* Lines */}
          <div className="space-y-2 max-h-[240px] overflow-y-auto pr-0.5">
            {vLines.map((ln, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/35 space-y-2"
              >
                <div className="flex items-center gap-1.5">
                  <select
                    aria-label={`حساب معین ردیف ${idx + 1}`}
                    value={ln.accountCode}
                    onChange={(e) =>
                      setVLines((prev) =>
                        prev.map((row, i) =>
                          i === idx ? { ...row, accountCode: e.target.value } : row,
                        ),
                      )
                    }
                    className="flex-1 h-9 px-2 rounded-lg bg-surface-container-lowest text-[12px] border border-outline-variant/45"
                  >
                    {CHART_OF_ACCOUNTS.map((a) => (
                      <option key={a.code} value={a.code}>
                        {a.code} — {a.title}
                      </option>
                    ))}
                  </select>
                  {vLines.length > 2 && (
                    <button
                      type="button"
                      aria-label="حذف ردیف"
                      onClick={() => setVLines((prev) => prev.filter((_, i) => i !== idx))}
                      className="w-8 h-8 rounded-lg hover:bg-error-container text-error flex items-center justify-center shrink-0"
                    >
                      <span className="material-symbols-outlined text-[17px]">delete</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="number"
                    min={0}
                    step={50000}
                    placeholder="بدهکار (تومان)"
                    value={ln.debit || ''}
                    onChange={(e) => {
                      const val = Math.max(0, Number(e.target.value) || 0);
                      setVLines((prev) =>
                        prev.map((row, i) =>
                          i === idx ? { ...row, debit: val, credit: val > 0 ? 0 : row.credit } : row,
                        ),
                      );
                    }}
                    className="h-9 px-2.5 rounded-lg bg-surface-container-lowest text-[12.5px] font-numeric-stat border border-outline-variant/45"
                  />
                  <input
                    type="number"
                    min={0}
                    step={50000}
                    placeholder="بستانکار (تومان)"
                    value={ln.credit || ''}
                    onChange={(e) => {
                      const val = Math.max(0, Number(e.target.value) || 0);
                      setVLines((prev) =>
                        prev.map((row, i) =>
                          i === idx ? { ...row, credit: val, debit: val > 0 ? 0 : row.debit } : row,
                        ),
                      );
                    }}
                    className="h-9 px-2.5 rounded-lg bg-surface-container-lowest text-[12.5px] font-numeric-stat border border-outline-variant/45"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2">
            <StitchButton
              variant="secondary"
              size="sm"
              icon="add"
              onClick={() =>
                setVLines((prev) => [
                  ...prev,
                  { accountCode: '1102', subsidiary: '', description: '', debit: 0, credit: 0 },
                ])
              }
            >
              افزودن ردیف
            </StitchButton>
            <StitchButton
              variant="ghost"
              size="sm"
              icon="balance"
              onClick={handleAutoBalanceLastLine}
            >
              تراز خودکار ردیف آخر
            </StitchButton>
          </div>

          {/* Live Balance Meter */}
          <div className="p-2.5 rounded-xl bg-surface-container-low flex items-center justify-between text-[12px] font-numeric-stat">
            <span>
              بدهکار: <strong>{fmtT(voucherValidation.totalDebit)}</strong>
            </span>
            <span>
              بستانکار: <strong>{fmtT(voucherValidation.totalCredit)}</strong>
            </span>
            <StatusPill
              label={
                voucherValidation.isBalanced
                  ? 'تراز ✓'
                  : `اختلاف ${fmtT(Math.abs(voucherValidation.diff))}`
              }
              tone={voucherValidation.isBalanced ? 'positive' : 'danger'}
            />
          </div>

          <StitchButton
            type="submit"
            disabled={!voucherValidation.isValid}
            icon="check_circle"
            className="w-full"
          >
            ثبت سند در دفتر روزنامه
          </StitchButton>
        </form>
      </StitchModal>

      {/* ================================================================
          MODAL 3: REGISTER NEW SAYADI CHECK
          ================================================================ */}
      <StitchModal
        open={showNewCheck}
        onClose={() => setShowNewCheck(false)}
        title="ثبت چک صیادی جدید"
        subtitle="ثبت همزمان در دفتر چک‌ها و صدور سند روزنامه"
      >
        <form onSubmit={handleRegisterCheck} className="space-y-3">
          <div>
            <label className="block text-[12.5px] font-medium text-on-surface-variant mb-1">
              در وجه (ذینفع)
            </label>
            <input
              type="text"
              required
              value={chkPayee}
              onChange={(e) => setChkPayee(e.target.value)}
              placeholder="نام شرکت یا پیمانکار..."
              className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-[13px] border border-outline-variant/45"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[12.5px] font-medium text-on-surface-variant mb-1">
                مبلغ (تومان)
              </label>
              <input
                type="number"
                required
                min={100000}
                step={500000}
                value={chkAmount}
                onChange={(e) => setChkAmount(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-[13px] font-numeric-stat border border-outline-variant/45"
              />
            </div>
            <div>
              <label className="block text-[12.5px] font-medium text-on-surface-variant mb-1">
                تاریخ سررسید
              </label>
              <input
                type="text"
                required
                value={chkDue}
                onChange={(e) => setChkDue(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-[13px] font-numeric-stat border border-outline-variant/45"
              />
            </div>
          </div>
          <div>
            <label className="block text-[12.5px] font-medium text-on-surface-variant mb-1">
              شناسه ۱۶ رقمی صیادی
            </label>
            <input
              type="text"
              required
              dir="ltr"
              value={chkSayadiId}
              onChange={(e) => setChkSayadiId(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-[13px] font-numeric-stat border border-outline-variant/45"
            />
          </div>
          <div>
            <label className="block text-[12.5px] font-medium text-on-surface-variant mb-1">
              سرفصل هزینه / بدهی طرف مقابل
            </label>
            <select
              value={chkExpenseCode}
              onChange={(e) => setChkExpenseCode(e.target.value)}
              className="w-full h-10 px-2.5 rounded-xl bg-surface-container-low text-[12.5px] border border-outline-variant/45"
            >
              {CHART_OF_ACCOUNTS.filter((a) => a.group === 'expense' || a.code === '2101').map(
                (a) => (
                  <option key={a.code} value={a.code}>
                    {a.code} — {a.title}
                  </option>
                ),
              )}
            </select>
          </div>
          <StitchButton type="submit" icon="verified" className="w-full">
            ثبت چک صیادی و صدور سند
          </StitchButton>
        </form>
      </StitchModal>
    </div>
  );
};
