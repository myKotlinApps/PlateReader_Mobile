import React, { useState } from 'react';
import { SectionHeader, StatusPill, StitchButton, SurfaceCard } from '../ui/StitchKit';

interface Props {
  onFeedback: (msg: string) => void;
}

const LOBBY_UNITS = [
  { unit: '۱۰۱', name: 'دکتر انصاری', cent: '..۰۱', debt: 'صفر', status: 'settled' },
  { unit: '۱۰۲', name: 'مهندس سلیمانی', cent: '..۰۲', debt: '۱,۶۰۰,۰۰۰', status: 'delayed' },
  { unit: '۲۰۱', name: 'خانواده رادمنش', cent: '..۰۳', debt: 'صفر', status: 'settled' },
  { unit: '۲۰۲', name: 'واحد استیجاری', cent: '..۰۴', debt: '۳,۲۰۰,۰۰۰', status: 'art10' },
  { unit: '۳۰۱', name: 'حاج‌آقا مهدوی', cent: '..۰۵', debt: 'صفر', status: 'settled' },
  { unit: '۳۰۲', name: 'خانم توکلی', cent: '..۰۶', debt: 'صفر', status: 'settled' },
  { unit: '۴۰۱', name: 'مهندس فرهودی', cent: '..۰۷', debt: '۱,۶۰۰,۰۰۰', status: 'delayed' },
  { unit: '۴۰۲', name: 'مهندس بهرامی', cent: '..۰۸', debt: 'صفر', status: 'settled' },
];

export const FinanceLobbyPosterTab: React.FC<Props> = ({ onFeedback }) => {
  const [privacyMode, setPrivacyMode] = useState(false);

  const exportCsv = () => {
    const header = 'واحد,ساکن,شناسه یکان,مانده بدهی,وضعیت\n';
    const rows = LOBBY_UNITS.map(
      (u) =>
        `${u.unit},"${privacyMode ? 'محرمانه' : u.name}",${u.cent},${u.debt},${
          u.status === 'settled' ? 'تسویه' : u.status === 'art10' ? 'ماده ۱۰' : 'مهلت پرداخت'
        }`,
    ).join('\n');
    const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lobby-charge-balance-B-1403-08.csv';
    a.click();
    URL.revokeObjectURL(url);
    onFeedback('فایل اکسل تراز شارژ بلوک B دانلود شد.');
  };

  return (
    <div className="space-y-3.5">
      <SurfaceCard className="space-y-3">
        <SectionHeader
          title="پوستر تابلوی اعلانات لابی (A4)"
          icon="print"
          action={<StatusPill label="آبان ۱۴۰۳" tone="primary" />}
        />
        <div className="grid grid-cols-3 gap-2">
          <StitchButton size="sm" icon="print" onClick={() => window.print()}>
            چاپ A4
          </StitchButton>
          <StitchButton
            variant="secondary"
            size="sm"
            icon={privacyMode ? 'visibility' : 'visibility_off'}
            onClick={() => setPrivacyMode((p) => !p)}
          >
            {privacyMode ? 'نمایش نام' : 'محرمانه'}
          </StitchButton>
          <StitchButton variant="secondary" size="sm" icon="table_view" onClick={exportCsv}>
            اکسل
          </StitchButton>
        </div>
      </SurfaceCard>

      {/* Clean A4 Printable Sheet */}
      <article className="bg-white text-[#1b2533] rounded-2xl border border-outline-variant/55 shadow-card p-4 space-y-3.5">
        <div className="flex items-start justify-between gap-2 pb-3 border-b border-surface-container-high">
          <div className="min-w-0 flex-1">
            <h4 className="text-[14.5px] font-bold text-on-primary-container mb-0 truncate">
              تراز ماهانه شارژ بلوک B — پردیس نیلوفر
            </h4>
            <p className="text-[13px] text-on-surface-variant mb-0 mt-0.5 truncate">
              گزارش شفافیت مالی • آبان‌ماه ۱۴۰۳
            </p>
          </div>
          <span className="text-[12px] text-on-surface-variant font-numeric-stat shrink-0">
            NLF-B-08
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-surface-container-low rounded-xl p-2.5">
            <span className="text-[12px] text-on-surface-variant block">شارژ مصوب</span>
            <strong className="text-[14.5px] font-bold text-on-primary-container font-numeric-stat">
              ۳۸,۴۰۰,۰۰۰ ت
            </strong>
          </div>
          <div className="bg-secondary-container/60 rounded-xl p-2.5">
            <span className="text-[12px] text-on-secondary-container block">وصول‌شده (۷۵٪)</span>
            <strong className="text-[14.5px] font-bold text-secondary font-numeric-stat">
              ۲۸,۸۰۰,۰۰۰ ت
            </strong>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-outline-variant/45">
          <table className="w-full text-right border-collapse text-[12.5px]">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant font-semibold">
                <th className="py-2 px-2 text-center">واحد</th>
                <th className="py-2 px-2">ساکن</th>
                <th className="py-2 px-2 text-left">بدهی</th>
                <th className="py-2 px-2 text-center">وضعیت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high">
              {LOBBY_UNITS.map((u) => (
                <tr key={u.unit}>
                  <td className="py-2 px-2 text-center font-semibold font-numeric-stat">
                    {u.unit}
                  </td>
                  <td className="py-2 px-2 truncate max-w-[110px]">
                    {privacyMode ? 'محرمانه' : u.name}
                  </td>
                  <td
                    className={`py-2 px-2 text-left font-semibold font-numeric-stat ${
                      u.status === 'settled' ? 'text-secondary' : 'text-error'
                    }`}
                  >
                    {u.debt}
                  </td>
                  <td className="py-2 px-2 text-center">
                    <StatusPill
                      label={
                        u.status === 'settled'
                          ? 'تسویه'
                          : u.status === 'art10'
                            ? 'ماده ۱۰'
                            : 'مهلت'
                      }
                      tone={
                        u.status === 'settled'
                          ? 'positive'
                          : u.status === 'art10'
                            ? 'danger'
                            : 'neutral'
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-surface-container-low p-3 rounded-xl flex items-center gap-3">
          <div className="w-12 h-12 bg-white p-1 rounded-lg border border-outline-variant/45 shrink-0 flex items-center justify-center">
            <svg className="w-full h-full fill-[#3b5998]" viewBox="0 0 100 100">
              <rect fill="none" height="28" rx="3" stroke="#3b5998" strokeWidth="6" width="28" x="5" y="5" />
              <rect fill="#3b5998" height="14" width="14" x="12" y="12" />
              <rect fill="none" height="28" rx="3" stroke="#3b5998" strokeWidth="6" width="28" x="67" y="5" />
              <rect fill="#3b5998" height="14" width="14" x="74" y="12" />
              <rect fill="none" height="28" rx="3" stroke="#3b5998" strokeWidth="6" width="28" x="5" y="67" />
              <rect fill="#3b5998" height="14" width="14" x="12" y="74" />
              <rect height="12" width="12" x="44" y="44" />
              <rect height="14" width="14" x="72" y="70" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <strong className="block text-[13px] font-semibold text-on-surface truncate font-numeric-stat">
              شبا: IR84-0120-0000-4589-2101
            </strong>
            <span className="block text-[12.5px] text-on-surface-variant truncate mt-0.5">
              کد دو رقمی واحد را در انتهای مبلغ واریز وارد کنید.
            </span>
          </div>
        </div>
      </article>
    </div>
  );
};
