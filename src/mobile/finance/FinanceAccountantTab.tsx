import React, { useState } from 'react';
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
  onFeedback: (msg: string) => void;
}

export const FinanceAccountantTab: React.FC<Props> = ({ onNavigate, onFeedback }) => {
  const [deskTab, setDeskTab] = useState<'receipts' | 'checks' | 'legal'>('receipts');
  const [approvedIds, setApprovedIds] = useState<string[]>([]);

  const receipts = [
    { id: 'rcp_1', unit: 'واحد A-104 (دکتر محمدی)', amount: '۳,۲۰۰,۰۰۰ تومان', trace: 'پایا ۶۸۴۱۲۳' },
    { id: 'rcp_2', unit: 'واحد B-208 (آقای حسینی)', amount: '۲,۸۵۰,۰۰۰ تومان', trace: 'کارت‌خوان مرکزی' },
    { id: 'rcp_3', unit: 'واحد C-301 (خانم رضوی)', amount: '۱,۹۵۰,۰۰۰ تومان', trace: 'فیش بانک پاسارگاد' },
  ];

  const checks = [
    { id: 'chk_1', payee: 'شرکت آسانسور البرز', amount: '۲۴,۰۰۰,۰۰۰ تومان', due: '۱۴۰۵/۰۹/۰۵', status: 'ثبت صیادی' },
    { id: 'chk_2', payee: 'پمپ‌سازان نوین', amount: '۱۸,۵۰۰,۰۰۰ تومان', due: '۱۴۰۵/۰۹/۱۲', status: 'آماده امضا' },
  ];

  return (
    <div className="space-y-3.5">
      {/* Stitch _6 Accountant Desk Hero */}
      <HeroSummaryCard
        title="میز کار تخصصی حسابدار"
        subtitle="موازنه اسناد، تایید فیش‌ها و دفاتر قانونی"
        badge="سال مالی ۱۴۰۵"
        stats={[
          { label: 'بانک پاسارگاد (م.ت)', value: '۱۴۲.۰' },
          { label: 'تنخواه اجرایی (م.ت)', value: '۸.۵', accent: 'positive' },
          { label: 'معوقات ساکنین (م.ت)', value: '۲۴.۰', accent: 'danger' },
        ]}
      />

      {/* Sub-Menu inside Accountant Desk so screen stays compact and focused */}
      <SubMenuTabs
        active={deskTab}
        onChange={(id) => setDeskTab(id as typeof deskTab)}
        items={[
          { id: 'receipts', label: 'فیش‌های در انتظار', badge: receipts.length - approvedIds.length },
          { id: 'checks', label: 'چک‌های صیادی', badge: checks.length },
          { id: 'legal', label: 'اخطار ماده ۱۰' },
        ]}
      />

      {deskTab === 'receipts' && (
        <SurfaceCard className="space-y-3">
          <SectionHeader title="تایید فیش‌های واریزی ساکنین" icon="fact_check" />
          <div className="space-y-2">
            {receipts.map((r) => {
              const done = approvedIds.includes(r.id);
              return (
                <div
                  key={r.id}
                  className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/20 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <strong className="text-[13px] text-on-surface block truncate">{r.unit}</strong>
                    <span className="text-[11px] text-on-surface-variant">
                      {r.amount} • {r.trace}
                    </span>
                  </div>
                  {done ? (
                    <StatusPill label="ثبت سند شد" tone="positive" />
                  ) : (
                    <StitchButton
                      size="sm"
                      icon="check"
                      onClick={() => {
                        setApprovedIds((prev) => [...prev, r.id]);
                        onFeedback(`سند واریز ${r.unit} در دفتر روزنامه ثبت شد.`);
                      }}
                    >
                      تایید
                    </StitchButton>
                  )}
                </div>
              );
            })}
          </div>
        </SurfaceCard>
      )}

      {deskTab === 'checks' && (
        <SurfaceCard className="space-y-3">
          <SectionHeader
            title="سررسید چک‌های صیادی و پایا"
            icon="payments"
            action={
              onNavigate ? (
                <StitchButton
                  variant="ghost"
                  size="sm"
                  onClick={() => onNavigate('finance?tab=voucher')}
                >
                  سند VCH-882
                </StitchButton>
              ) : undefined
            }
          />
          <div className="space-y-2">
            {checks.map((c) => (
              <div
                key={c.id}
                className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/20 flex items-center justify-between gap-2"
              >
                <div>
                  <strong className="text-[13px] text-on-surface block">{c.payee}</strong>
                  <span className="text-[11px] text-on-surface-variant font-numeric-stat">
                    {c.amount} • سررسید {c.due}
                  </span>
                </div>
                <StatusPill label={c.status} tone="primary" />
              </div>
            ))}
          </div>
        </SurfaceCard>
      )}

      {deskTab === 'legal' && (
        <SurfaceCard className="space-y-3">
          <SectionHeader title="صدور اخطاریه ماده ۱۰ مکرر" icon="gavel" />
          <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/25 text-[12px] text-on-surface-variant">
            واحدهای دارای بیش از ۲ ماه معوقه (B-202 و A-104) مشمول ابلاغ اظهارنامه رسمی هستند.
          </div>
          <div className="grid grid-cols-2 gap-2">
            <StitchButton
              variant="danger"
              icon="gavel"
              onClick={() =>
                onFeedback('اخطاریه رسمی ماده ۱۰ مکرر برای واحدهای معوق ثبت و آماده چاپ شد.')
              }
            >
              صدور اخطار رسمی
            </StitchButton>
            {onNavigate && (
              <StitchButton
                variant="secondary"
                icon="print"
                onClick={() => onNavigate('finance?tab=lobby')}
              >
                تابلوی اعلانات لابی
              </StitchButton>
            )}
          </div>
        </SurfaceCard>
      )}
    </div>
  );
};
