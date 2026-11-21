import React, { useCallback, useEffect, useState } from 'react';
import { mobileApi } from '../mobileApi';
import { computeBudgetVariance } from '../financeCalc';
import {
  HeroSummaryCard,
  SectionHeader,
  StatusPill,
  StitchButton,
  StitchModal,
  SubMenuTabs,
  SurfaceCard,
} from '../ui/StitchKit';
import { ComplexPageLoader } from '../ui/ComplexSpinner';

interface Props {
  onNavigate?: (route: string) => void;
  onSyncChanged?: () => void;
  onFeedback: (msg: string) => void;
}

const PERIODS = ['زمستان ۱۴۰۳', 'آبان و آذر ۱۴۰۳', 'سالانه ۱۴۰۳'];
const SCOPES = ['تنخواه بلوک B (مهندس کاویانی)', 'تنخواه مرکزی نیلوفر', 'تنخواه تاسیسات'];

export const FinancePettyCashTab: React.FC<Props> = ({
  onNavigate,
  onSyncChanged,
  onFeedback,
}) => {
  const [sub, setSub] = useState<'overview' | 'audit' | 'invoices'>('overview');
  const [state, setState] = useState<Record<string, any> | null>(null);
  const [period, setPeriod] = useState(PERIODS[0]);
  const [scopeIdx, setScopeIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [showReplenish, setShowReplenish] = useState(false);
  const [repAmount, setRepAmount] = useState('15000000');
  const [repReason, setRepReason] = useState('تامین نقدینگی تنخواه تاسیسات و قطعات موتورخانه بلوک B');

  const loadPettyCash = useCallback(async () => {
    setLoading(true);
    try {
      const res = await mobileApi.getPettyCash();
      if (res.data?.data) setState(res.data.data);
    } catch {
      /* offline */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPettyCash();
  }, [loadPettyCash]);

  const handleRebalance = async () => {
    setBusy(true);
    try {
      const res = await mobileApi.rebalancePettyCash();
      if (res.data?.data) setState(res.data.data);
      onSyncChanged?.();
      onFeedback('سند متمم اجرا شد و تراز بودجه آسانسور متعادل گردید.');
    } catch (err) {
      onFeedback(err instanceof Error ? err.message : 'اجرای سند اصلاحی ناموفق بود.');
    } finally {
      setBusy(false);
    }
  };

  const handleReplenishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const amt = Math.max(1000000, Number(repAmount) || 15000000);
      const res = await mobileApi.replenishPettyCash(amt, repReason);
      if (res.data?.data) setState(res.data.data);
      setShowReplenish(false);
      onSyncChanged?.();
      onFeedback(`درخواست شارژ ${amt.toLocaleString('fa-IR')} تومان ثبت و ارسال شد.`);
    } catch (err) {
      onFeedback(err instanceof Error ? err.message : 'ثبت درخواست ناموفق بود.');
    } finally {
      setBusy(false);
    }
  };

  const handleExportCsv = () => {
    const categories = (state?.categories ?? []) as Array<Record<string, any>>;
    const header = 'سرفصل,مصرف (تومان),بودجه مصوب (تومان),درصد جذب\n';
    const rows = categories
      .map((c) => {
        const m = computeBudgetVariance(c.spentTomans, c.budgetTomans);
        return `"${c.title}",${c.spentTomans},${c.budgetTomans},${m.utilizationPct}%`;
      })
      .join('\n');
    const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'petty-cash-audit-report.csv';
    a.click();
    URL.revokeObjectURL(url);
    onFeedback('فایل گزارش تنخواه (CSV) دانلود شد.');
  };

  if (loading && !state) {
    return <ComplexPageLoader compact label="در حال بارگذاری گزارش تنخواه..." />;
  }

  const approvedCap = Number(state?.approvedCapTomans || 65_000_000);
  const spentTotal = Number(state?.spentTomans || 52_850_000);
  const remainingTotal = Math.max(0, approvedCap - spentTotal);
  const absorptionPct = Number(((spentTotal / Math.max(1, approvedCap)) * 100).toFixed(1));
  const runwayDays = Number(state?.runwayDays || 20);
  const categories = (state?.categories ?? []) as Array<Record<string, any>>;
  const expenses = (state?.expenses ?? []) as Array<Record<string, any>>;
  const rebalanced = Boolean(state?.rebalanced);
  const replenishmentRequests = (state?.replenishmentRequests ?? []) as Array<Record<string, any>>;

  const fmtMillions = (t: number) =>
    `${(t / 1_000_000).toLocaleString('fa-IR', { maximumFractionDigits: 1 })} م.ت`;

  return (
    <div className="space-y-3.5">
      <HeroSummaryCard
        title="تنخواه و تحلیل بودجه"
        subtitle={`${SCOPES[scopeIdx]} • ${period}`}
        badge={`جذب ${absorptionPct.toLocaleString('fa-IR')}٪`}
        stats={[
          { label: 'مصرف‌شده', value: fmtMillions(spentTotal) },
          { label: 'مانده نقدی', value: fmtMillions(remainingTotal), accent: 'positive' },
          { label: 'تاب‌آوری', value: `${runwayDays.toLocaleString('fa-IR')} روز` },
        ]}
      />

      {/* Sub-Menu to keep each view calm and short */}
      <SubMenuTabs
        active={sub}
        onChange={(id) => setSub(id as typeof sub)}
        items={[
          { id: 'overview', label: 'سرفصل‌ها', icon: 'bar_chart' },
          { id: 'audit', label: 'روند و حسابرس', icon: 'psychology' },
          { id: 'invoices', label: 'فاکتورها', icon: 'receipt_long', badge: expenses.length },
        ]}
      />

      {/* SUB 1: Categories & Scope Controls */}
      {sub === 'overview' && (
        <div className="space-y-3 m-panel-in">
          <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1.5">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`h-8 px-3 rounded-xl text-[12px] font-medium whitespace-nowrap active:scale-[0.96] transition-[transform,background-color,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                    period === p
                      ? 'bg-primary-container text-on-primary-container font-semibold'
                      : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant/45'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <StitchButton
              variant="ghost"
              size="sm"
              onClick={() => setScopeIdx((i) => (i + 1) % SCOPES.length)}
            >
              تغییر تنخواه
            </StitchButton>
          </div>

          <div className="space-y-2.5 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
            {categories.map((cat) => {
              const metrics = computeBudgetVariance(cat.spentTomans, cat.budgetTomans);
              return (
                <SurfaceCard key={cat.id} className="p-3.5 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-[14px] font-semibold text-on-surface mb-0 truncate">
                        {cat.title}
                      </h4>
                      <p className="text-[13px] text-on-surface-variant mt-0.5 mb-0 truncate">
                        {cat.subtitle}
                      </p>
                    </div>
                    <StatusPill
                      label={
                        metrics.isOverBudget
                          ? `${metrics.variancePct.toLocaleString('fa-IR')}٪+ مازاد`
                          : `${metrics.variancePct.toLocaleString('fa-IR')}٪- ذخیره`
                      }
                      tone={metrics.isOverBudget ? 'danger' : 'positive'}
                    />
                  </div>

                  <div className="w-full bg-surface-container-low h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        metrics.isOverBudget ? 'bg-error/80' : 'bg-secondary/75'
                      }`}
                      style={{ width: `${Math.min(100, metrics.utilizationPct)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[12.5px] text-on-surface-variant font-numeric-stat">
                    <span>مصرف: {Number(cat.spentTomans).toLocaleString('fa-IR')} ت</span>
                    <span>مصوب: {Number(cat.budgetTomans).toLocaleString('fa-IR')} ت</span>
                  </div>
                </SurfaceCard>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <StitchButton variant="secondary" icon="sim_card_download" onClick={handleExportCsv}>
              خروجی اکسل
            </StitchButton>
            <StitchButton icon="add_card" onClick={() => setShowReplenish(true)}>
              شارژ تنخواه
            </StitchButton>
          </div>
        </div>
      )}

      {/* SUB 2: Trend & Auditor Rebalance */}
      {sub === 'audit' && (
        <div className="space-y-3">
          <SurfaceCard className="space-y-3">
            <SectionHeader title="روند مصرف فصلی" icon="monitoring" />
            <div className="flex items-end justify-between gap-3 pt-4 pb-1 px-3 h-36">
              {[
                { m: 'دی', val: '۱۴.۲ م', h: '58%', active: false },
                { m: 'بهمن', val: '۲۴.۱ م', h: '100%', active: true },
                { m: 'اسفند*', val: '۱۴.۵ م', h: '60%', active: false },
              ].map((bar) => (
                <div key={bar.m} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <span className="text-[12px] text-on-surface-variant font-numeric-stat">
                    {bar.val}
                  </span>
                  <div
                    className={`w-full max-w-[44px] rounded-t-xl ${
                      bar.active ? 'bg-primary/75' : 'bg-primary-container'
                    }`}
                    style={{ height: bar.h }}
                  />
                  <span className="text-[12.5px] font-medium text-on-surface">{bar.m}</span>
                </div>
              ))}
            </div>
            <p className="text-[13px] text-on-surface-variant bg-surface-container-low p-2.5 rounded-xl mb-0 truncate">
              علت پیک بهمن: تعمیر الکتروموتور بوسترپمپ آبرسانی
            </p>
          </SurfaceCard>

          <SurfaceCard className="space-y-3">
            <SectionHeader
              title="اصلاح بودجه و توصیه حسابرس"
              icon="psychology"
              action={
                <StatusPill
                  label={rebalanced ? 'متوازن شد' : 'نیاز به متمم'}
                  tone={rebalanced ? 'positive' : 'danger'}
                />
              }
            />
            {!rebalanced ? (
              <>
                <p className="text-[13px] text-on-surface-variant mb-0 leading-relaxed line-clamp-2">
                  انتقال ۱,۲۰۰,۰۰۰ تومان از صرفه‌جویی تاسیسات به ردیف آسانسور جهت رفع مازاد بودجه.
                </p>
                <StitchButton
                  disabled={busy}
                  icon="swap_horiz"
                  className="w-full"
                  onClick={() => void handleRebalance()}
                >
                  {busy ? 'در حال صدور...' : 'اجرای سند اصلاحی متمم (۱.۲ م.ت)'}
                </StitchButton>
              </>
            ) : (
              <p className="text-[13px] text-secondary mb-0 leading-relaxed">
                جابجایی ۱,۲۰۰,۰۰۰ تومان انجام شد و تمامی سرفصل‌های تنخواه در تراز مجاز قرار دارند.
              </p>
            )}
          </SurfaceCard>
        </div>
      )}

      {/* SUB 3: Invoices & Replenishment Requests */}
      {sub === 'invoices' && (
        <div className="space-y-3">
          <SurfaceCard className="space-y-2.5">
            <SectionHeader title="فاکتورهای ثبت‌شده تنخواه" icon="receipt_long" />
            <div className="divide-y divide-surface-container-high">
              {expenses.map((exp) => (
                <div key={exp.id} className="py-2.5 flex items-center justify-between gap-2.5">
                  <div className="min-w-0 flex-1">
                    <strong className="block text-[14px] font-semibold text-on-surface truncate">
                      {exp.title}
                    </strong>
                    <span className="block text-[13px] text-on-surface-variant truncate mt-0.5">
                      {exp.vendor} • {exp.date}
                    </span>
                  </div>
                  <div className="text-left shrink-0">
                    <strong className="block text-[13.5px] font-bold text-on-surface font-numeric-stat">
                      {Number(exp.amountTomans).toLocaleString('fa-IR')} ت
                    </strong>
                    {exp.voucherId && onNavigate && (
                      <button
                        type="button"
                        onClick={() => onNavigate('finance?tab=voucher')}
                        className="text-[12px] font-medium text-primary hover:underline"
                      >
                        سند {exp.voucherId}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </SurfaceCard>

          {replenishmentRequests.length > 0 && (
            <SurfaceCard className="space-y-2">
              <SectionHeader title="درخواست‌های شارژ ثبت‌شده" icon="add_card" />
              {replenishmentRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-2.5 rounded-xl bg-surface-container-low flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <strong className="block text-[13.5px] text-on-surface font-numeric-stat truncate">
                      {req.id} — {Number(req.amountTomans).toLocaleString('fa-IR')} ت
                    </strong>
                    <span className="block text-[12.5px] text-on-surface-variant truncate">
                      {req.reason}
                    </span>
                  </div>
                  <StatusPill label={req.status} tone="positive" />
                </div>
              ))}
            </SurfaceCard>
          )}
        </div>
      )}

      {/* Replenish Modal */}
      <StitchModal
        open={showReplenish}
        onClose={() => setShowReplenish(false)}
        title="درخواست شارژ مجدد تنخواه"
        subtitle={SCOPES[scopeIdx]}
      >
        <form onSubmit={handleReplenishSubmit} className="space-y-3">
          <div>
            <label className="block text-[13px] font-medium text-on-surface-variant mb-1">
              مبلغ درخواستی (تومان)
            </label>
            <input
              type="number"
              required
              min={1000000}
              step={500000}
              value={repAmount}
              onChange={(e) => setRepAmount(e.target.value)}
              className="w-full h-11 px-3 rounded-xl bg-surface-container-low text-on-surface font-numeric-stat font-semibold text-[13.5px] border border-outline-variant/45"
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-on-surface-variant mb-1">
              توضیح هزینه
            </label>
            <textarea
              rows={3}
              required
              value={repReason}
              onChange={(e) => setRepReason(e.target.value)}
              className="w-full p-3 rounded-xl bg-surface-container-low text-on-surface text-[13.5px] border border-outline-variant/45"
            />
          </div>
          <StitchButton type="submit" disabled={busy} icon="send" className="w-full">
            {busy ? 'در حال ثبت...' : 'ارسال به خزانه‌دار'}
          </StitchButton>
        </form>
      </StitchModal>
    </div>
  );
};
