import React, { useCallback, useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import { mobileApi } from './mobileApi';
import { MCard, MErrorState, MListItem, MPill, MSectionHeader } from './components';

const fmtRials = (v: unknown) => `${Math.round(Number(v || 0)).toLocaleString('fa-IR')} ریال`;

export const MobileFinancePage: React.FC = () => {
  const [wallets, setWallets] = useState<Array<Record<string, any>>>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="d-flex flex-column gap-3" dir="rtl">
        {[0, 1, 2].map((i) => (
          <div key={i} className="d-flex align-items-center gap-2">
            <span className="m-list-item__lead" style={{ width: 40, height: 40 }} />
            <div className="flex-grow-1 d-flex flex-column gap-2">
              <span className="m-skeleton" style={{ height: 14, width: '60%' }} />
              <span className="m-skeleton" style={{ height: 12, width: '40%' }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="d-flex flex-column gap-3" dir="rtl">
      <MCard>
        <MSectionHeader
          title="مالی و شارژ واحدها"
          sub="موجودی و بدهی هر واحد"
          action={<MPill>{wallets.length.toLocaleString('fa-IR')} حساب</MPill>}
        />
      </MCard>

      {error && (
        <MCard flat>
          <MErrorState
            title="خواندن حساب‌ها ممکن نشد"
            desc={error}
            action={
              <button type="button" className="m-btn m-btn--tonal m-btn--sm" onClick={() => void load()}>
                تلاش دوباره
              </button>
            }
          />
        </MCard>
      )}

      {!error && wallets.length === 0 && (
        <MCard flat>
          <MErrorState title="حسابی ثبت نشده است" desc="برای این کاربر هیچ حساب مالی تعریف نشده است." />
        </MCard>
      )}

      {!error && (
        <MCard flat className="p-0" style={{ overflow: 'hidden' }}>
          {wallets.map((w, idx) => {
            const inDebt = Number(w.debtRials || 0) > 0;
            return (
              <MListItem
                key={w.id || idx}
                lead={<Wallet size={18} />}
                title={w.unitLabel || w.id}
                sub={
                  <span className="d-flex flex-column gap-1">
                    <span>موجودی: {fmtRials(w.balanceRials)}</span>
                    {inDebt && <span style={{ color: 'var(--m-danger)' }}>بدهی: {fmtRials(w.debtRials)}</span>}
                  </span>
                }
                trail={<MPill tone={inDebt ? 'danger' : 'success'}>{inDebt ? 'بدهکار' : 'تسویه'}</MPill>}
              />
            );
          })}
        </MCard>
      )}
    </div>
  );
};