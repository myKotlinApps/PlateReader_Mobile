import React, { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  FileText,
  Home,
  Lock,
  LogOut,
  Mail,
  Moon,
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
import { NoticeBanner } from './ui/StitchKit';

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

  const section = pathname.replace(/^\/m\/?/, '').split('/')[0] || 'dashboard';

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
        <div className="spinner-border text-primary mb-2" role="status" />
        <div className="text-[13px] text-muted-adaptive">در حال اتصال...</div>
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

  const navItems = [
    { id: 'dashboard', label: 'خانه', icon: <Home size={19} strokeWidth={1.9} /> },
    {
      id: 'facilities',
      label: 'تاسیسات',
      icon: <Wrench size={19} strokeWidth={1.9} />,
      badge: bootstrap.counters.active_leaks ?? 0,
    },
    ...(bootstrap.mobile_modules.includes('finance')
      ? [{ id: 'finance', label: 'مالی', icon: <Wallet size={19} strokeWidth={1.9} /> }]
      : []),
    ...(bootstrap.mobile_modules.includes('letters')
      ? [{ id: 'letters', label: 'دبیرخانه', icon: <Mail size={19} strokeWidth={1.9} /> }]
      : []),
    ...(bootstrap.mobile_modules.includes('forms')
      ? [{ id: 'forms', label: 'مصوبات', icon: <FileText size={19} strokeWidth={1.9} /> }]
      : []),
    ...(bootstrap.license.guard_enabled && bootstrap.mobile_modules.includes('guard')
      ? [
          {
            id: 'guard',
            label: 'نگهبانی',
            icon: <Shield size={19} strokeWidth={1.9} />,
            badge: bootstrap.counters.unread_guard_directives,
          },
        ]
      : []),
  ];

  return (
    <div className="alpr-mobile-shell" dir="rtl">
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

      <main className="container-fluid py-3 px-3 flex-grow-1" style={{ maxWidth: 680 }}>
        {bootError && (
          <div className="mb-3">
            <NoticeBanner message={bootError} tone="danger" onClose={() => setBootError('')} />
          </div>
        )}
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
      </main>

      <MBottomNav items={navItems} active={activeSection} onChange={goTab} />
    </div>
  );
};

export default MobileShell;
