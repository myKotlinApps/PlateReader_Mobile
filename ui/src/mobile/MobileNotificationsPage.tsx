import React, { useEffect, useState } from 'react';
import { Bell, BellRing, Lock, Settings2 } from 'lucide-react';
import { mobileApi } from './mobileApi';
import { hasAppPin, clearAppPin, registerPushChannel, setAppPin } from './nativeBridge';
import { loadMobileAuth } from './remoteTransport';
import { MButton, MCard, MEmptyState, MInput, MListItem, MPill, MSectionHeader } from './components';

interface Props {
  onOpenRoute: (route: string) => void;
}

export const MobileNotificationsPage: React.FC<Props> = ({ onOpenRoute }) => {
  const [items, setItems] = useState<Array<Record<string, any>>>([]);
  const [pushStatus, setPushStatus] = useState('');
  const [pinEnabled, setPinEnabled] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinMsg, setPinMsg] = useState('');

  useEffect(() => {
    void mobileApi
      .notifications()
      .then((res) => setItems(res.data?.items ?? []))
      .catch(() => undefined);
    void hasAppPin().then(setPinEnabled);
  }, []);

  const enablePush = async () => {
    const auth = await loadMobileAuth();
    const status = await registerPushChannel(async (token, kind) => {
      await mobileApi.registerPushToken(token, kind, auth?.device_id);
    });
    setPushStatus(
      status === 'granted'
        ? 'اعلان فوری برای این دستگاه فعال شد.'
        : status === 'denied'
          ? 'مجوز اعلان در مرورگر/گوشی مسدود است.'
          : 'این مرورگر از اعلان پوش پشتیبانی نمی‌کند (در آیفون ابتدا Add to Home Screen بزنید).',
    );
  };

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setAppPin(pinInput);
      setPinInput('');
      setPinEnabled(true);
      setPinMsg('قفل پین ۴رقمی روی این گوشی فعال شد.');
    } catch (err) {
      setPinMsg(err instanceof Error ? err.message : 'ثبت پین ناموفق بود.');
    }
  };

  return (
    <div className="d-flex flex-column gap-3" dir="rtl">
      <MCard>
        <MSectionHeader title="اعلان و قفل گوشی" sub="اعلان فوری و محافظت با پین" />
        <MButton block onClick={() => void enablePush()} icon={<Bell size={17} />}>
          فعال‌سازی اعلان فوری روی این گوشی
        </MButton>
        {pushStatus && (
          <div className="m-note m-note--info mt-3">
            <Settings2 size={18} />
            <span>{pushStatus}</span>
          </div>
        )}

        <hr className="my-3" />

        <form onSubmit={handleSavePin} className="d-flex gap-2 align-items-start">
          <div className="flex-grow-1">
            <MInput
              type="password"
              inputMode="numeric"
              maxLength={8}
              label="پین قفل برنامه"
              placeholder={pinEnabled ? 'تغییر پین قفل (حداقل ۴ رقم)' : 'تعیین پین قفل برنامه'}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
            />
          </div>
          <MButton type="submit" variant="secondary" className="flex-shrink-0" icon={<Lock size={15} />}>
            ثبت
          </MButton>
          {pinEnabled && (
            <MButton
              type="button"
              variant="text"
              className="flex-shrink-0"
              onClick={() => void clearAppPin().then(() => setPinEnabled(false))}
            >
              حذف
            </MButton>
          )}
        </form>
        {pinMsg && (
          <div className="m-note m-note--success mt-3">
            <Lock size={18} />
            <span>{pinMsg}</span>
          </div>
        )}
      </MCard>

      <div>
        <MSectionHeader title="اعلان‌ها" sub="رویدادهای سامانه" />
        {items.length === 0 ? (
          <MCard flat>
            <MEmptyState icon={<BellRing size={28} />} title="اعلان جدیدی نیست" desc="هنوز رویداد جدیدی برای شما ثبت نشده است." />
          </MCard>
        ) : (
          <MCard flat className="p-0" style={{ overflow: 'hidden' }}>
            {items.map((item) => (
              <MListItem
                key={item.id}
                lead={<Bell size={18} />}
                title={item.title}
                sub={item.detail}
                trail={<MPill tone="info">{item.status}</MPill>}
                onClick={() => onOpenRoute(item.route || '/m')}
              />
            ))}
          </MCard>
        )}
      </div>
    </div>
  );
};