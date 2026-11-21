import React, { useEffect, useState } from 'react';
import { rbacApi, type RbacSessionState, type RoleDirectoryCard } from '../rbac/rbacApi';
import { formatRemainingDurationFa, type UserRoleId } from '../rbac/roles';
import { NoticeBanner, StatusPill, StitchButton, SurfaceCard } from '../ui/StitchKit';
import { ComplexSpinner } from '../ui/ComplexSpinner';

interface Props {
  onAuthenticated: (session: RbacSessionState) => void;
  onCancel?: () => void;
  activeUsername?: string;
}

const GROUP_ORDER: Array<{ id: RoleDirectoryCard['group']; title: string; icon: string }> = [
  { id: 'complex', title: 'سطح مدیریت کل شهرک', icon: 'corporate_fare' },
  { id: 'block', title: 'سطح مدیریت و کادر بلوک', icon: 'apartment' },
  { id: 'security', title: 'انتظامات و گیت ورودی', icon: 'shield' },
  { id: 'resident', title: 'پنل اختصاصی ساکنین', icon: 'home' },
];

export const RolePortalPage: React.FC<Props> = ({
  onAuthenticated,
  onCancel,
  activeUsername,
}) => {
  const [cards, setCards] = useState<RoleDirectoryCard[]>([]);
  const [storageEngine, setStorageEngine] = useState('');
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyRole, setBusyRole] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Real username/password login form
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('1234');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    rbacApi
      .getRolesDirectory()
      .then((res) => {
        if (!active) return;
        setCards(res.cards);
        setStorageEngine(res.storageEngine);
        setTotalUsers(res.totalUsers);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'دریافت فهرست نقش‌ها ناموفق بود.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username.trim()) {
      setError('لطفاً نام کاربری را وارد کنید.');
      return;
    }
    setSubmitting(true);
    try {
      const session = await rbacApi.loginWithPassword(username.trim(), password);
      onAuthenticated(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ورود با نام کاربری ناموفق بود.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectRole = async (roleId: UserRoleId) => {
    setError('');
    setBusyRole(roleId);
    try {
      const session = await rbacApi.loginQuickRole(roleId);
      onAuthenticated(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ورود به نقش انتخابی ناموفق بود.');
    } finally {
      setBusyRole(null);
    }
  };

  return (
    <div className="min-h-dvh bg-surface text-on-surface px-3.5 py-5 sm:py-7" dir="rtl">
      <div className="w-full max-w-[980px] mx-auto space-y-5">
        {/* Architectural Portal Header */}
        <header className="bg-surface-container-lowest rounded-[2px] border border-outline-variant/60 p-4 sm:p-5 shadow-[var(--shadow-surface-ring)]">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-[2px] bg-primary text-on-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px]">domain</span>
              </div>
              <div className="min-w-0">
                <h1 className="text-[17px] sm:text-[19px] font-extrabold text-on-surface mb-0 leading-snug">
                  درگاه نقش‌ها و ورود سامانه مجتمع نیلوفر
                </h1>
                <p className="text-[12.5px] text-on-surface-variant mb-0 mt-0.5 leading-normal">
                  با نام کاربری تعریف‌شده توسط مدیر وارد شوید یا هر یک از ۱۰ نقش زیر را برای مشاهده منو و پنل اختصاصی انتخاب کنید.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <a
                href="/resident-app?block=B"
                className="h-9 px-3 rounded-[var(--ui-btn-radius)] border border-primary/50 bg-primary-container/50 hover:bg-primary-container text-on-primary-container text-[12px] font-bold inline-flex items-center gap-1.5 transition-colors"
              >
                <span className="material-symbols-outlined text-[17px]">qr_code_scanner</span>
                <span>اپلیکیشن اختصاصی ساکنین (QR)</span>
              </a>
              {totalUsers > 0 && (
                <StatusPill
                  label={`${totalUsers.toLocaleString('fa-IR')} حساب فعال در NoSQL`}
                  tone="positive"
                />
              )}
              {onCancel && (
                <StitchButton variant="secondary" size="sm" icon="arrow_forward" onClick={onCancel}>
                  بازگشت به پنل
                </StitchButton>
              )}
            </div>
          </div>
          {storageEngine && (
            <div className="mt-3 pt-2.5 border-t border-outline-variant/35 flex items-center justify-between gap-2 text-[11.5px] text-on-surface-variant flex-wrap">
              <span>دیتابیس سمت سرور فعال: {storageEngine}</span>
              <span>رمز پیش‌فرض حساب‌های نمونه: ۱۲۳۴</span>
            </div>
          )}
        </header>

        {error && <NoticeBanner message={error} tone="danger" onClose={() => setError('')} />}

        {/* Direct Username / Password Login Card */}
        <SurfaceCard className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-primary">login</span>
              <h2 className="text-[14.5px] font-bold text-on-surface mb-0">
                ورود مستقیم با نام کاربری (شناسایی خودکار نقش، بلوک و مهلت دسترسی)
              </h2>
            </div>
            <span className="text-[12px] text-on-surface-variant">
              هر کاربری که مدیر شهرک یا مدیر بلوک بسازد بلافاصله اینجا قابل ورود است
            </span>
          </div>

          <form
            onSubmit={handlePasswordLogin}
            className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
          >
            <div className="sm:col-span-5">
              <label
                htmlFor="portal-username"
                className="block text-[12px] font-semibold text-on-surface-variant mb-1"
              >
                نام کاربری
              </label>
              <input
                id="portal-username"
                type="text"
                dir="ltr"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="مثلاً: block_b_mgr یا res_b208 یا نام سرایدار جدید"
                className="w-full h-10 px-3 rounded-[2px] bg-surface-container-low text-[13px] border border-outline-variant/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              />
            </div>
            <div className="sm:col-span-4">
              <label
                htmlFor="portal-password"
                className="block text-[12px] font-semibold text-on-surface-variant mb-1"
              >
                رمز عبور
              </label>
              <input
                id="portal-password"
                type="password"
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="1234"
                className="w-full h-10 px-3 rounded-[2px] bg-surface-container-low text-[13px] border border-outline-variant/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              />
            </div>
            <div className="sm:col-span-3">
              <StitchButton
                type="submit"
                disabled={submitting}
                icon="verified_user"
                className="w-full rounded-[var(--ui-btn-radius)]"
              >
                {submitting ? 'در حال ورود...' : 'ورود با نام کاربری'}
              </StitchButton>
            </div>
          </form>
        </SurfaceCard>

        {/* 10 Role Cards grouped by Hierarchy */}
        {loading ? (
          <SurfaceCard className="py-10 flex justify-center">
            <ComplexSpinner
              size="md"
              label="در حال واکشی نقش‌ها و حساب‌های سرور NoSQL..."
              sublabel="مجتمع مسکونی نیلوفر"
            />
          </SurfaceCard>
        ) : (
          <div className="space-y-5">
            {GROUP_ORDER.map((grp) => {
              const groupCards = cards.filter((c) => c.group === grp.id);
              if (groupCards.length === 0) return null;
              return (
                <section key={grp.id} className="space-y-2.5">
                  <div className="flex items-center gap-2 px-0.5">
                    <span className="material-symbols-outlined text-[19px] text-primary">
                      {grp.icon}
                    </span>
                    <h2 className="text-[14.5px] font-bold text-on-surface mb-0">{grp.title}</h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {groupCards.map((card) => {
                      const isCurrent = activeUsername && activeUsername === card.sampleUsername;
                      const isBusy = busyRole === card.roleId;
                      return (
                        <article
                          key={card.roleId}
                          className={`bg-surface-container-lowest rounded-[2px] border p-4 flex flex-col justify-between gap-3 shadow-[var(--shadow-surface-ring)] transition-colors ${
                            isCurrent
                              ? 'border-primary ring-1 ring-primary/35'
                              : 'border-outline-variant/60 hover:border-primary/60'
                          }`}
                        >
                          <div className="space-y-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="w-9 h-9 rounded-[2px] bg-primary-container/65 text-on-primary-container flex items-center justify-center shrink-0">
                                  <span className="material-symbols-outlined text-[20px]">
                                    {card.icon}
                                  </span>
                                </span>
                                <div className="min-w-0">
                                  <h3 className="text-[14px] font-bold text-on-surface mb-0 truncate">
                                    {card.title}
                                  </h3>
                                  <span className="text-[11.5px] text-on-surface-variant block truncate">
                                    {card.sampleDisplayName}
                                    {card.unitCode
                                      ? ` • واحد ${card.unitCode}`
                                      : card.blockId
                                        ? ` • بلوک ${card.blockId}`
                                        : ' • کل شهرک'}
                                  </span>
                                </div>
                              </div>
                              {card.isTemporary ? (
                                <StatusPill
                                  label={
                                    typeof card.remainingMs === 'number'
                                      ? formatRemainingDurationFa(card.remainingMs)
                                      : 'موقت'
                                  }
                                  tone="danger"
                                />
                              ) : card.canCreateCount > 0 ? (
                                <StatusPill
                                  label={`+${card.canCreateCount.toLocaleString('fa-IR')} نقش`}
                                  tone="primary"
                                />
                              ) : null}
                            </div>

                            <p className="text-[12px] text-on-surface-variant mb-0 leading-relaxed">
                              {card.description}
                            </p>

                            {/* Menu Preview */}
                            <div className="pt-2 border-t border-outline-variant/35 space-y-1.5">
                              <span className="text-[11px] font-semibold text-on-surface-variant block">
                                منوهای فعال این نقش در داک:
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {card.dockLabels.map((lbl) => (
                                  <span
                                    key={lbl}
                                    className="px-2 py-0.5 rounded-[2px] bg-surface-container-low border border-outline-variant/45 text-[11px] font-medium text-on-surface"
                                  >
                                    {lbl}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="pt-2.5 border-t border-outline-variant/35 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setUsername(card.sampleUsername);
                                setPassword('1234');
                              }}
                              className="text-[11.5px] font-mono text-on-surface-variant hover:text-primary underline-offset-2 hover:underline"
                              dir="ltr"
                              title="قرار دادن در فرم ورود"
                            >
                              @{card.sampleUsername}
                            </button>
                            <StitchButton
                              size="sm"
                              variant={isCurrent ? 'secondary' : 'primary'}
                              disabled={Boolean(busyRole)}
                              onClick={() => void handleSelectRole(card.roleId)}
                              className="rounded-[var(--ui-btn-radius)]"
                              aria-label={`ورود به پنل ${card.title}`}
                            >
                              {isBusy
                                ? 'در حال ورود...'
                                : isCurrent
                                  ? 'نقش فعلی'
                                  : 'ورود به پنل'}
                            </StitchButton>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
