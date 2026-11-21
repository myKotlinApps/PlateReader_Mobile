import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Bell,
  Building2,
  Car,
  CheckCircle2,
  ClipboardCheck,
  Droplets,
  Home,
  Info,
  Lock,
  LogOut,
  Mail,
  Moon,
  Plus,
  Receipt,
  RefreshCw,
  Shield,
  Sun,
  User,
  UserCheck,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { mobileApi, type MobileBootstrap } from './mobileApi';
import { resolveMobileRoute } from './financeCalc';
import { MobileDashboardPage } from './MobileDashboardPage';
import { MobileFacilitiesPage } from './MobileFacilitiesPage';
import { MobileFormsPage } from './MobileFormsPage';
import { MobileLettersPage } from './MobileLettersPage';
import { MobileFinancePage } from './MobileFinancePage';
import { MobileGuardPage } from './MobileGuardPage';
import { MobileNotificationsPage } from './MobileNotificationsPage';
import { MobileStitchGalleryPage } from './MobileStitchGalleryPage';
import { RolePortalPage } from './pages/RolePortalPage';
import { BlockManagementPage } from './pages/BlockManagementPage';
import { CaretakerPanelPage } from './pages/CaretakerPanelPage';
import { ResidentPanelPage } from './pages/ResidentPanelPage';
import {
  clearRbacToken,
  rbacApi,
  type RbacCounters,
  type RbacSessionState,
} from './rbac/rbacApi';
import {
  formatRemainingDurationFa,
  ROLE_DEFINITIONS,
  ROLE_ORDER,
  type RoleDockTabSpec,
  type UserRoleId,
} from './rbac/roles';
import type { BlockNoticeDoc } from '../server/nosqlStore';
import { hasAppPin, verifyAppPin } from './nativeBridge';
import { flushOfflineOutbox, loadOutbox } from './remoteTransport';
import './mobile.css';
import { MAppBar, MBottomNav } from './components';
import type { MDockAlarm } from './components/MBottomNav';
import { UserProfilePanel } from './components/UserProfilePanel';
import {
  applyAppearancePrefs,
  DEFAULT_APPEARANCE_PREFS,
  reapplyAppearanceForTheme,
  type UserAppearancePrefs,
} from './theme/palettes';
import { NoticeBanner, StatusPill, StitchButton, StitchModal } from './ui/StitchKit';
import {
  dismissDockAlarm,
  registerDockAlarmHost,
  subscribeDockAlarm,
  type DockAlarmToast,
} from './ui/dockAlarmBus';
import {
  ComplexPageLoader,
  ComplexSpinner,
  useDelayedLoading,
  useGlobalFetchCount,
} from './ui/ComplexSpinner';

const MobileStyleguide = React.lazy(() => import('./MobileStyleguide'));

function renderDockIcon(icon: RoleDockTabSpec['icon'], isActive: boolean) {
  const sw = isActive ? 2.3 : 1.75;
  switch (icon) {
    case 'home':
    case 'user_home':
      return <Home size={22} strokeWidth={sw} />;
    case 'building':
      return <Building2 size={21} strokeWidth={sw} />;
    case 'wrench':
      return <Wrench size={21} strokeWidth={sw} />;
    case 'wallet':
      return <Wallet size={21} strokeWidth={sw} />;
    case 'mail':
      return <Mail size={21} strokeWidth={sw} />;
    case 'shield':
      return <Shield size={21} strokeWidth={sw} />;
    case 'clipboard':
      return <ClipboardCheck size={21} strokeWidth={sw} />;
    case 'receipt':
      return <Receipt size={21} strokeWidth={sw} />;
    case 'car':
      return <Car size={21} strokeWidth={sw} />;
    case 'users':
      return <Users size={21} strokeWidth={sw} />;
    default:
      return <Home size={22} strokeWidth={sw} />;
  }
}

