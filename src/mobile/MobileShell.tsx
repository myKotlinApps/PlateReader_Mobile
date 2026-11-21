import React, { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  Droplets,
  FileText,
  Home,
  Lock,
  LogOut,
  Mail,
  Moon,
  Plus,
  RefreshCw,
  Shield,
  Sun,
  Wallet,
  Wrench,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { identityApi } from '../api/client';
import { mobileApi, type MobileBootstrap } from './mobileApi';
import { resolveMobileRoute } from './financeCalc';
import { MobileLoginPage } from './MobileLoginPage';
import { MobileDashboardPage } from './MobileDashboardPage';
import { MobileFacilitiesPage } from './MobileFacilitiesPage';
import { MobileFormsPage } from './MobileFormsPage';
import { MobileLettersPage } from './MobileLettersPage';
import { MobileFinancePage } from './MobileFinancePage';
import { MobileGuardPage } from './MobileGuardPage';
import { MobileNotificationsPage } from './MobileNotificationsPage';
import { MobileStitchGalleryPage } from './MobileStitchGalleryPage';
import { hasAppPin, verifyAppPin } from './nativeBridge';
import {
  flushOfflineOutbox,
  loadMobileAuth,
  loadOutbox,
  MobileAuthError,
  remoteApiRequest,
  saveMobileAuth,
} from './remoteTransport';
import './mobile.css';
import { MAppBar, MBottomNav } from './components';
import type { MDockAlarm } from './components/MBottomNav';
import { NoticeBanner, StitchModal } from './ui/StitchKit';
import {
  ComplexPageLoader,
  ComplexSpinner,
  useDelayedLoading,
  useGlobalFetchCount,
} from './ui/ComplexSpinner';

const MobileStyleguide = React.lazy(() => import('./MobileStyleguide'));

export const MobileShell: React.FC = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const [authReady, setAuthReady] = useState(false);
  const [hasAuth, setHasAuth] = useState(false);
  const [bootstrap, setBootstrap] = useState<MobileBootstrap | null>(null);
  const [bootError, setBootError] = useState('');
  const [locked, setLocked] = useState(false);
  const [pinEntry, setPinEntry] = useState('');
  const [pinErr, setPinErr] = useState('');
  const [outboxCount, setOutboxCount] = useState(() => loadOutbox().length);
  const [syncing, setSyncing] = useState(false);
  const [dark, setDark] = useState(
    () => document.documentElement.getAttribute('data-theme') === 'dark',
  );
  const [alarmDismissed, setAlarmDismissed] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);

  const section = pathname.replace(/^\/m\/?/, '').split('/')[0] || 'dashboard';
  const activeFetchCount = useGlobalFetchCount();
  const slowFetchVisible = useDelayedLoading(activeFetchCount > 0, 180, 360);

  const loadBootstrap = useCallback(async () => {
    setBootError('');
    try {
      const auth = await loadMobileAuth();
      const res = await mobileApi.bootstrap();
      if (res.data) {
        setBootstrap(res.data);
        setHasAuth(true);
        return;
      }
      if (!auth) setHasAuth(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'اتصال برقرار نشد.';
      if (err instanceof MobileAuthError || msg.includes('وارد حساب') || msg.includes('لغو شده')) {
        setHasAuth(false);
        setBootstrap(null);
      } else {
        setBootError(msg);
      }
    } finally {
      setAuthReady(true);
    }
  }, []);

  useEffect(() => {
    void hasAppPin().then((enabled) => {
      if (enabled) setLocked(true);
    });
    void loadBootstrap();

    const onOut = () => setOutboxCount(loadOutbox().length);
    window.addEventListener('alpr-mobile-outbox-changed', onOut);
    return () => {
      window.removeEventListener('alpr-mobile-outbox-changed', onOut);
    };
  }, [loadBootstrap]);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    document.documentElement.classList.toggle('app-skin-dark', next);
    try {
      window.localStorage.setItem('plate_reader_theme', next ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
  };

  const handleFlush = async () => {
    setSyncing(true);
    try {
      await flushOfflineOutbox();
      setOutboxCount(loadOutbox().length);
      void loadBootstrap();
    } finally {
      setSyncing(false);
    }
  };

  const handleLogout = async () => {
    setBootError('');
    try {
      const auth = await loadMobileAuth();
      if (auth && !auth.edge_auth) {
        await remoteApiRequest('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
      } else if (!auth) {
        await identityApi.logout();
      }
      await saveMobileAuth(null);
      setHasAuth(false);
      setBootstrap(null);
    } catch {
      setBootError('خروج از حساب انجام نشد.');
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await verifyAppPin(pinEntry)) {
      setLocked(false);
      setPinEntry('');
      setPinErr('');
    } else {
      setPinErr('پین واردشده نادرست است.');
    }
  };

  const isDevHost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
  if (section === '_styleguide' && (import.meta.env.DEV || isDevHost)) {
    return (
      <React.Suspense fallback={null}>
        <MobileStyleguide />
      </React.Suspense>
    );
  }

  if (locked) {
    return (
      <div className="alpr-mobile-shell px-3 py-5 justify-content-center" dir="rtl">
        <div className="alpr-mobile-card mx-auto w-100" style={{ maxWidth: 360 }}>
          <h6 className="fw-bold mb-3 d-flex align-items-center gap-2 text-[15px]">
            <Lock size={18} />
            <span>باز کردن قفل برنامه</span>
          </h6>
          <form onSubmit={handleUnlock} className="d-flex flex-column gap-3">
            <input
              type="password"
              inputMode="numeric"
              className="form-control alpr-mobile-input text-center"
              placeholder="پین ۴ تا ۸ رقمی"
              value={pinEntry}
              onChange={(e) => setPinEntry(e.target.value)}
              autoFocus
            />
            {pinErr && <div className="text-[13px] text-error">{pinErr}</div>}
            <button type="submit" className="alpr-mobile-btn-primary w-100">
              ورود
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!authReady) {
    return (
      <div className="alpr-mobile-shell justify-content-center align-items-center p-4" dir="rtl">
        <ComplexPageLoader
          label="در حال اتصال به سامانه مجتمع..."
          sublabel="مجتمع مسکونی نیلوفر • بررسی نشست و بلوک‌ها"
        />
      </div>
    );
  }

  if (!hasAuth || !bootstrap) {
    return <MobileLoginPage onAuthenticated={() => void loadBootstrap()} />;
  }

  const goTab = (tab: string) => {
    navigate(resolveMobileRoute(tab));
  };

  const handleSyncChanged = () => {
    setOutboxCount(loadOutbox().length);
    void loadBootstrap();
  };

  const SECTION_TITLE: Record<string, string> = {
    dashboard: 'مجتمع نیلوفر',
    facilities: 'تاسیسات و نشتی',
    finance: 'مالی و شارژ',
    letters: 'دبیرخانه',
    forms: 'مصوبات و فرم‌ها',
    guard: 'نگهبانی و گیت',
    notifications: 'اعلان‌ها و تنظیمات',
    stitch: 'آرشیو ۲۰ طرح مرجع',
  };
  const currentTitle = SECTION_TITLE[section] ?? SECTION_TITLE.dashboard;
  const activeSection = section === 'stitch' || section === 'notifications' ? 'dashboard' : section;

  const SECTION_LOADING_LABEL: Record<string, string> = {
    dashboard: 'در حال دریافت وضعیت بلوک‌ها و صندوق...',
    facilities: 'در حال بارگذاری پرونده‌های نشتی و نقشه‌ها...',
    finance: 'در حال دریافت دفاتر مالی و وضعیت واحدها...',
    letters: 'در حال واکشی نامه‌ها و کارتابل دبیرخانه...',
    forms: 'در حال بارگذاری مصوبات و فرم‌های اجرایی...',
    guard: 'در حال اتصال به پلاک‌خوان و دفتر گیت...',
    notifications: 'در حال دریافت اعلان‌های مجتمع...',
    stitch: 'در حال آماده‌سازی آرشیو طرح‌ها...',
  };

  const activeLeaksCount = bootstrap.counters.active_leaks ?? 0;
  const unreadGuardCount = bootstrap.counters.unread_guard_directives ?? 0;
  const hasGuard = bootstrap.license.guard_enabled && bootstrap.mobile_modules.includes('guard');

  const navItems = [
    { id: 'dashboard', label: 'خانه', icon: <Home size={22} strokeWidth={activeSection === 'dashboard' ? 2.3 : 1.75} /> },
    {
      id: 'facilities',
      label: 'تاسیسات',
      icon: <Wrench size={21} strokeWidth={activeSection === 'facilities' ? 2.3 : 1.75} />,
      badge: activeLeaksCount,
    },
    ...(bootstrap.mobile_modules.includes('finance')
      ? [{ id: 'finance', label: 'مالی و حسابداری', icon: <Wallet size={21} strokeWidth={activeSection === 'finance' ? 2.3 : 1.75} /> }]
      : []),
    ...(bootstrap.mobile_modules.includes('letters')
      ? [{ id: 'letters', label: 'دبیرخانه', icon: <Mail size={21} strokeWidth={activeSection === 'letters' ? 2.3 : 1.75} />, dot: true }]
      : []),
    ...(hasGuard
      ? [
          {
            id: 'guard',
            label: 'نگهبانی و پلاک‌خوان',
            icon: <Shield size={21} strokeWidth={activeSection === 'guard' ? 2.3 : 1.75} />,
            badge: unreadGuardCount,
          },
        ]
      : bootstrap.mobile_modules.includes('forms')
        ? [{ id: 'forms', label: 'مصوبات و فرم‌ها', icon: <FileText size={21} strokeWidth={activeSection === 'forms' ? 2.3 : 1.75} /> }]
        : []),
  ];

  // Prominent detached circular FAB = Universal Quick Actions Hub (1-tap access from any screen)
  const quickActionFabItem = {
    id: '__quick_actions__',
    label: 'ثبت سریع و اقدام فوری',
    icon: (
      <Plus
        size={26}
        strokeWidth={2.4}
        className={`transition-transform duration-200 ${quickActionsOpen ? 'rotate-45' : ''}`}
      />
    ),
  };

  const quickActions = [
    ...(hasGuard
      ? [
          {
            title: 'ثبت تردد و پلاک',
            sub: 'ورود/خروج خودرو با پلاک ایران',
            icon: 'directions_car',
            tone: 'bg-primary-container/60 text-on-primary-container',
            route: 'guard?tab=gate',
          },
        ]
      : []),
    {
      title: 'ثبت سند حسابداری',
      sub: 'میز حسابدار و دفتر روزنامه دوطرفه',
      icon: 'account_balance',
      tone: 'bg-secondary-container/60 text-on-secondary-container',
      route: 'finance?tab=accountant',
    },
    {
      title: 'گزارش فوری نشتی',
      sub: 'ثبت پرونده تاسیسات و شیر فلکه',
      icon: 'water_damage',
      tone: 'bg-error-container/75 text-on-error-container',
      route: 'facilities?tab=leaks',
    },
    {
      title: 'نگارش نامه و ابلاغیه',
      sub: 'ارسال مستقیم در دبیرخانه بلوک',
      icon: 'edit_square',
      tone: 'bg-primary-container/50 text-on-primary-container',
      route: 'letters?view=compose',
    },
    {
      title: 'تطبیق فیش بانکی',
      sub: 'بررسی و تایید واریزی ساکنین',
      icon: 'document_scanner',
      tone: 'bg-secondary-container/50 text-on-secondary-container',
      route: 'finance?tab=reconcile',
    },
    {
      title: 'مصوبات و فرم‌ها',
      sub: 'ثبت مجوزها و فرم‌های اجرایی',
      icon: 'description',
      tone: 'bg-surface-container-high text-on-surface',
      route: 'forms',
    },
  ];

  // Digikala-style floating alarm pill stacked cleanly above the dock
  const activeDockAlarm: MDockAlarm | null = alarmDismissed
    ? null
    : activeLeaksCount > 0 && section !== 'facilities'
      ? {
          id: 'leak-alarm',
          title: 'هشدار نشتی آب • واحد ۳۰۲ بلوک B',
          subtitle: `${activeLeaksCount.toLocaleString('fa-IR')} پرونده فعال • شیر فلکه قطع شد`,
          actionLabel: 'بررسی',
          tone: 'danger',
          icon: <Droplets size={21} strokeWidth={2.2} />,
          onAction: () => goTab('facilities?tab=leaks'),
          onDismiss: () => setAlarmDismissed(true),
        }
      : unreadGuardCount > 0 && section !== 'guard'
        ? {
            id: 'guard-alarm',
            title: `${unreadGuardCount.toLocaleString('fa-IR')} دستور فوری انتظامات و گیت`,
            subtitle: 'تردد مهمان و پلاک‌های در انتظار تایید',
            actionLabel: 'مشاهده',
            tone: 'primary',
            icon: <Shield size={21} strokeWidth={2.1} />,
            onAction: () => goTab('guard?tab=directives'),
            onDismiss: () => setAlarmDismissed(true),
          }
        : section !== 'finance'
          ? {
              id: 'finance-alarm',
              title: '۲ فیش واریزی در صف تایید حسابدار',
              subtitle: 'آماده صدور سند خودکار در دفتر روزنامه',
              actionLabel: 'بررسی',
              tone: 'warning',
              icon: <Wallet size={20} strokeWidth={2.1} />,
              onAction: () => goTab('finance?tab=accountant'),
              onDismiss: () => setAlarmDismissed(true),
            }
          : null;

  // Real-world slow network fetch only — zero artificial/fake timer
  const showComplexLoader = slowFetchVisible;

  return (
    <div className={`alpr-mobile-shell ${activeDockAlarm ? 'has-alarm-pill' : ''}`} dir="rtl">
      <a href="#mobile-main" className="m-skip-link">
        رفتن به محتوای اصلی
      </a>
      <MAppBar
        title={currentTitle}
        trailing={
          <>
            {outboxCount > 0 && (
              <button
                type="button"
                onClick={() => void handleFlush()}
                disabled={syncing}
                className="m-icon-btn"
                aria-label="همگام‌سازی صف آفلاین"
                title={`همگام‌سازی (${outboxCount.toLocaleString('fa-IR')})`}
              >
                <RefreshCw size={18} className={syncing ? 'spin' : ''} />
              </button>
            )}
            <button
              type="button"
              onClick={() => goTab('notifications')}
              className={`m-icon-btn ${section === 'notifications' ? 'm-icon-btn--active' : ''}`}
              aria-label="اعلان‌ها"
            >
              <Bell size={19} strokeWidth={1.9} />
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="m-icon-btn"
              aria-label="تغییر تم"
            >
              {dark ? <Sun size={19} strokeWidth={1.9} /> : <Moon size={19} strokeWidth={1.9} />}
            </button>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="m-icon-btn"
              aria-label="خروج"
            >
              <LogOut size={19} strokeWidth={1.9} />
            </button>
          </>
        }
      />

      <main
        id="mobile-main"
        className="w-full mx-auto py-3.5 px-3.5 flex-grow-1 max-w-[680px] lg:max-w-[960px]"
      >
        {bootError && (
          <div className="mb-3">
            <NoticeBanner message={bootError} tone="danger" onClose={() => setBootError('')} />
          </div>
        )}
        {showComplexLoader && (
          <div
            className="fixed inset-x-0 top-[58px] bottom-[92px] z-[1020] pointer-events-none flex items-center justify-center px-4"
            aria-live="polite"
          >
            <div className="bg-surface-container-lowest/95 backdrop-blur-md rounded-2xl px-6 py-5 shadow-floating m-sheet-in">
              <ComplexSpinner
                size="md"
                label={SECTION_LOADING_LABEL[section] ?? 'در حال دریافت اطلاعات...'}
                sublabel="مجتمع مسکونی نیلوفر"
              />
            </div>
          </div>
        )}
        <div key={section} className="m-panel-in">
          {section === 'facilities' ? (
            <MobileFacilitiesPage onNavigate={goTab} onSyncChanged={handleSyncChanged} />
          ) : section === 'forms' ? (
            <MobileFormsPage
              bootstrap={bootstrap}
              onSyncChanged={handleSyncChanged}
              onNavigate={goTab}
            />
          ) : section === 'letters' ? (
            <MobileLettersPage
              bootstrap={bootstrap}
              onSyncChanged={handleSyncChanged}
              onNavigate={goTab}
            />
          ) : section === 'finance' ? (
            <MobileFinancePage onNavigate={goTab} onSyncChanged={handleSyncChanged} />
          ) : section === 'guard' ? (
            <MobileGuardPage
              bootstrap={bootstrap}
              onSyncChanged={handleSyncChanged}
              onNavigate={goTab}
            />
          ) : section === 'notifications' ? (
            <MobileNotificationsPage
              onOpenRoute={(r) => navigate(r)}
              onNavigateTab={goTab}
            />
          ) : section === 'stitch' ? (
            <MobileStitchGalleryPage onNavigateTab={goTab} />
          ) : (
            <MobileDashboardPage
              bootstrap={bootstrap}
              outboxCount={outboxCount}
              onNavigate={goTab}
            />
          )}
        </div>
      </main>

      <MBottomNav
        items={navItems}
        active={quickActionsOpen ? '__quick_actions__' : activeSection}
        onChange={(id) => {
          if (id === '__quick_actions__') {
            setQuickActionsOpen((prev) => !prev);
            return;
          }
          setQuickActionsOpen(false);
          goTab(id);
        }}
        fabItem={quickActionFabItem}
        alarm={activeDockAlarm}
      />

      <StitchModal
        open={quickActionsOpen}
        onClose={() => setQuickActionsOpen(false)}
        title="ثبت سریع و اقدام فوری"
        subtitle="دسترسی یک‌کلیکی به پرکاربردترین عملیات روزانه مجتمع"
      >
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          {quickActions.map((act) => (
            <button
              key={act.title}
              type="button"
              onClick={() => {
                setQuickActionsOpen(false);
                goTab(act.route);
              }}
              className="flex flex-col items-start gap-2 p-3 rounded-xl bg-surface-container-low/75 hover:bg-surface-container active:scale-[0.97] transition-[transform,background-color] duration-150 text-right shadow-[inset_0_0_0_1px_rgba(27,37,51,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <span
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${act.tone}`}
              >
                <span className="material-symbols-outlined text-[20px]">{act.icon}</span>
              </span>
              <div className="min-w-0 w-full">
                <strong className="text-[13px] font-bold text-on-surface block truncate">
                  {act.title}
                </strong>
                <span className="text-[11.5px] text-on-surface-variant block truncate mt-0.5">
                  {act.sub}
                </span>
              </div>
            </button>
          ))}
        </div>
      </StitchModal>
    </div>
  );
};

export default MobileShell;
