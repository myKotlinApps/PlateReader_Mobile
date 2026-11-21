import React, { useEffect, useState } from 'react';
import { mobileApi } from './mobileApi';
import { hasAppPin, clearAppPin, registerPushChannel, setAppPin } from './nativeBridge';
import { loadMobileAuth } from './remoteTransport';
import { AppearanceSettingsPanel } from './components/AppearanceSettingsPanel';
import { UserProfilePanel } from './components/UserProfilePanel';
import type { RbacUserRecord } from './rbac/roles';
import {
  DEFAULT_APPEARANCE_PREFS,
  type UserAppearancePrefs,
} from './theme/palettes';
import {
  NoticeBanner,
  SectionHeader,
  StatusPill,
  StitchButton,
  SubMenuTabs,
  SurfaceCard,
} from './ui/StitchKit';

interface Props {
  onOpenRoute: (route: string) => void;
  onNavigateTab?: (tab: string) => void;
  appearancePrefs?: UserAppearancePrefs;
  onChangeAppearancePrefs?: (next: UserAppearancePrefs) => void;
  userDisplayName?: string;
  currentUser?: RbacUserRecord;
  onUserUpdated?: (user: RbacUserRecord) => void;
  dark?: boolean;
  onToggleTheme?: () => void;
}

export const MobileNotificationsPage: React.FC<Props> = ({
  onOpenRoute,
  onNavigateTab,
  appearancePrefs,
  onChangeAppearancePrefs,
  userDisplayName,
  currentUser,
  onUserUpdated,
  dark = false,
  onToggleTheme,
}) => {
  const [sub, setSub] = useState<'events' | 'settings'>('events');
  const [localPrefs, setLocalPrefs] = useState<UserAppearancePrefs>(
    appearancePrefs ?? DEFAULT_APPEARANCE_PREFS,
  );
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
        ? 'اعلان فوری روی این دستگاه فعال شد.'
        : status === 'denied'
          ? 'مجوز اعلان در مرورگر مسدود است.'
          : 'این مرورگر از اعلان پوش پشتیبانی نمی‌کند.',
    );
  };

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setAppPin(pinInput);
      setPinInput('');
      setPinEnabled(true);
      setPinMsg('قفل پین روی این دستگاه فعال شد.');
    } catch (err) {
      setPinMsg(err instanceof Error ? err.message : 'ثبت پین ناموفق بود.');
    }
  };

  return (
    <div className="flex flex-col gap-3.5 pb-4" dir="rtl">
      <SubMenuTabs
        active={sub}
        onChange={(id) => setSub(id as typeof sub)}
        items={[
          { id: 'events', label: 'رویدادها و اعلان‌ها', icon: 'notifications', badge: items.length },
          { id: 'settings', label: 'پروفایل و شخصی‌سازی', icon: 'account_circle' },
        ]}
      />

      {sub === 'events' && (
        <SurfaceCard className="space-y-2.5">
          <SectionHeader title="آخرین اعلان‌های سامانه" icon="notifications" />
          {items.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-on-surface-variant">
              اعلان جدیدی ثبت نشده است.
            </div>
          ) : (
            <div className="divide-y divide-surface-container-high">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onOpenRoute(item.route || '/m')}
                  className="w-full py-3 flex items-center justify-between gap-2.5 text-right hover:bg-surface-container-low/60 rounded-xl px-1.5 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <strong className="block text-[14px] font-semibold text-on-surface truncate">
                      {item.title}
                    </strong>
                    <span className="block text-[13px] text-on-surface-variant truncate mt-0.5">
                      {item.detail}
                    </span>
                  </div>
                  <StatusPill label={item.status || 'جدید'} tone="primary" />
                </button>
              ))}
            </div>
          )}
        </SurfaceCard>
      )}

      {sub === 'settings' && (
        <div className="space-y-3.5">
          {currentUser && onUserUpdated && onToggleTheme ? (
            <UserProfilePanel
              user={currentUser}
              onUserUpdated={onUserUpdated}
              appearancePrefs={appearancePrefs ?? localPrefs}
              onChangeAppearancePrefs={(next) => {
                setLocalPrefs(next);
                onChangeAppearancePrefs?.(next);
              }}
              dark={dark}
              onToggleTheme={onToggleTheme}
            />
          ) : (
            <AppearanceSettingsPanel
              prefs={appearancePrefs ?? localPrefs}
              onChangePrefs={(next) => {
                setLocalPrefs(next);
                onChangeAppearancePrefs?.(next);
              }}
              userDisplayName={userDisplayName}
            />
          )}

          <SurfaceCard className="space-y-3">
            <SectionHeader title="اعلان فوری و قفل برنامه" icon="lock" />

            <StitchButton
              variant="secondary"
              icon="notifications_active"
              className="w-full"
              onClick={() => void enablePush()}
            >
              فعال‌سازی اعلان پوش روی این گوشی
            </StitchButton>

            {pushStatus && (
              <NoticeBanner message={pushStatus} tone="info" onClose={() => setPushStatus('')} />
            )}

            <form onSubmit={handleSavePin} className="space-y-2.5 pt-2 border-t border-surface-container-high">
              <label className="block text-[13px] font-medium text-on-surface-variant">
                پین قفل برنامه (۴ تا ۸ رقم)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  placeholder={pinEnabled ? 'تغییر پین فعلی...' : 'تعیین پین جدید...'}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="flex-1 h-10 px-3 rounded-xl bg-surface-container-low text-[13.5px] border border-outline-variant/45"
                />
                <StitchButton type="submit" size="md">
                  ثبت
                </StitchButton>
                {pinEnabled && (
                  <StitchButton
                    variant="ghost"
                    size="md"
                    onClick={() => void clearAppPin().then(() => setPinEnabled(false))}
                  >
                    حذف
                  </StitchButton>
                )}
              </div>
              {pinMsg && (
                <NoticeBanner message={pinMsg} tone="success" onClose={() => setPinMsg('')} />
              )}
            </form>
          </SurfaceCard>

          {onNavigateTab && (
            <SurfaceCard className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <strong className="block text-[14px] font-semibold text-on-surface truncate">
                  آرشیو ۲۰ طرح مرجع سامانه
                </strong>
                <span className="block text-[13px] text-on-surface-variant truncate">
                  مشاهده مستقیم صفحات طراحی‌شده
                </span>
              </div>
              <StitchButton
                variant="secondary"
                size="sm"
                onClick={() => onNavigateTab('stitch')}
              >
                مشاهده
              </StitchButton>
            </SurfaceCard>
          )}
        </div>
      )}
    </div>
  );
};