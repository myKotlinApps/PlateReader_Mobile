import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { mobileApi } from './mobileApi';
import { FinanceChargeTab } from './finance/FinanceChargeTab';
import { FinanceReconcileTab } from './finance/FinanceReconcileTab';
import { FinanceLobbyPosterTab } from './finance/FinanceLobbyPosterTab';
import { FinanceAccountantTab } from './finance/FinanceAccountantTab';
import { FinancePettyCashTab } from './finance/FinancePettyCashTab';
import {
  HeroSummaryCard,
  NoticeBanner,
  SectionHeader,
  StatusPill,
  StitchButton,
  SubMenuTabs,
  SurfaceCard,
} from './ui/StitchKit';

type FinanceTab =
  | 'units'
  | 'charge'
  | 'reconcile'
  | 'lobby'
  | 'accountant'
  | 'petty'
  | 'voucher';

interface Props {
  onNavigate?: (route: string) => void;
  onSyncChanged?: () => void;
}

const fmtTomans = (rials: unknown) =>
  `${Math.round(Number(rials || 0) / 10).toLocaleString('fa-IR')}`;

interface EnrichedUnit {
  id: string;
  unitNumber: string;
  blockId: 'A' | 'B' | 'C';
  floorLabel: string;
  residentName: string;
  roleLabel: 'مالک ساکن' | 'مستأجر' | 'واحد خالی';
  areaSqm: number;
  parkingLabel: string;
  storageLabel: string;
  plateText: string;
  phone: string;
  balanceRials: number;
  debtRials: number;
  lastPaidAt: string;
}

const DEFAULT_META_BY_ID: Record<string, Partial<EnrichedUnit>> = {
  w_1: {
    unitNumber: 'A-101',
    blockId: 'A',
    floorLabel: 'بلوک A • طبقه اول',
    residentName: 'مهندس رضایی',
    roleLabel: 'مالک ساکن',
    areaSqm: 125,
    parkingLabel: 'P-12',
    storageLabel: 'S-04',
    plateText: '۱۲ ب ۳۴۵ - ایران ۱۱',
    phone: '۰۹۱۲۳۴۵۶۷۸۹',
  },
  w_2: {
    unitNumber: 'A-104',
    blockId: 'A',
    floorLabel: 'بلوک A • طبقه دوم',
    residentName: 'دکتر محمدی',
    roleLabel: 'مستأجر',
    areaSqm: 110,
    parkingLabel: 'P-24',
    storageLabel: 'S-11',
    plateText: '۶۸ د ۷۹۱ - ایران ۲۲',
    phone: '۰۹۱۲۹۸۷۶۵۴۳',
  },
  w_3: {
    unitNumber: 'B-203',
    blockId: 'B',
    floorLabel: 'بلوک B • طبقه سوم',
    residentName: 'خانم کریمی',
    roleLabel: 'مالک ساکن',
    areaSqm: 145,
    parkingLabel: 'P-05 / P-06',
    storageLabel: 'S-18',
    plateText: '۴۴ ج ۲۱۸ - ایران ۶۶',
    phone: '۰۹۱۳۲۲۱۴۵۶۷',
  },
  w_4: {
    unitNumber: 'B-208',
    blockId: 'B',
    floorLabel: 'بلوک B • طبقه چهارم',
    residentName: 'آقای حسینی',
    roleLabel: 'مستأجر',
    areaSqm: 130,
    parkingLabel: 'P-31',
    storageLabel: 'S-22',
    plateText: '۸۸ ط ۵۱۲ - ایران ۱۱',
    phone: '۰۹۱۹۴۵۶۷۱۲۳',
  },
};

const VALID_TABS: FinanceTab[] = [
  'units',
  'charge',
  'reconcile',
  'lobby',
  'accountant',
  'petty',
  'voucher',
];

