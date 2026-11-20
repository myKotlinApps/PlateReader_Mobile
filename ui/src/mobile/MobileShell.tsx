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
  Wifi,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { identityApi } from '../api/client';
import { mobileApi, type MobileBootstrap } from './mobileApi';
import { MobileLoginPage } from './MobileLoginPage';
import { MobileDashboardPage } from './MobileDashboardPage';
import { MobileFormsPage } from './MobileFormsPage';
import { MobileLettersPage } from './MobileLettersPage';
import { MobileFinancePage } from './MobileFinancePage';
import { MobileGuardPage } from './MobileGuardPage';
import { MobileNotificationsPage } from './MobileNotificationsPage';
import { hasAppPin, verifyAppPin } from './nativeBridge';
import {
  activeTransportLabel,
  flushOfflineOutbox,
  loadMobileAuth,
  loadOutbox,
  MobileAuthError,
  remoteApiRequest,
  saveMobileAuth,
} from './remoteTransport';
import './mobile.css';
import { MAppBar, MBottomNav } from './components';

// Dev-only design-system review surface (/m/_styleguide), code-split out of prod.
const MobileStyleguide = React.lazy(() => import('./MobileStyleguide'));

const CHANNEL_FA: Record<string, string> = {
  lan: 'شبکه داخلی',
  tunnel: 'تونل کلادفلر',
  vps: 'VPS پشتیبان',
  relay: 'صندوق پیام',
  origin: 'متصل',
  offline: 'آفلاین',
};

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
  const [channel, setChannel] = useState(activeTransportLabel);
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

    const onCh = () => setChannel(activeTransportLabel());
    const onOut = () => setOutboxCount(loadOutbox().length);
    window.addEventListener('alpr-mobile-channel-changed', onCh);
    window.addEventListener('alpr-mobile-outbox-changed', onOut);
    return () => {
      window.removeEventListener('alpr-mobile-channel-changed', onCh);
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
      setBootError('خروج از حساب انجام نشد. اتصال را بررسی کنید و دوباره تلاش کنید.');
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
          <h6 className="fw-bold mb-3 d-flex align-items-center gap-2">
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
            {pinErr && <div className="small text-danger">{pinErr}</div>}
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
        <div className="small text-muted-adaptive">در حال اتصال به سامانه...</div>
      </div>
    );
  }

  if (!hasAuth || !bootstrap) {
    return <MobileLoginPage onAuthenticated={() => void loadBootstrap()} />;
  }

  const goTab = (tab: string) => {
    navigate(tab === 'dashboard' ? '/m' : `/m/${tab}`);
  };

  const SECTION_META: Record<string, { title: string; subtitle: string }> = {
    dashboard: { title: 'داشبورد', subtitle: 'نمای کلی شهرک' },
    forms: { title: 'فرم‌ها', subtitle: 'ثبت و پیگیری درخواست‌ها' },
    letters: { title: 'نامه‌ها', subtitle: 'کارتابل و ارسال نامه' },
    finance: { title: 'مالی بلوک', subtitle: 'شارژ و بدهی واحدها' },
    guard: { title: 'انتظامات', subtitle: 'دستورها و تردد' },
    notifications: { title: 'اعلان‌ها', subtitle: 'آخرین رویدادها' },
  };
  const currentMeta = SECTION_META[section] ?? SECTION_META.dashboard;
  const activeSection = section || 'dashboard';

  const navItems = [
    { id: 'dashboard', label: 'داشبورد', icon: <Home size={19} /> },
    ...(bootstrap.mobile_modules.includes('forms') ? [{ id: 'forms', label: 'فرم‌ها', icon: <FileText size={19} /> }] : []),
    ...(bootstrap.mobile_modules.includes('letters') ? [{ id: 'letters', label: 'نامه‌ها', icon: <Mail size={19} /> }] : []),
    ...(bootstrap.mobile_modules.includes('finance') ? [{ id: 'finance', label: 'مالی', icon: <Wallet size={19} /> }] : []),
    ...(bootstrap.license.guard_enabled && bootstrap.mobile_modules.includes('guard')
      ? [{ id: 'guard', label: 'انتظامات', icon: <Shield size={19} />, badge: bootstrap.counters.unread_guard_directives }]
      : []),
  ];

  return (
    <div className="alpr-mobile-shell" dir="rtl">
      <MAppBar
        title={currentMeta.title}
        subtitle={currentMeta.subtitle}
        leading={
          <>
            <span className="alpr-mobile-pill">
              <Wifi size={13} />
              <span>{CHANNEL_FA[channel.kind] || channel.kind}</span>
            </span>
            {outboxCount > 0 && (
              <button
                type="button"
                onClick={() => void handleFlush()}
                disabled={syncing}
                className="btn btn-sm btn-warning fw-semibold d-flex align-items-center gap-1"
              >
                <RefreshCw size={13} className={syncing ? 'spin' : ''} />
                <span>همگام‌سازی ({outboxCount.toLocaleString('fa-IR')})</span>
              </button>
            )}
          </>
        }
        trailing={
          <>
            <button
              type="button"
              onClick={() => goTab('notifications')}
              className="alpr-mobile-btn-secondary py-1 px-2"
              style={{ minHeight: 38 }}
              aria-label="اعلان‌ها"
            >
              <Bell size={17} />
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="alpr-mobile-btn-secondary py-1 px-2"
              style={{ minHeight: 38 }}
              aria-label="تغییر تم"
            >
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="alpr-mobile-btn-secondary py-1 px-2"
              style={{ minHeight: 38 }}
              aria-label="خروج"
            >
              <LogOut size={17} />
            </button>
          </>
        }
      />

      <main className="container-fluid py-3 px-3 flex-grow-1" style={{ maxWidth: 680 }}>
        {bootError && (
          <div className="alert alert-warning small py-2 px-3 mb-3">{bootError}</div>
        )}
        {section === 'forms' ? (
          <MobileFormsPage bootstrap={bootstrap} onSyncChanged={() => setOutboxCount(loadOutbox().length)} />
        ) : section === 'letters' ? (
          <MobileLettersPage bootstrap={bootstrap} onSyncChanged={() => setOutboxCount(loadOutbox().length)} />
        ) : section === 'finance' ? (
          <MobileFinancePage />
        ) : section === 'guard' ? (
          <MobileGuardPage bootstrap={bootstrap} onSyncChanged={() => setOutboxCount(loadOutbox().length)} />
        ) : section === 'notifications' ? (
          <MobileNotificationsPage onOpenRoute={(r) => navigate(r)} />
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
