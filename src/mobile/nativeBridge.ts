/**
 * Unified Web PWA + Capacitor Native (Android APK / Google Play / iOS) bridge.
 * Safely falls back to standard Web APIs when Capacitor plugins are absent in browser mode.
 */
import { hexEncode, randomBytes, sha256 } from './cryptoRelay';

const TOKEN_STORE_KEY = 'alpr_mobile_auth_v1';
const PIN_HASH_KEY = 'alpr_mobile_pin_hash_v1';
const textEncoder = new TextEncoder();

interface CapPlugins {
  Preferences?: {
    get(opts: { key: string }): Promise<{ value: string | null }>;
    set(opts: { key: string; value: string }): Promise<void>;
    remove(opts: { key: string }): Promise<void>;
  };
  Camera?: {
    getPhoto(opts: Record<string, unknown>): Promise<{ base64String?: string; dataUrl?: string }>;
  };
  PushNotifications?: {
    requestPermissions(): Promise<{ receive: string }>;
    register(): Promise<void>;
    addListener(event: string, cb: (data: any) => void): Promise<void>;
  };
  BarcodeScanner?: {
    scan(): Promise<{ barcodes?: Array<{ rawValue?: string }> }>;
  };
}

function capPlugins(): CapPlugins | null {
  const cap = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: CapPlugins } }).Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  return cap.Plugins ?? null;
}

export function detectMobilePlatform(): 'android_apk' | 'ios_native' | 'pwa_ios' | 'pwa_android' {
  const cap = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } }).Capacitor;
  if (cap?.isNativePlatform?.()) {
    return cap.getPlatform?.() === 'ios' ? 'ios_native' : 'android_apk';
  }
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  return /iPhone|iPad|iPod/i.test(ua) ? 'pwa_ios' : 'pwa_android';
}

export async function secureSetItem(key: string, value: string): Promise<void> {
  const prefs = capPlugins()?.Preferences;
  if (prefs) {
    await prefs.set({ key, value }).catch(() => undefined);
  }
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore quota/private mode errors */
  }
}

export async function secureGetItem(key: string): Promise<string | null> {
  const prefs = capPlugins()?.Preferences;
  if (prefs) {
    try {
      const res = await prefs.get({ key });
      if (res?.value != null) return res.value;
    } catch {
      /* fallback */
    }
  }
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function secureRemoveItem(key: string): Promise<void> {
  const prefs = capPlugins()?.Preferences;
  if (prefs) {
    await prefs.remove({ key }).catch(() => undefined);
  }
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function stretchPin(salt: string, pin: string): string {
  let d = sha256(textEncoder.encode(`${salt}:${pin}`));
  for (let i = 0; i < 20000; i++) {
    const buf = new Uint8Array(d.length + 16);
    buf.set(d);
    buf.set(textEncoder.encode(salt.slice(0, 16)), d.length);
    d = sha256(buf);
  }
  return hexEncode(d);
}

export async function setAppPin(pin: string): Promise<void> {
  const clean = pin.trim();
  if (clean.length < 4) throw new Error('پین قفل برنامه باید حداقل ۴ رقم باشد.');
  const salt = hexEncode(randomBytes(16));
  await secureSetItem(PIN_HASH_KEY, `v2:${salt}:${stretchPin(salt, clean)}`);
}

export async function hasAppPin(): Promise<boolean> {
  return Boolean(await secureGetItem(PIN_HASH_KEY));
}

export async function verifyAppPin(pin: string): Promise<boolean> {
  const stored = await secureGetItem(PIN_HASH_KEY);
  if (!stored) return true;
  const parts = stored.split(':');
  if (parts[0] === 'v2') {
    const [, salt, expected] = parts;
    if (!salt || !expected) return false;
    return stretchPin(salt, pin.trim()) === expected;
  }
  const [salt, expected] = parts; // legacy single-round hash
  if (!salt || !expected) return false;
  return hexEncode(sha256(textEncoder.encode(`${salt}:${pin.trim()}`))) === expected;
}

export async function clearAppPin(): Promise<void> {
  await secureRemoveItem(PIN_HASH_KEY);
}

/** Compresses a File or dataUrl image client-side to JPEG (<= ~350 KB, max width 1280px). */
export async function compressImageFileToBase64(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('خواندن تصویر ناموفق بود.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('فرمت تصویر پشتیبانی نمی‌شود.'));
    el.src = dataUrl;
  });

  const maxW = 1280;
  const scale = img.width > maxW ? maxW / img.width : 1;
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('پردازش گرافیکی در این مرورگر در دسترس نیست.');
  ctx.drawImage(img, 0, 0, w, h);

  for (const quality of [0.76, 0.58, 0.42]) {
    const encoded = canvas.toDataURL('image/jpeg', quality);
    const b64 = encoded.split(',')[1] || '';
    if (b64.length <= 450_000 || quality <= 0.45) {
      return b64;
    }
  }
  throw new Error('حجم تصویر پس از فشرده‌سازی همچنان زیاد است.');
}

export async function captureNativePhotoBase64(): Promise<string | null> {
  const camera = capPlugins()?.Camera;
  if (!camera) return null;
  const photo = await camera.getPhoto({
    quality: 72,
    width: 1280,
    allowEditing: false,
    resultType: 'base64',
  });
  return photo.base64String ?? null;
}

export async function tryScanQrNative(): Promise<string | null> {
  const scanner = capPlugins()?.BarcodeScanner;
  if (!scanner) return null;
  const res = await scanner.scan();
  return res.barcodes?.[0]?.rawValue ?? null;
}

export async function registerPushChannel(
  onToken: (token: string, kind: 'webpush' | 'fcm' | 'apns') => Promise<void>,
): Promise<'granted' | 'denied' | 'unsupported'> {
  const push = capPlugins()?.PushNotifications;
  if (push) {
    const perm = await push.requestPermissions();
    if (perm.receive !== 'granted') return 'denied';
    await push.addListener('registration', (token: { value?: string }) => {
      if (token?.value) {
        const kind = detectMobilePlatform() === 'ios_native' ? 'apns' : 'fcm';
        void onToken(token.value, kind);
      }
    });
    await push.register();
    return 'granted';
  }
  if (typeof Notification === 'undefined') return 'unsupported';
  const res = await Notification.requestPermission();
  if (res !== 'granted') return 'denied';
  // Register logical WebPush device channel anchor until VAPID key is attached by operator
  await onToken(`webpush:${window.location.origin}:${Date.now()}`, 'webpush');
  return 'granted';
}

export { TOKEN_STORE_KEY };