export const MobileFinancePage: React.FC<Props> = ({ onNavigate, onSyncChanged }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as FinanceTab) || 'units';
  const [subTab, setSubTab] = useState<FinanceTab>(
    VALID_TABS.includes(initialTab) ? initialTab : 'units',
  );

  const [wallets, setWallets] = useState<Array<Record<string, any>>>([]);
  const [blockFilter, setBlockFilter] = useState<'ALL' | 'A' | 'B' | 'C'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'all' | 'debt' | 'settled'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busyId, setBusyId] = useState('');
  const [voucherApproved, setVoucherApproved] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<EnrichedUnit | null>(null);

  useEffect(() => {
    const q = searchParams.get('tab') as FinanceTab | null;
    if (q && VALID_TABS.includes(q) && q !== subTab) {
      setSubTab(q);
    }
  }, [searchParams, subTab]);

  const switchTab = (next: FinanceTab) => {
    setSubTab(next);
    setSearchParams({ tab: next }, { replace: true });
    setFeedback('');
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await mobileApi.finance();
      setWallets(res.data?.wallets ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خواندن حساب‌ها ممکن نشد.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handlePay = async (walletId: string, label: string) => {
    setBusyId(walletId);
    setFeedback('');
    try {
      await mobileApi.payFinanceWallet(walletId);
      setFeedback(`تسویه شارژ «${label}» ثبت شد.`);
      onSyncChanged?.();
      await load();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'ثبت پرداخت انجام نشد.');
    } finally {
      setBusyId('');
    }
  };

  const handleRemind = async (walletId: string, label: string) => {
    setBusyId(`rem_${walletId}`);
    setFeedback('');
    try {
      await mobileApi.remindFinanceWallet(label);
      setFeedback(`پیامک یادآوری برای «${label}» ارسال شد.`);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'ارسال پیامک انجام نشد.');
    } finally {
      setBusyId('');
    }
  };

  const enrichedUnits: EnrichedUnit[] = wallets.map((w, idx) => {
    const preset = DEFAULT_META_BY_ID[w.id] || {};
    const rawLabel = String(w.unitLabel || w.id || '');
    return {
      id: String(w.id || `w_${idx}`),
      unitNumber: preset.unitNumber || `A-10${idx + 1}`,
      blockId: preset.blockId || (rawLabel.includes('بلوک B') ? 'B' : 'A'),
      floorLabel: preset.floorLabel || rawLabel,
      residentName: preset.residentName || rawLabel,
      roleLabel: preset.roleLabel || 'مالک ساکن',
      areaSqm: preset.areaSqm || 120,
      parkingLabel: preset.parkingLabel || 'P-01',
      storageLabel: preset.storageLabel || 'S-01',
      plateText: preset.plateText || '۱۲ ب ۳۴۵ - ایران ۱۱',
      phone: preset.phone || '۰۹۱۲۰۰۰۰۰۰۰',
      balanceRials: Number(w.balanceRials || 0),
      debtRials: Number(w.debtRials || 0),
      lastPaidAt: String(w.lastPaidAt || '۱۴۰۵/۰۸/۰۴'),
    };
  });

  const filteredUnits = enrichedUnits.filter((u) => {
    if (blockFilter !== 'ALL' && u.blockId !== blockFilter) return false;
    if (statusFilter === 'debt' && u.debtRials <= 0) return false;
    if (statusFilter === 'settled' && u.debtRials > 0) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim();
      const hay = `${u.unitNumber} ${u.residentName} ${u.plateText} ${u.floorLabel}`;
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const totalDebtRials = enrichedUnits.reduce((acc, u) => acc + u.debtRials, 0);
  const totalBalanceRials = enrichedUnits.reduce((acc, u) => acc + u.balanceRials, 0);
  const settledCount = enrichedUnits.filter((u) => u.debtRials <= 0).length;

  return (
    <div className="flex flex-col gap-3.5 pb-4" dir="rtl">
      {/* Unified Sub-Menu covering ALL 7 Finance Stitch screens (_4, _2, _20, _19, _6, _15, _13) */}
      <SubMenuTabs
        active={subTab}
        onChange={(id) => switchTab(id as FinanceTab)}
        items={[
          { id: 'units', label: 'واحدها', icon: 'domain' },
          { id: 'charge', label: 'شارژ و صندوق', icon: 'calculate' },
          { id: 'reconcile', label: 'تطبیق بانکی', icon: 'document_scanner' },
          { id: 'lobby', label: 'پوستر لابی', icon: 'print' },
          { id: 'accountant', label: 'میز حسابدار', icon: 'account_balance' },
          { id: 'petty', label: 'تنخواه و بودجه', icon: 'analytics' },
          { id: 'voucher', label: 'سند پایا', icon: 'receipt_long' },
        ]}
      />

      {feedback && (
        <NoticeBanner message={feedback} tone="success" onClose={() => setFeedback('')} />
      )}

      {/* TAB 1: Stitch _4 — Units & Blocks + Unit Dossier Modal */}
      {subTab === 'units' && (
        <div className="space-y-3.5">
          <HeroSummaryCard
            title="مدیریت بلوک‌ها و واحدها"
            subtitle={`۴۸ واحد در ۳ بلوک • ${enrichedUnits.length.toLocaleString('fa-IR')} پرونده فعال`}
            badge="وصولی ۹۱.۶٪"
            stats={[
              { label: 'موجودی (تومان)', value: fmtTomans(totalBalanceRials) },
              {
                label: 'تسویه کامل',
                value: `${settledCount.toLocaleString('fa-IR')} واحد`,
                accent: 'positive',
              },
              {
                label: 'معوقات (تومان)',
                value: fmtTomans(totalDebtRials),
                accent: 'danger',
              },
            ]}
          />

          {/* Compact Filter Bar */}
          <div className="space-y-2">
            <div className="relative">
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجوی واحد، ساکن یا پلاک..."
                className="w-full h-10 pr-9 pl-3 rounded-xl bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/70 text-[12.5px] border border-outline-variant/30 focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-1.5">
                {(['ALL', 'A', 'B', 'C'] as const).map((blk) => (
                  <button
                    key={blk}
                    type="button"
                    onClick={() => setBlockFilter(blk)}
                    className={`h-8 px-3 rounded-xl text-[12px] font-medium transition-colors whitespace-nowrap ${
                      blockFilter === blk
                        ? 'bg-primary-container text-on-primary-container font-semibold'
                        : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant/45'
                    }`}
                  >
                    {blk === 'ALL' ? 'همه بلوک‌ها' : `بلوک ${blk}`}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                {(['all', 'debt', 'settled'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`h-8 px-2.5 rounded-xl text-[12px] font-medium transition-colors whitespace-nowrap ${
                      statusFilter === st
                        ? 'bg-primary-container text-on-primary-container font-semibold'
                        : 'bg-surface-container-low text-on-surface-variant'
                    }`}
                  >
                    {st === 'all' ? 'همه' : st === 'debt' ? 'بدهکار' : 'تسویه'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <SurfaceCard className="text-center text-[12.5px] text-on-surface-variant">
              در حال دریافت اطلاعات...
            </SurfaceCard>
          ) : error ? (
            <NoticeBanner message={error} tone="danger" />
          ) : (
            <div className="space-y-2.5">
              {filteredUnits.map((unit) => {
                const inDebt = unit.debtRials > 0;
                return (
                  <SurfaceCard key={unit.id} className="p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-11 h-11 rounded-xl bg-primary-container/65 text-on-primary-container flex flex-col items-center justify-center font-bold shrink-0">
                          <span className="text-[12.5px] font-numeric-stat leading-tight">
                            {unit.unitNumber}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-[14px] font-semibold text-on-surface mb-0 truncate">
                            {unit.residentName}
                          </h3>
                          <p className="text-[13px] text-on-surface-variant mt-0.5 mb-0 truncate">
                            {unit.floorLabel} • {unit.roleLabel}
                          </p>
                        </div>
                      </div>

                      <StatusPill
                        label={inDebt ? 'بدهکار' : 'تسویه'}
                        tone={inDebt ? 'danger' : 'positive'}
                      />
                    </div>

                    {/* Concise Metadata Strip */}
                    <div className="grid grid-cols-3 gap-2 px-3 py-2 rounded-xl bg-surface-container-low text-[12px] text-on-surface-variant">
                      <span className="truncate">پارکینگ {unit.parkingLabel}</span>
                      <span className="truncate">انباری {unit.storageLabel}</span>
                      <span className="truncate font-numeric-stat font-medium text-on-surface">
                        {unit.plateText}
                      </span>
                    </div>

                    {/* Financial Status & Unified Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-surface-container-high gap-2 flex-wrap">
                      <div>
                        <span className="text-[12px] text-on-surface-variant block">
                          {inDebt ? 'مانده بدهی' : 'موجودی بستانکار'}
                        </span>
                        <span
                          className={`text-[14px] font-bold font-numeric-stat ${
                            inDebt ? 'text-error' : 'text-secondary'
                          }`}
                        >
                          {fmtTomans(inDebt ? unit.debtRials : unit.balanceRials)} تومان
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <StitchButton
                          variant="secondary"
                          size="sm"
                          onClick={() => setSelectedUnit(unit)}
                        >
                          پرونده
                        </StitchButton>
                        {inDebt && (
                          <>
                            <StitchButton
                              variant="secondary"
                              size="sm"
                              disabled={busyId === `rem_${unit.id}`}
                              onClick={() => void handleRemind(unit.id, unit.floorLabel)}
                            >
                              پیامک
                            </StitchButton>
                            <StitchButton
                              size="sm"
                              disabled={busyId === unit.id}
                              onClick={() => void handlePay(unit.id, unit.floorLabel)}
                            >
                              {busyId === unit.id ? '...' : 'تسویه'}
                            </StitchButton>
                          </>
                        )}
                      </div>
                    </div>
                  </SurfaceCard>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Stitch _2 — Charge Accounting */}
      {subTab === 'charge' && (
        <FinanceChargeTab onNavigate={onNavigate} onFeedback={setFeedback} />
      )}

      {/* TAB 3: Stitch _20 — Smart Bank Reconciliation */}
      {subTab === 'reconcile' && (
        <FinanceReconcileTab
          onNavigate={onNavigate}
          onSyncChanged={onSyncChanged}
          onFeedback={setFeedback}
        />
      )}

      {/* TAB 4: Stitch _19 — Printable Lobby A4 Poster */}
      {subTab === 'lobby' && <FinanceLobbyPosterTab onFeedback={setFeedback} />}

      {/* TAB 5: Stitch _6 — Accountant Specialized Desk */}
      {subTab === 'accountant' && (
        <FinanceAccountantTab onNavigate={onNavigate} onFeedback={setFeedback} />
      )}

      {/* TAB 6: Stitch _15 — Petty Cash & Budget Variance Analytics */}
      {subTab === 'petty' && (
        <FinancePettyCashTab
          onNavigate={onNavigate}
          onSyncChanged={onSyncChanged}
          onFeedback={setFeedback}
        />
      )}

      {/* TAB 7: Stitch _13 — Paya Payment Voucher VCH-402-882 */}
      {subTab === 'voucher' && (
        <div className="space-y-3.5">
          <HeroSummaryCard
            title="سند پرداخت پایا (VCH-402-882)"
            subtitle="اورهال بوسترپمپ بلوک B • عطف به نامه NL-B-1402"
            badge={voucherApproved ? 'ارسال‌شده به بانک' : 'آماده پرداخت'}
            stats={[
              { label: 'مبلغ خالص (تومان)', value: '۱۸,۵۰۰,۰۰۰' },
              { label: 'شناسه پیگیری', value: 'PAYA-91' },
              { label: 'تاریخ سند', value: '۱۴۰۵/۰۸/۲۴', accent: 'positive' },
            ]}
          />

          <SurfaceCard className="space-y-3">
            <SectionHeader
              title="ذینفع و حساب مقصد"
              icon="account_balance"
              action={<StatusPill label="شبا استعلام‌شده" tone="positive" />}
            />
            <div className="space-y-2 text-[12px]">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">پیمانکار:</span>
                <strong className="text-on-surface">شرکت پمپ‌سازان نوین</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">بانک مقصد:</span>
                <span className="font-semibold text-on-surface">بانک ملت • شعبه مرکزی</span>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-container-low flex items-center justify-between gap-2">
                <span className="text-[12px] font-bold text-primary font-numeric-stat" dir="ltr">
                  IR42 0120 0000 0000 8451 2365 41
                </span>
                <StitchButton
                  variant="secondary"
                  size="sm"
                  icon="content_copy"
                  onClick={() => {
                    void navigator.clipboard?.writeText('IR420120000000008451236541');
                    setFeedback('شماره شبا کپی شد.');
                  }}
                >
                  کپی
                </StitchButton>
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard className="space-y-2.5">
            <SectionHeader
              title="آرتیکل سند حسابداری"
              icon="table_chart"
              action={<StatusPill label="تراز صفر" tone="positive" />}
            />
            <div className="overflow-hidden rounded-xl border border-surface-container-high">
              <table className="w-full text-right border-collapse text-[11.5px]">
                <thead>
                  <tr className="bg-surface-container-low text-on-surface-variant border-b border-surface-container-high">
                    <th className="py-2 px-2.5 font-semibold">حساب معین</th>
                    <th className="py-2 px-2 font-semibold text-left">بدهکار</th>
                    <th className="py-2 px-2 font-semibold text-left">بستانکار</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-high">
                  <tr>
                    <td className="py-2 px-2.5 font-semibold text-on-surface">
                      تعمیرات اساسی تاسیسات (بلوک B)
                    </td>
                    <td className="py-2 px-2 text-left font-bold font-numeric-stat">۱۸,۵۰۰,۰۰۰</td>
                    <td className="py-2 px-2 text-left text-on-surface-variant">—</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-2.5 font-semibold text-on-surface">
                      بانک سامان - صندوق ذخیره شهرک
                    </td>
                    <td className="py-2 px-2 text-left text-on-surface-variant">—</td>
                    <td className="py-2 px-2 text-left font-bold text-secondary font-numeric-stat">
                      ۱۸,۵۰۰,۰۰۰
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </SurfaceCard>

          <div className="grid grid-cols-2 gap-2">
            {onNavigate && (
              <StitchButton
                variant="secondary"
                icon="description"
                onClick={() => onNavigate('letters?view=detail')}
              >
                نامه NL-B-1402
              </StitchButton>
            )}
            {onNavigate && (
              <StitchButton
                variant="secondary"
                icon="water_damage"
                onClick={() => onNavigate('facilities?tab=leaks')}
              >
                پرونده‌های تاسیسات
              </StitchButton>
            )}
          </div>

          <StitchButton
            icon="verified"
            className="w-full"
            onClick={() => {
              setVoucherApproved(true);
              setFeedback('سند پرداخت VCH-402-882 تایید نهایی و به صف پایا ارسال شد.');
            }}
          >
            {voucherApproved ? 'تایید نهایی انجام شد (PAYA-91)' : 'تایید نهایی و ارسال به پایا'}
          </StitchButton>
        </div>
      )}

      {/* Missing Screen Built: Unit Dossier Modal (پرونده کامل واحد) */}
      {selectedUnit && (
        <div
          className="fixed inset-0 z-50 bg-black/45 flex items-end sm:items-center justify-center p-3"
          role="dialog"
          aria-modal="true"
          aria-label={`پرونده واحد ${selectedUnit.unitNumber}`}
        >
          <div className="bg-surface-container-lowest rounded-2xl w-full max-w-md p-4 shadow-floating space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[14px] font-bold text-on-surface mb-0">
                  پرونده واحد {selectedUnit.unitNumber} — {selectedUnit.residentName}
                </h3>
                <span className="text-[11px] text-on-surface-variant">
                  {selectedUnit.floorLabel} • {selectedUnit.roleLabel}
                </span>
              </div>
              <button
                type="button"
                aria-label="بستن"
                onClick={() => setSelectedUnit(null)}
                className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="bg-surface-container-low rounded-xl p-3 space-y-1.5 text-[12px]">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">تلفن ثبت‌شده:</span>
                <strong className="font-numeric-stat">{selectedUnit.phone}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">پارکینگ / انباری:</span>
                <strong>
                  {selectedUnit.parkingLabel} / {selectedUnit.storageLabel}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">پلاک مجاز ALPR:</span>
                <strong className="text-primary font-numeric-stat">{selectedUnit.plateText}</strong>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {onNavigate && (
                <StitchButton
                  variant="secondary"
                  icon="directions_car"
                  onClick={() => {
                    const plate = selectedUnit.plateText;
                    setSelectedUnit(null);
                    onNavigate(`guard?tab=gate&plate=${encodeURIComponent(plate)}`);
                  }}
                >
                  ثبت تردد پلاک در گیت
                </StitchButton>
              )}
              {onNavigate && (
                <StitchButton
                  variant="secondary"
                  icon="water_damage"
                  onClick={() => {
                    setSelectedUnit(null);
                    onNavigate('facilities?tab=report');
                  }}
                >
                  ثبت گزارش تاسیسات
                </StitchButton>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};