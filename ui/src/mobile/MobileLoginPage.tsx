import React, { useState } from 'react';
import { KeyRound, QrCode, ScanLine, Server, ShieldCheck } from 'lucide-react';
import { loginMobileDevice, redeemQrPairing } from './mobileApi';
import { DEFAULT_RELAY_WORKER_URL, loadSavedRemoteConfig } from './remoteTransport';
import { tryScanQrNative } from './nativeBridge';
import { MButton, MCard, MInput, MTextarea } from './components';

interface Props {
  onAuthenticated: () => void;
}

export const MobileLoginPage: React.FC<Props> = ({ onAuthenticated }) => {
  const cfg = loadSavedRemoteConfig();
  const [mode, setMode] = useState<'password' | 'qr'>('password');
  const [serverUrl, setServerUrl] = useState(cfg.serverBaseUrl || window.location.origin);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [deviceName, setDeviceName] = useState('گوشی همراه من');
  const [qrText, setQrText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await loginMobileDevice(serverUrl, username, password, deviceName);
      onAuthenticated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ورود ناموفق بود.');
    } finally {
      setBusy(false);
    }
  };

  const handleQrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await redeemQrPairing(qrText, serverUrl);
      onAuthenticated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'کد اتصال QR معتبر نیست.');
    } finally {
      setBusy(false);
    }
  };

  const handleNativeScan = async () => {
    try {
      const scanned = await tryScanQrNative();
      if (scanned) {
        setQrText(scanned);
        setBusy(true);
        await redeemQrPairing(scanned, serverUrl);
        onAuthenticated();
      } else {
        setError('اسکن دوربین فقط در اپ نصب‌شده فعال است؛ کد یکبارمصرف یا متن QR را در کادر وارد کنید.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'اسکن ناموفق بود.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="alpr-mobile-shell px-3 py-4 justify-content-center" dir="rtl">
      <div className="mx-auto w-100" style={{ maxWidth: 440 }}>
        <MCard>
          <div className="d-flex align-items-center gap-3 mb-3">
            <span className="m-list-item__lead" style={{ width: 46, height: 46 }}>
              <ShieldCheck size={24} />
            </span>
            <div>
              <h5 className="fw-bold mb-1">همراه شهرک و انتظامات</h5>
              <div className="small text-muted-adaptive">ورود مدیران، بلوک‌ها و نگهبانی</div>
            </div>
          </div>

          <div className="d-flex gap-2 mb-3">
            <MButton small block variant={mode === 'password' ? 'primary' : 'secondary'} onClick={() => setMode('password')} icon={<KeyRound size={16} />}>
              نام کاربری
            </MButton>
            <MButton small block variant={mode === 'qr' ? 'primary' : 'secondary'} onClick={() => setMode('qr')} icon={<QrCode size={16} />}>
              کد QR
            </MButton>
          </div>

          <div className="mb-3">
            <MInput
              type="url"
              dir="ltr"
              label="نشانی سرور (تونل / دامنه / IP محلی)"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder={DEFAULT_RELAY_WORKER_URL}
              hint={`در صورت عدم دسترسی مستقیم، ورود به‌طور خودکار از کلادفلر (${DEFAULT_RELAY_WORKER_URL.replace('https://', '')}) انجام می‌شود.`}
            />
          </div>

          {error && (
            <div className="m-note m-note--danger mb-3" role="alert">
              <ShieldCheck size={18} />
              <span>{error}</span>
            </div>
          )}

          {mode === 'password' ? (
            <form onSubmit={handlePasswordSubmit} className="d-flex flex-column gap-3">
              <MInput
                type="text"
                dir="ltr"
                label="نام کاربری"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
              />
              <MInput
                type="password"
                label="رمز عبور"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <MInput label="نام این گوشی" value={deviceName} onChange={(e) => setDeviceName(e.target.value)} />
              <MButton type="submit" block loading={busy}>
                {busy ? 'در حال ورود...' : 'ورود به سامانه'}
              </MButton>
            </form>
          ) : (
            <form onSubmit={handleQrSubmit} className="d-flex flex-column gap-3">
              <MButton type="button" variant="secondary" block onClick={handleNativeScan} disabled={busy} icon={<ScanLine size={18} />}>
                اسکن QR با دوربین گوشی
              </MButton>
              <MTextarea
                dir="ltr"
                rows={3}
                label="یا چسباندن کد اتصال یکبارمصرف / متن QR"
                value={qrText}
                onChange={(e) => setQrText(e.target.value)}
                placeholder='{"pair_code":"..."}'
                required
              />
              <MButton type="submit" block loading={busy}>
                {busy ? 'در حال اتصال...' : 'تأیید و اتصال دستگاه'}
              </MButton>
            </form>
          )}
        </MCard>
      </div>
    </div>
  );
};