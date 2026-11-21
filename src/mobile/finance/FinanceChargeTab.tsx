import React, { useState } from 'react';
import { calculateUnitChargeTomans } from '../financeCalc';
import {
  HeroSummaryCard,
  SectionHeader,
  StatusPill,
  StitchButton,
  SurfaceCard,
} from '../ui/StitchKit';

interface Props {
  onNavigate?: (route: string) => void;
  onFeedback: (msg: string) => void;
}

export const FinanceChargeTab: React.FC<Props> = ({ onNavigate, onFeedback }) => {
  const [period, setPeriod] = useState('آبان ۱۴۰۵');
  const [baseFixed, setBaseFixed] = useState(1_500_000);
  const [ratePerSqm, setRatePerSqm] = useState(8_500);
  const [perOccupant, setPerOccupant] = useState(150_000);
  const [sampleArea, setSampleArea] = useState(125);
  const [sampleOcc, setSampleOcc] = useState(3);
  const [showIssueModal, setShowIssueModal] = useState(false);

  const sampleTotal = calculateUnitChargeTomans({
    baseFixedTomans: baseFixed,
    areaSqm: sampleArea,
    ratePerSqmTomans: ratePerSqm,
    occupants: sampleOcc,
    perOccupantTomans: perOccupant,
  });

  return (
    <div className="space-y-3.5">
      <HeroSummaryCard
        title={`حسابداری شارژ — دوره ${period}`}
        subtitle="صندوق ذخیره و وضعیت وصولی دوره جاری"
        badge="وصولی ۸۵.۵٪"
        stats={[
          { label: 'کل شارژ ماه (تومان)', value: '۴۵,۰۰۰,۰۰۰' },
          { label: 'وصول‌شده (تومان)', value: '۳۸,۵۰۰,۰۰۰', accent: 'positive' },
          { label: 'مانده معوق (تومان)', value: '۶,۵۰۰,۰۰۰', accent: 'danger' },
        ]}
      />

      {/* Charge Formula Calculator (Stitch _2) */}
      <SurfaceCard className="space-y-3">
        <SectionHeader
          title="فرمول مصوب محاسبه شارژ"
          icon="calculate"
          action={<StatusPill label="مصوبه مجمع" tone="primary" />}
        />

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-surface-container-low rounded-xl p-2.5 border border-outline-variant/20">
            <span className="text-[10.5px] text-on-surface-variant block">پایه ثابت</span>
            <strong className="text-[12.5px] font-bold font-numeric-stat text-on-surface">
              {baseFixed.toLocaleString('fa-IR')}
            </strong>
          </div>
          <div className="bg-surface-container-low rounded-xl p-2.5 border border-outline-variant/20">
            <span className="text-[10.5px] text-on-surface-variant block">ضریب متراژ</span>
            <strong className="text-[12.5px] font-bold font-numeric-stat text-on-surface">
              {ratePerSqm.toLocaleString('fa-IR')}
            </strong>
          </div>
          <div className="bg-surface-container-low rounded-xl p-2.5 border border-outline-variant/20">
            <span className="text-[10.5px] text-on-surface-variant block">سرانه نفرات</span>
            <strong className="text-[12.5px] font-bold font-numeric-stat text-on-surface">
              {perOccupant.toLocaleString('fa-IR')}
            </strong>
          </div>
        </div>

        {/* Live Simulator */}
        <div className="bg-surface-container-low/70 rounded-xl p-3 border border-outline-variant/25 space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">
                متراژ نمونه (مترمربع)
              </label>
              <input
                type="number"
                value={sampleArea}
                onChange={(e) => setSampleArea(Number(e.target.value) || 0)}
                className="w-full h-9 px-3 rounded-lg bg-surface-container-lowest text-[12.5px] font-numeric-stat font-bold border border-outline-variant/30"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">
                تعداد نفرات
              </label>
              <input
                type="number"
                value={sampleOcc}
                onChange={(e) => setSampleOcc(Number(e.target.value) || 0)}
                className="w-full h-9 px-3 rounded-lg bg-surface-container-lowest text-[12.5px] font-numeric-stat font-bold border border-outline-variant/30"
              />
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-outline-variant/25">
            <span className="text-[12px] text-on-surface-variant">شارژ محاسبه‌شده واحد:</span>
            <strong className="text-[14px] font-extrabold text-primary font-numeric-stat">
              {sampleTotal.toLocaleString('fa-IR')} تومان
            </strong>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <StitchButton
            icon="receipt_long"
            onClick={() => setShowIssueModal(true)}
            className="w-full"
          >
            صدور قبوض دوره جدید
          </StitchButton>
          {onNavigate && (
            <StitchButton
              variant="secondary"
              icon="document_scanner"
              onClick={() => onNavigate('finance?tab=reconcile')}
              className="w-full"
            >
              تطبیق هوشمند بانکی
            </StitchButton>
          )}
        </div>
      </SurfaceCard>

      {/* Fund & Reserve Balances */}
      <SurfaceCard className="space-y-2.5">
        <SectionHeader title="موجودی صندوق‌های مجتمع" icon="account_balance" />
        <div className="divide-y divide-surface-container-high text-[12.5px]">
          <div className="py-2 flex items-center justify-between">
            <span className="text-on-surface">صندوق جاری شارژ</span>
            <strong className="font-numeric-stat text-on-surface">۳۸,۵۰۰,۰۰۰ تومان</strong>
          </div>
          <div className="py-2 flex items-center justify-between">
            <span className="text-on-surface">صندوق ذخیره عمرانی</span>
            <strong className="font-numeric-stat text-primary">۱۴۲,۰۰۰,۰۰۰ تومان</strong>
          </div>
          <div className="py-2 flex items-center justify-between">
            <span className="text-on-surface">تنخواه‌گردان بلوک B</span>
            <strong className="font-numeric-stat text-secondary">۱۲,۱۵۰,۰۰۰ تومان</strong>
          </div>
        </div>
      </SurfaceCard>

      {/* Issue New Period Modal */}
      {showIssueModal && (
        <div
          className="fixed inset-0 z-50 bg-black/45 flex items-end sm:items-center justify-center p-3"
          role="dialog"
          aria-modal="true"
          aria-label="صدور قبوض دوره جدید"
        >
          <div className="bg-surface-container-lowest rounded-2xl w-full max-w-md p-4 shadow-floating space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-bold text-on-surface mb-0">
                صدور جمعی قبوض شارژ ماهانه
              </h3>
              <button
                type="button"
                aria-label="بستن"
                onClick={() => setShowIssueModal(false)}
                className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div>
              <label className="block text-[11.5px] font-semibold text-on-surface-variant mb-1">
                عنوان دوره
              </label>
              <input
                type="text"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-[12.5px] border border-outline-variant/30"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10.5px] text-on-surface-variant mb-1">پایه ثابت</label>
                <input
                  type="number"
                  value={baseFixed}
                  onChange={(e) => setBaseFixed(Number(e.target.value) || 0)}
                  className="w-full h-9 px-2 rounded-lg bg-surface-container-low text-[12px] font-numeric-stat border border-outline-variant/30"
                />
              </div>
              <div>
                <label className="block text-[10.5px] text-on-surface-variant mb-1">ضریب متراژ</label>
                <input
                  type="number"
                  value={ratePerSqm}
                  onChange={(e) => setRatePerSqm(Number(e.target.value) || 0)}
                  className="w-full h-9 px-2 rounded-lg bg-surface-container-low text-[12px] font-numeric-stat border border-outline-variant/30"
                />
              </div>
              <div>
                <label className="block text-[10.5px] text-on-surface-variant mb-1">سرانه نفر</label>
                <input
                  type="number"
                  value={perOccupant}
                  onChange={(e) => setPerOccupant(Number(e.target.value) || 0)}
                  className="w-full h-9 px-2 rounded-lg bg-surface-container-low text-[12px] font-numeric-stat border border-outline-variant/30"
                />
              </div>
            </div>
            <StitchButton
              className="w-full"
              icon="check_circle"
              onClick={() => {
                setShowIssueModal(false);
                onFeedback(`قبوض شارژ دوره «${period}» برای ۴۸ واحد صادر و پیامک ابلاغ شد.`);
              }}
            >
              صدور و ارسال پیامک ابلاغ
            </StitchButton>
          </div>
        </div>
      )}
    </div>
  );
};