export const MobileShell: React.FC = () => {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();

  const [authReady, setAuthReady] = useState(false);
  const [bootstrap, setBootstrap] = useState<MobileBootstrap | null>(null);
  const [rbacSession, setRbacSession] = useState<RbacSessionState | null>(null);
  const [rbacCounters, setRbacCounters] = useState<RbacCounters | null>(null);
  const [latestNotice, setLatestNotice] = useState<BlockNoticeDoc | null>(null);
  const [portalOpen, setPortalOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [switchingRole, setSwitchingRole] = useState<UserRoleId | null>(null);

  const [bootError, setBootError] = useState('');
  const [locked, setLocked] = useState(false);
  const [pinEntry, setPinEntry] = useState('');
  const [pinErr, setPinErr] = useState('');
  const [outboxCount, setOutboxCount] = useState(() => loadOutbox().length);
  const [syncing, setSyncing] = useState(false);
  const [dark, setDark] = useState(() => {
    try {
      const saved = window.localStorage.getItem('plate_reader_theme');
      if (saved === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.documentElement.classList.add('app-skin-dark');
        return true;
      }
    } catch {
      /* ignore */
    }
    return document.documentElement.getAttribute('data-theme') === 'dark';
  });
  const [alarmDismissed, setAlarmDismissed] = useState(false);
  const [dockToast, setDockToast] = useState<DockAlarmToast | null>(null);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);

  useEffect(() => {
    registerDockAlarmHost(true);
    const unsub = subscribeDockAlarm(setDockToast);
    return () => {
      unsub();
      registerDockAlarmHost(false);
    };
  }, []);

  const section = pathname.replace(/^\/m\/?/, '').split('/')[0] || 'dashboard';
  const activeFetchCount = useGlobalFetchCount();
  const slowFetchVisible = useDelayedLoading(activeFetchCount > 0, 180, 360);

  const loadBootstrap = useCallback(async () => {
    setBootError('');
    try {
      const res = await mobileApi.bootstrap();
      if (res.data) {
        setBootstrap(res.data);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'اتصال برقرار نشد.';
      setBootError(msg);
    }
  }, []);

  const refreshRbacMe = useCallback(async () => {
    try {
      const me = await rbacApi.getMe();
      setRbacSession((prev) =>
        prev
          ? { ...prev, user: me.user, roleDef: me.roleDef, remainingMs: me.remainingMs }
          : null,
      );
      setRbacCounters(me.counters);
      setLatestNotice(me.latestNotice);
    } catch (err) {
      // If a temporary caretaker expired mid-session, return them to the Role Portal with the error
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('مهلت') || msg.includes('غیرفعال') || msg.includes('منقضی')) {
        clearRbacToken();
        setRbacSession(null);
        setBootError(msg);
      }
    }
  }, []);

  useEffect(() => {
    void hasAppPin().then((enabled) => {
      if (enabled) setLocked(true);
    });
    const params = new URLSearchParams(window.location.search);
    const autoRole = params.get('role') as UserRoleId | null;
    const autoStart = params.get('autostart') === '1';

    void (async () => {
      await loadBootstrap();
      if (autoRole && ROLE_ORDER.includes(autoRole)) {
        try {
          const sess = await rbacApi.loginQuickRole(autoRole);
          setRbacSession(sess);
          navigate(sess.roleDef.defaultRoute, { replace: true });
          const me = await rbacApi.getMe();
          setRbacCounters(me.counters);
          setLatestNotice(me.latestNotice);
        } catch {
          /* stay on portal */
        }
      } else if (autoStart) {
        try {
          const sess = await rbacApi.loginQuickRole('complex_manager');
          setRbacSession(sess);
          navigate(sess.roleDef.defaultRoute, { replace: true });
          const me = await rbacApi.getMe();
          setRbacCounters(me.counters);
          setLatestNotice(me.latestNotice);
        } catch {
          /* stay on portal */
        }
      }
      setAuthReady(true);
    })();

    const onOut = () => setOutboxCount(loadOutbox().length);
    window.addEventListener('alpr-mobile-outbox-changed', onOut);
    return () => {
      window.removeEventListener('alpr-mobile-outbox-changed', onOut);
    };
  }, [loadBootstrap, navigate]);

  // Apply per-user sharp/curved corners & 6-palette theme whenever active user OR dark mode changes
  useEffect(() => {
    applyAppearancePrefs(rbacSession?.user.preferences ?? DEFAULT_APPEARANCE_PREFS, dark);
  }, [rbacSession?.user.id, rbacSession?.user.preferences, dark]);

  const handleAppearanceChange = (next: UserAppearancePrefs) => {
    setRbacSession((prev) =>
      prev
        ? {
            ...prev,
            user: {
              ...prev.user,
              preferences: next,
            },
          }
        : prev,
    );
  };

  const handleUserUpdated = (nextUser: RbacSessionState['user']) => {
    setRbacSession((prev) => (prev ? { ...prev, user: nextUser } : prev));
  };

  const handleRbacAuthenticated = (session: RbacSessionState) => {
    setRbacSession(session);
    setPortalOpen(false);
    setSwitcherOpen(false);
    setAlarmDismissed(false);
    setQuickActionsOpen(false);
    navigate(session.roleDef.defaultRoute, { replace: true });
    void refreshRbacMe();
    void loadBootstrap();
  };

  const handleQuickSwitchRole = async (roleId: UserRoleId) => {
    setSwitchingRole(roleId);
    try {
      const session = await rbacApi.loginQuickRole(roleId);
      handleRbacAuthenticated(session);
    } catch (err) {
      setBootError(err instanceof Error ? err.message : 'تغییر نقش انجام نشد.');
    } finally {
      setSwitchingRole(null);
    }
  };

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    document.documentElement.classList.toggle('app-skin-dark', next);
    reapplyAppearanceForTheme(next);
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

  const handleLogout = () => {
    clearRbacToken();
    setRbacSession(null);
    setRbacCounters(null);
    setLatestNotice(null);
    setPortalOpen(false);
    setQuickActionsOpen(false);
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
          label="در حال اتصال به دیتابیس NoSQL مجتمع..."
          sublabel="مجتمع مسکونی نیلوفر • بارگذاری نقش‌ها و بلوک‌ها"
        />
      </div>
    );
  }

  // Entry Role Portal Page (initial screen OR opened via header switcher)
  if (!rbacSession || portalOpen) {
    return (
      <RolePortalPage
        onAuthenticated={handleRbacAuthenticated}
        onCancel={rbacSession ? () => setPortalOpen(false) : undefined}
        activeUsername={rbacSession?.user.username}
      />
    );
  }

  const goTab = (tab: string) => {
    navigate(resolveMobileRoute(tab));
  };

  const handleSyncChanged = () => {
    setOutboxCount(loadOutbox().length);
    void loadBootstrap();
    void refreshRbacMe();
  };

  const activeUser = rbacSession.user;
  const roleDef = ROLE_DEFINITIONS[activeUser.role];

  const SECTION_TITLE: Record<string, string> = {
    dashboard: 'مجتمع نیلوفر',
    block: activeUser.blockId ? `مدیریت بلوک ${activeUser.blockId}` : 'مدیریت بلوک‌ها و کادر',
    caretaker: activeUser.isTemporary ? 'پنل سرایدار موقت' : `سرایداری بلوک ${activeUser.blockId || 'B'}`,
    resident: `پنل ساکن • ${activeUser.unitCode || 'واحد'}`,
    facilities: 'تاسیسات و نشتی',
    finance: 'مالی و حسابداری',
    letters: 'دبیرخانه',
    forms: 'مصوبات و فرم‌ها',
    guard: 'نگهبانی و گیت',
    notifications: 'اعلان‌ها و تنظیمات',
    stitch: 'آرشیو طرح‌ها',
  };
  const currentTitle = SECTION_TITLE[section] ?? roleDef.title;

  const SECTION_LOADING_LABEL: Record<string, string> = {
    dashboard: 'در حال دریافت وضعیت بلوک‌ها و صندوق...',
    block: 'در حال بارگذاری پنل بلوک و پرسنل...',
    caretaker: 'در حال دریافت وظایف سرایداری...',
    resident: 'در حال بارگذاری اطلاعات واحد و اعلان‌ها...',
    facilities: 'در حال بارگذاری پرونده‌های نشتی و نقشه‌ها...',
    finance: 'در حال دریافت دفاتر مالی و اسناد...',
    letters: 'در حال واکشی نامه‌ها و کارتابل دبیرخانه...',
    forms: 'در حال بارگذاری مصوبات و فرم‌های اجرایی...',
    guard: 'در حال اتصال به پلاک‌خوان و مجوزهای مهمان...',
    notifications: 'در حال دریافت اعلان‌های مجتمع...',
  };

  const activeLeaksCount = bootstrap?.counters.active_leaks ?? 0;
  const unreadGuardCount = bootstrap?.counters.unread_guard_directives ?? 0;
  const pendingReceipts = rbacCounters?.pendingReceipts ?? 0;
  const pendingPermits = rbacCounters?.pendingPermits ?? 0;
  const pendingTasks = rbacCounters?.pendingTasks ?? 0;

  // Match active Digikala dock item precisely (supporting section?tab=... routes)
  const currentFullId = search ? `${section}${search}` : section;
  const resolveActiveDockId = (): string => {
    const exact = roleDef.dockTabs.find((t) => t.id === currentFullId);
    if (exact) return exact.id;
    const bySection = roleDef.dockTabs.find((t) => t.id.split('?')[0] === section);
    return bySection ? bySection.id : roleDef.dockTabs[0]?.id ?? 'dashboard';
  };
  const activeDockId = resolveActiveDockId();

  const navItems = roleDef.dockTabs.map((spec) => {
    const isActive = spec.id === activeDockId;
    let badge: number | undefined;
    if (spec.id.startsWith('facilities')) badge = activeLeaksCount;
    else if (spec.id.startsWith('guard?tab=permits') || spec.id === 'guard') badge = pendingPermits + unreadGuardCount;
    else if (spec.id.startsWith('caretaker?tab=tasks') || spec.id.startsWith('block?tab=tasks')) badge = pendingTasks;
    else if (spec.id.startsWith('finance?tab=accountant')) badge = pendingReceipts;
    return {
      id: spec.id,
      label: spec.label,
      icon: renderDockIcon(spec.icon, isActive),
      badge: badge && badge > 0 ? badge : undefined,
    };
  });

  // Prominent detached circular FAB = Role-tailored Quick Actions Hub (Digikala Dock untouched!)
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

  // Role-aware Digikala-style floating alarm pill stacked directly above the dock.
  // Transient confirmation/error alerts (NoticeBanner) take immediate top priority in this exact Digikala Alarm Pill!
  const activeDockAlarm: MDockAlarm | null = dockToast
    ? {
        id: dockToast.id,
        title:
          dockToast.title ||
          (dockToast.tone === 'success'
            ? 'عملیات با موفقیت انجام شد'
            : dockToast.tone === 'danger'
              ? 'نیاز به بررسی و اصلاح'
              : 'اعلان سامانه'),
        subtitle: dockToast.message,
        actionLabel: 'باشه',
        tone:
          dockToast.tone === 'danger'
            ? 'danger'
            : dockToast.tone === 'success'
              ? 'success'
              : 'primary',
        icon:
          dockToast.tone === 'danger' ? (
            <AlertCircle size={20} strokeWidth={2.2} />
          ) : dockToast.tone === 'success' ? (
            <CheckCircle2 size={20} strokeWidth={2.2} />
          ) : (
            <Info size={20} strokeWidth={2.2} />
          ),
        onAction: () => dismissDockAlarm(dockToast.id),
        onDismiss: () => dismissDockAlarm(dockToast.id),
      }
    : alarmDismissed
      ? null
    : activeUser.role === 'temp_caretaker' && typeof rbacSession.remainingMs === 'number'
      ? {
          id: 'temp-caretaker-alarm',
          title: `شیفت موقت فعال • ${formatRemainingDurationFa(rbacSession.remainingMs)} باقی‌مانده`,
          subtitle: `${pendingTasks.toLocaleString('fa-IR')} وظیفه در انتظار انجام در بلوک ${activeUser.blockId || 'B'}`,
          actionLabel: 'وظایف',
          tone: 'warning',
          icon: <ClipboardCheck size={20} strokeWidth={2.2} />,
          onAction: () => goTab('caretaker?tab=tasks'),
          onDismiss: () => setAlarmDismissed(true),
        }
      : activeUser.role === 'resident' && latestNotice
        ? {
            id: `notice-${latestNotice.id}`,
            title: latestNotice.title,
            subtitle: `از ${latestNotice.senderName} (${latestNotice.senderRoleTitle})`,
            actionLabel: 'مشاهده',
            tone: latestNotice.severity === 'urgent' ? 'danger' : 'primary',
            icon: <Bell size={20} strokeWidth={2.1} />,
            onAction: () => goTab('resident?tab=home'),
            onDismiss: () => setAlarmDismissed(true),
          }
        : activeUser.role === 'gate_guard' && pendingPermits > 0
          ? {
              id: 'guard-permits-alarm',
              title: `${pendingPermits.toLocaleString('fa-IR')} مهمان در انتظار ورود در گیت`,
              subtitle: 'ثبت‌شده توسط ساکنین با پلاک خودرو',
              actionLabel: 'بررسی',
              tone: 'primary',
              icon: <Car size={20} strokeWidth={2.1} />,
              onAction: () => goTab('guard?tab=permits'),
              onDismiss: () => setAlarmDismissed(true),
            }
          : (activeUser.role === 'complex_accountant' || activeUser.role === 'block_accountant') &&
              pendingReceipts > 0
            ? {
                id: 'acc-receipts-alarm',
                title: `${pendingReceipts.toLocaleString('fa-IR')} فیش واریزی ساکنین در صف تایید`,
                subtitle: 'آماده تایید و صدور خودکار سند روزنامه',
                actionLabel: 'تایید',
                tone: 'warning',
                icon: <Wallet size={20} strokeWidth={2.1} />,
                onAction: () => goTab('finance?tab=accountant'),
                onDismiss: () => setAlarmDismissed(true),
              }
            : activeUser.role === 'block_manager' && pendingTasks > 0
              ? {
                  id: 'bm-tasks-alarm',
                  title: `${pendingTasks.toLocaleString('fa-IR')} وظیفه فعال سرایداران بلوک ${activeUser.blockId || 'B'}`,
                  subtitle: 'بررسی گزارش‌های انجام‌شده و ابلاغ کار جدید',
                  actionLabel: 'کارتابل',
                  tone: 'primary',
                  icon: <ClipboardCheck size={20} strokeWidth={2.1} />,
                  onAction: () => goTab('block?tab=tasks'),
                  onDismiss: () => setAlarmDismissed(true),
                }
              : activeLeaksCount > 0 && section !== 'facilities' && roleDef.allowedSections.includes('facilities')
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
                : null;

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
            {/* Quick Role Switcher Button */}
            <button
              type="button"
              onClick={() => setSwitcherOpen(true)}
              className="h-9 px-2.5 rounded-[var(--ui-btn-radius)] border border-outline-variant/60 bg-surface-container-low hover:bg-primary-container/50 text-on-surface text-[11.5px] font-bold inline-flex items-center gap-1.5 transition-colors shrink-0"
              aria-label="تغییر نقش کاربری"
              title={`${roleDef.title} (@${activeUser.username})`}
            >
              <UserCheck size={15} className="text-primary shrink-0" />
              <span className="max-w-[92px] truncate">{roleDef.shortTitle}</span>
            </button>
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
              onClick={() => setAppearanceOpen(true)}
              className={`m-icon-btn ${appearanceOpen ? 'm-icon-btn--active' : ''}`}
              aria-label="پروفایل و شخصی‌سازی ظاهر"
              title="پروفایل، تصویر کاربر، فرم کارت‌ها و ۶ پالت رنگی"
            >
              {activeUser.avatarDataUrl ? (
                <img
                  src={activeUser.avatarDataUrl}
                  alt={activeUser.displayName}
                  className="w-7 h-7 rounded-full object-cover border border-primary/70"
                />
              ) : (
                <User size={19} strokeWidth={1.9} />
              )}
            </button>
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
              onClick={handleLogout}
              className="m-icon-btn"
              aria-label="خروج به درگاه نقش‌ها"
              title="بازگشت به درگاه نقش‌ها و ورود"
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
            <div className="bg-surface-container-lowest/95 backdrop-blur-md rounded-[2px] border border-outline-variant/60 px-6 py-5 shadow-floating m-sheet-in">
              <ComplexSpinner
                size="md"
                label={SECTION_LOADING_LABEL[section] ?? 'در حال دریافت اطلاعات...'}
                sublabel="مجتمع مسکونی نیلوفر"
              />
            </div>
          </div>
        )}
        <div key={`${activeUser.id}-${section}`} className="m-panel-in">
          {section === 'block' ? (
            <BlockManagementPage
              currentUser={activeUser}
              onSyncChanged={handleSyncChanged}
            />
          ) : section === 'caretaker' ? (
            <CaretakerPanelPage
              currentUser={activeUser}
              remainingMs={rbacSession.remainingMs}
              onSyncChanged={handleSyncChanged}
            />
          ) : section === 'resident' ? (
            <ResidentPanelPage
              currentUser={activeUser}
              onSyncChanged={handleSyncChanged}
            />
          ) : section === 'facilities' ? (
            <MobileFacilitiesPage onNavigate={goTab} onSyncChanged={handleSyncChanged} />
          ) : section === 'forms' && bootstrap ? (
            <MobileFormsPage
              bootstrap={bootstrap}
              onSyncChanged={handleSyncChanged}
              onNavigate={goTab}
            />
          ) : section === 'letters' && bootstrap ? (
            <MobileLettersPage
              bootstrap={bootstrap}
              onSyncChanged={handleSyncChanged}
              onNavigate={goTab}
            />
          ) : section === 'finance' ? (
            <MobileFinancePage onNavigate={goTab} onSyncChanged={handleSyncChanged} />
          ) : section === 'guard' && bootstrap ? (
            <MobileGuardPage
              bootstrap={bootstrap}
              onSyncChanged={handleSyncChanged}
              onNavigate={goTab}
            />
          ) : section === 'notifications' ? (
            <MobileNotificationsPage
              onOpenRoute={(r) => navigate(r)}
              onNavigateTab={goTab}
              appearancePrefs={activeUser.preferences ?? DEFAULT_APPEARANCE_PREFS}
              onChangeAppearancePrefs={handleAppearanceChange}
              userDisplayName={activeUser.displayName}
              currentUser={activeUser}
              onUserUpdated={handleUserUpdated}
              dark={dark}
              onToggleTheme={toggleTheme}
            />
          ) : section === 'stitch' ? (
            <MobileStitchGalleryPage onNavigateTab={goTab} />
          ) : bootstrap ? (
            <MobileDashboardPage
              bootstrap={bootstrap}
              outboxCount={outboxCount}
              onNavigate={goTab}
            />
          ) : (
            <BlockManagementPage
              currentUser={activeUser}
              onSyncChanged={handleSyncChanged}
            />
          )}
        </div>
      </main>

      {/* UNTOUCHED Digikala Floating Dock + Floating Alarm Pill + Circular Violet-Blue FAB */}
      <MBottomNav
        items={navItems}
        active={quickActionsOpen ? '__quick_actions__' : activeDockId}
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

      {/* Role-Aware Quick Actions Modal */}
      <StitchModal
        open={quickActionsOpen}
        onClose={() => setQuickActionsOpen(false)}
        title={`اقدام سریع • ${roleDef.shortTitle}`}
        subtitle="دسترسی یک‌کلیکی به پرکاربردترین عملیات این نقش"
      >
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          {roleDef.quickActions.map((act) => (
            <button
              key={act.title}
              type="button"
              onClick={() => {
                setQuickActionsOpen(false);
                goTab(act.route);
              }}
              className="flex flex-col items-start gap-2 p-3 rounded-[var(--ui-card-radius)] border border-outline-variant/55 bg-surface-container-low/75 hover:bg-surface-container active:scale-[0.97] transition-[transform,background-color] duration-150 text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <span
                className={`w-9 h-9 rounded-[var(--ui-btn-radius)] flex items-center justify-center shrink-0 ${act.tone}`}
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

      {/* Per-User Profile, Avatar Upload & 6-Palette Personalization Modal */}
      <StitchModal
        open={appearanceOpen}
        onClose={() => setAppearanceOpen(false)}
        title="پروفایل کاربری و شخصی‌سازی ظاهر"
        subtitle={`تنظیمات اختصاصی حساب ${activeUser.displayName} (@${activeUser.username})`}
      >
        <UserProfilePanel
          compact
          user={activeUser}
          onUserUpdated={handleUserUpdated}
          appearancePrefs={activeUser.preferences ?? DEFAULT_APPEARANCE_PREFS}
          onChangeAppearancePrefs={handleAppearanceChange}
          dark={dark}
          onToggleTheme={toggleTheme}
        />
      </StitchModal>

      {/* Header Quick Role Switcher Modal */}
      <StitchModal
        open={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
        title="تغییر سریع نقش و مشاهده منو"
        subtitle={`حساب فعلی: ${activeUser.displayName} (@${activeUser.username})`}
      >
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ROLE_ORDER.map((rId) => {
              const def = ROLE_DEFINITIONS[rId];
              const isCurrent = activeUser.role === rId;
              return (
                <button
                  key={rId}
                  type="button"
                  disabled={Boolean(switchingRole)}
                  onClick={() => void handleQuickSwitchRole(rId)}
                  className={`p-2.5 rounded-[var(--ui-card-radius)] border text-right flex items-center justify-between gap-2 transition-colors ${
                    isCurrent
                      ? 'bg-primary-container/50 border-primary'
                      : 'bg-surface-container-low/70 border-outline-variant/50 hover:border-primary/60'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-[19px] text-primary shrink-0">
                      {def.icon}
                    </span>
                    <div className="min-w-0">
                      <strong className="text-[12.5px] font-bold text-on-surface block truncate">
                        {def.title}
                      </strong>
                      <span className="text-[11px] text-on-surface-variant block truncate">
                        {def.dockTabs.map((d) => d.label).join(' • ')}
                      </span>
                    </div>
                  </div>
                  {isCurrent && <StatusPill label="فعال" tone="positive" />}
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-outline-variant/40">
            <StitchButton
              variant="secondary"
              icon="login"
              className="w-full"
              onClick={() => {
                setSwitcherOpen(false);
                setPortalOpen(true);
              }}
            >
              باز کردن صفحه درگاه نقش‌ها و ورود با نام کاربری
            </StitchButton>
          </div>
        </div>
      </StitchModal>
    </div>
  );
};

export default MobileShell;
