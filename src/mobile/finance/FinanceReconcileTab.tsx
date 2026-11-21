import React, { useCallback, useEffect, useState } from 'react';
import { mobileApi } from '../mobileApi';
import { PersianAmountInput } from '../components/PersianAmountInput';
import {
  HeroSummaryCard,
  SectionHeader,
  StatusPill,
  StitchButton,
  SubMenuTabs,
  SurfaceCard,
} from '../ui/StitchKit';

interface Props {
  onNavigate?: (route: string) => void;
  onSyncChanged?: () => void;
  onFeedback: (msg: string) => void;
}

export const FinanceReconcileTab: React.FC<Props> = ({
  onNavigate,
  onSyncChanged,
  onFeedback,
}) => {
  const [sub, setSub] = useState<'units' | 'formula'>('units');
  const [state, setState] = useState<Record<string, any> | null>(null);
  const [filter, setFilter] = useState<'all' | 'matched' | 'pending' | 'mismatch'>('all');
  const [smartCent, setSmartCent] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [newExpTitle, setNewExpTitle] = useState('');
  const [newExpAmt, setNewExpAmt] = useState('1500000');

  const load = useCallback(async () => {
    try {
      const res = await mobileApi.getReconciliation();
      if (res.data?.data) setState(res.data.data);
    } catch {
      /* offline */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runAction = async (
    payload: Parameters<typeof mobileApi.reconciliationAction>[0],
    msg: string,
  ) => {
    setBusy(true);
    try {
      const res = await mobileApi.reconciliationAction(payload);
      if (res.data?.data) setState(res.data.data);
      onSyncChanged?.();
      onFeedback(msg);
    } catch (err) {
      onFeedback(err instanceof Error ? err.message : 'عملیات انجام نشد.');
    } finally {
      setBusy(false);
    }
  };

  const units = (state?.units ?? []) as Array<Record<string, any>>;
  const expenses = (state?.expenses ?? []) as Array<Record<string, any>>;
  const matchedCount = units.filter((u) => u.status === 'matched').length;
  const pendingCount = units.filter((u) => u.status === 'pending').length;
  const mismatchCount = units.filter((u) => u.status === 'mismatch').length;
  const pct = units.length > 0 ? Math.round((matchedCount / units.length) * 100) : 75;
  const visibleUnits = units.filter((u) => filter === 'all' || u.status === filter);

  return (
    <div className="space-y-3.5">
      <HeroSummaryCard
        title="تطبیق هوشمند بانکی"
        subtitle={`${state?.blockTitle || 'بلوک B نیلوفر'} • ${state?.period || 'آبان ۱۴۰۳'}`}
        badge={state?.closed ? 'دوره بسته شد' : `${pct.toLocaleString('fa-IR')}٪ منطبق`}
        stats={[
          { label: 'شارژ کل', value: '۳۸.۴ م.ت' },
          { label: 'تطبیق‌شده', value: `${matchedCount.toLocaleString('fa-IR')} واحد`, accent: 'positive' },
          { label: 'مانده / مغایرت', value: `${(pendingCount + mismatchCount).toLocaleString('fa-IR')} واحد`, accent: 'danger' },
        ]}
      />

      <SubMenuTabs
        active={sub}
        onChange={(id) => setSub(id as typeof sub)}
        items={[
          { id: 'units', label: 'تطبیق واحدها', icon: 'document_scanner', badge: pendingCount + mismatchCount },
          { id: 'formula', label: 'فرمول و فاکتورها', icon: 'calculate', badge: expenses.length },
        ]}
      />

      {/* SUB 1: Auto-Reconcile & Units List */}
      {sub === 'units' && (
        <div className="space-y-3">
          <SurfaceCard className="space-y-2.5">
            <SectionHeader
              title="صورت‌حساب بانکی و تطبیق خودکار"
              icon="cloud_upload"
              action={
                <StitchButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setSmartCent((v) => !v)}
                >
                  {smartCent ? 'شناسه یکان: فعال' : 'شناسه یکان: خاموش'}
                </StitchButton>
              }
            />
            <label className="w-full h-10 rounded-xl bg-surface-container-low text-on-surface-variant text-[13px] font-medium flex items-center justify-center gap-2 border border-dashed border-outline-variant cursor-pointer px-3">
              <span className="material-symbols-outlined text-[18px] text-primary">upload_file</span>
              <span className="truncate">
                {state?.fileName || 'بارگذاری اکسل یا PDF گردش حساب بانکی'}
              </span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.pdf"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    void runAction(
                      { action: 'run_auto', fileName: f.name },
                      `فایل «${f.name}» پردازش و تطبیق اجرا شد.`,
                    );
                  }
                }}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <StitchButton
                disabled={busy}
                icon="play_arrow"
                onClick={() =>
                  void runAction(
                    { action: 'run_auto' },
                    'تطبیق هوشمند بانکی اجرا شد و واریز جدید با شناسه ۳ منطبق گردید.',
                  )
                }
              >
                {busy ? 'پردازش...' : 'اجرای تطبیق خودکار'}
              </StitchButton>
              {onNavigate && (
                <StitchButton
                  variant="secondary"
                  icon="print"
                  onClick={() => onNavigate('finance?tab=lobby')}
                >
                  پوستر لابی
                </StitchButton>
              )}
            </div>
          </SurfaceCard>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {[
              { id: 'all', label: `همه (${units.length.toLocaleString('fa-IR')})` },
              { id: 'matched', label: `تطبیق‌شده (${matchedCount.toLocaleString('fa-IR')})` },
              { id: 'pending', label: `در انتظار (${pendingCount.toLocaleString('fa-IR')})` },
              { id: 'mismatch', label: `مغایرت (${mismatchCount.toLocaleString('fa-IR')})` },
            ].map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setFilter(c.id as typeof filter)}
                className={`h-8 px-3 rounded-xl text-[12px] font-medium whitespace-nowrap transition-colors ${
                  filter === c.id
                    ? 'bg-primary-container text-on-primary-container font-semibold'
                    : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant/45'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="space-y-2.5">
            {visibleUnits.map((u) => {
              const isMismatch = u.status === 'mismatch';
              const isPending = u.status === 'pending';
              return (
                <SurfaceCard key={u.id} className="p-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-[14px] font-semibold text-on-surface mb-0 truncate">
                        واحد {u.unitNo} — {u.resident}
                      </h4>
                      <p className="text-[13px] text-on-surface-variant mt-0.5 mb-0 truncate font-numeric-stat">
                        {Number(u.chargeTomans).toLocaleString('fa-IR')} ت • شناسه {u.centCode}
                      </p>
                    </div>
                    <StatusPill
                      label={isMismatch ? 'مغایرت' : isPending ? 'در انتظار' : 'منطبق'}
                      tone={isMismatch ? 'danger' : isPending ? 'neutral' : 'positive'}
                    />
                  </div>

                  <p className="text-[13px] text-on-surface-variant bg-surface-container-low rounded-xl px-3 py-2 mb-0 truncate">
                    {u.bankTrace}
                  </p>

                  {(isMismatch || isPending) && (
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <StitchButton
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          void mobileApi
                            .remindFinanceWallet(`واحد ${u.unitNo} - ${u.resident}`)
                            .then(() =>
                              onFeedback(`پیامک یادآوری برای واحد ${u.unitNo} ارسال شد.`),
                            )
                        }
                      >
                        یادآوری پیامکی
                      </StitchButton>
                      <StitchButton
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          void runAction(
                            { action: 'resolve_unit', unitId: u.id },
                            `تطبیق دستی واحد ${u.unitNo} ثبت شد.`,
                          )
                        }
                      >
                        تطبیق دستی
                      </StitchButton>
                    </div>
                  )}
                </SurfaceCard>
              );
            })}
          </div>

          <StitchButton
            disabled={busy}
            icon="verified"
            className="w-full"
            onClick={() =>
              void runAction(
                { action: 'close_period' },
                'تطبیق دوره آبان تایید شد و پوستر لابی آماده چاپ است.',
              )
            }
          >
            {state?.closed ? 'دوره بسته شد • آماده چاپ' : 'تایید نهایی و بستن دوره'}
          </StitchButton>
        </div>
      )}

      {/* SUB 2: Formula & Attached Period Invoices */}
      {sub === 'formula' && (
        <div className="space-y-3">
          <SurfaceCard className="space-y-2.5">
            <SectionHeader title="فرمول محاسبه و شناسه یکان" icon="calculate" />
            <p className="text-[13px] text-on-primary-container bg-primary-container/50 rounded-xl p-3 mb-0 leading-relaxed">
              پایه ثابت (۳۰۰هزار) + متراژ (۴,۵۰۰ ت) + نفرات (۱۲۰هزار) + رقم آخر مبلغ = کد واحد
            </p>
            <div className="grid grid-cols-2 gap-2 text-[13px]">
              <div className="bg-surface-container-low rounded-xl p-2.5 flex justify-between font-numeric-stat">
                <span className="text-on-surface-variant">واحد ۱۰۱</span>
                <strong className="text-on-surface">۱,۴۵۰,۰۰۱ ت</strong>
              </div>
              <div className="bg-surface-container-low rounded-xl p-2.5 flex justify-between font-numeric-stat">
                <span className="text-on-surface-variant">واحد ۱۰۲</span>
                <strong className="text-on-surface">۱,۶۲۰,۰۰۲ ت</strong>
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard className="space-y-2.5">
            <SectionHeader
              title="فاکتورهای الصاق‌شده دوره"
              icon="receipt_long"
              action={
                <StitchButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddExpense((v) => !v)}
                >
                  + فاکتور جدید
                </StitchButton>
              }
            />

            {showAddExpense && (
              <div className="p-3 rounded-xl bg-surface-container-low space-y-2 border border-outline-variant/40">
                <input
                  type="text"
                  value={newExpTitle}
                  onChange={(e) => setNewExpTitle(e.target.value)}
                  placeholder="عنوان هزینه..."
                  className="w-full h-10 px-3 rounded-xl bg-surface-container-lowest text-[13px] border border-outline-variant/45"
                />
                <div className="space-y-2">
                  <PersianAmountInput
                    compact
                    label="مبلغ فاکتور (تومان)"
                    value={Number(newExpAmt) || 0}
                    onChange={(val) => setNewExpAmt(String(val))}
                    placeholder="مثلاً: ۵۰۰,۰۰۰"
                  />
                  <StitchButton
                    className="w-full"
                    disabled={busy || !newExpTitle.trim()}
                    onClick={() => {
                      void runAction(
                        {
                          action: 'add_expense',
                          expenseTitle: newExpTitle.trim(),
                          expenseAmount: Number(newExpAmt) || 500000,
                        },
                        `فاکتور «${newExpTitle.trim()}» اضافه شد.`,
                      );
                      setNewExpTitle('');
                      setShowAddExpense(false);
                    }}
                  >
                    ثبت
                  </StitchButton>
                </div>
              </div>
            )}

            <div className="divide-y divide-surface-container-high">
              {expenses.map((exp) => (
                <div key={exp.id} className="py-2.5 flex items-center justify-between gap-2.5">
                  <div className="min-w-0 flex-1">
                    <strong className="block text-[14px] font-semibold text-on-surface truncate">
                      {exp.title}
                    </strong>
                    <span className="block text-[13px] text-on-surface-variant truncate mt-0.5">
                      {exp.subtitle}
                    </span>
                  </div>
                  <strong className="text-[13.5px] font-bold text-on-surface font-numeric-stat shrink-0">
                    {Number(exp.amountTomans).toLocaleString('fa-IR')} ت
                  </strong>
                </div>
              ))}
            </div>
          </SurfaceCard>
        </div>
      )}
    </div>
  );
};
