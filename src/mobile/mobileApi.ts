import { detectMobilePlatform } from './nativeBridge';
import {
  DEFAULT_RELAY_WORKER_URL,
  fetchWithTimeout,
  loadMobileAuth,
  loadSavedRemoteConfig,
  prioritizedDirectUrls,
  relayWorkerEndpoint,
  remoteApiRequest,
  saveMobileAuth,
  saveRemoteConfig,
  type EndpointEntry,
  type MobileAuthState,
} from './remoteTransport';

export interface MobileBootstrap {
  ok: boolean;
  server_version: string;
  site_id: string;
  organization_name: string;
  user: {
    id: string;
    username: string;
    display_name: string;
    role: string;
    allowed_block_ids: string[];
    allowed_menus: string[];
  };
  permissions: Record<string, 'none' | 'read' | 'write'>;
  license: {
    profile_id: string;
    scale_tier: 'building_tower' | 'small_township' | 'super_township' | string;
    max_blocks: number;
    max_phases: number;
    alpr_addon_enabled: boolean;
    guard_enabled: boolean;
  };
  mobile_modules: string[];
  counters: {
    unread_guard_directives: number;
    open_work_orders: number;
    active_leaks?: number;
  };
}

export interface MobileFormTemplate {
  id: string;
  title: string;
  section: string;
  requires_camera_addon?: boolean;
  icon: string;
  fields: Array<{
    name: string;
    label: string;
    type: 'text' | 'textarea' | 'select' | 'number';
    required?: boolean;
    options?: string[];
  }>;
}

export async function discoverConnectInfo(baseUrl?: string): Promise<void> {
  const cfg = loadSavedRemoteConfig();
  const cleanOverride = (baseUrl || '').trim().replace(/\/+$/, '');
  const urls = cleanOverride
    ? [{ kind: 'origin' as const, url: cleanOverride, priority: 0 }, ...prioritizedDirectUrls(cfg)]
    : prioritizedDirectUrls(cfg);

  for (const ep of urls) {
    try {
      const resp = await fetchWithTimeout(`${ep.url}/api/v1/connect/info`, { cache: 'no-store' }, 3000);
      if (!resp.ok) continue;
      const data = (await resp.json()) as {
        endpoints?: EndpointEntry[];
        mailbox_public_key_hex?: string;
      };
      saveRemoteConfig({
        serverBaseUrl: cleanOverride || cfg.serverBaseUrl || ep.url,
        endpoints: Array.isArray(data.endpoints) && data.endpoints.length > 0 ? data.endpoints : cfg.endpoints,
        mailboxPublicKeyHex: data.mailbox_public_key_hex || cfg.mailboxPublicKeyHex,
      });
      return;
    } catch {
      /* try next */
    }
  }
}

export async function loginMobileDevice(
  serverUrl: string,
  username: string,
  password: string,
  deviceName?: string,
): Promise<MobileAuthState> {
  const base = (serverUrl || window.location.origin).trim().replace(/\/+$/, '');
  const cfg = loadSavedRemoteConfig();
  const relayUrl = relayWorkerEndpoint(cfg) || DEFAULT_RELAY_WORKER_URL;

  const candidates = [...new Set([base, ...prioritizedDirectUrls(cfg).map((ep) => ep.url)])];
  for (const url of candidates) {
    if (!/^https?:\/\//i.test(url) || url === relayUrl) continue;
    const resp = await fetchWithTimeout(`${url}/api/v1/auth/device/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        username,
        password,
        device_name: deviceName || 'گوشی مدیر / انتظامات',
        platform: detectMobilePlatform(),
      }),
    }, 5000).catch(() => null);
    if (!resp) continue;

    const data = (await resp.json().catch(() => null)) as {
      access_token?: string;
      refresh_token?: string;
      expires_at_ms?: number;
      refresh_expires_at_ms?: number;
      device?: { id?: string; device_name?: string };
      user?: Record<string, unknown>;
      error?: { message?: string };
    } | null;
    if (!data) continue;
    if (resp.ok && data.access_token && data.refresh_token) {
      const auth: MobileAuthState = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at_ms: data.expires_at_ms ?? Date.now() + 3600_000,
        refresh_expires_at_ms: data.refresh_expires_at_ms ?? Date.now() + 30 * 86400_000,
        device_id: data.device?.id ?? '',
        device_name: data.device?.device_name ?? 'موبایل',
        edge_auth: false,
        user: data.user,
      };
      saveRemoteConfig({ ...loadSavedRemoteConfig(), serverBaseUrl: url });
      await saveMobileAuth(auth);
      void discoverConnectInfo(url);
      return auth;
    }
    if ([400, 401, 403, 429].includes(resp.status) && data.error?.message) {
      throw new Error(data.error?.message || 'نام کاربری یا رمز عبور درست نیست.');
    }
  }

  // 2. Cloudflare Worker Edge Auth fallback (uses PBKDF2-SHA256 verifier synced from panel)
  const edgeResp = await fetch(`${relayUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      password,
      device_name: deviceName || 'گوشی موبایل',
    }),
  });
  const edgeData = (await edgeResp.json()) as {
    access_token?: string;
    expires_at_ms?: number;
    device?: { id?: string; device_name?: string };
    user?: Record<string, unknown>;
    mailbox_public_key_hex?: string;
    error?: { message?: string };
  };
  if (!edgeResp.ok || !edgeData.access_token) {
    throw new Error(edgeData.error?.message || 'ورود از طریق کلادفلر ناموفق بود.');
  }
  const latestCfg = loadSavedRemoteConfig();
  saveRemoteConfig({
    serverBaseUrl: latestCfg.serverBaseUrl,
    endpoints: latestCfg.endpoints,
    mailboxPublicKeyHex: edgeData.mailbox_public_key_hex || latestCfg.mailboxPublicKeyHex,
  });
  const auth: MobileAuthState = {
    access_token: edgeData.access_token,
    refresh_token: '',
    expires_at_ms: edgeData.expires_at_ms ?? Date.now() + 12 * 3600_000,
    refresh_expires_at_ms: 0,
    device_id: edgeData.device?.id ?? '',
    device_name: edgeData.device?.device_name ?? 'موبایل (کلادفلر)',
    edge_auth: true,
    user: edgeData.user,
  };
  await saveMobileAuth(auth);
  return auth;
}

export async function redeemQrPairing(qrOrCode: string, explicitServerUrl?: string): Promise<MobileAuthState> {
  let pairCode = qrOrCode.trim();
  let endpoints: EndpointEntry[] = [];
  let pubHex = '';
  if (pairCode.startsWith('{')) {
    try {
      const parsed = JSON.parse(pairCode) as {
        pair_code?: string;
        endpoints?: EndpointEntry[];
        mailbox_public_key_hex?: string;
      };
      if (parsed.pair_code) pairCode = parsed.pair_code;
      if (Array.isArray(parsed.endpoints)) endpoints = parsed.endpoints;
      if (parsed.mailbox_public_key_hex) pubHex = parsed.mailbox_public_key_hex;
    } catch {
      /* treat raw text as pairCode */
    }
  }
  const cfg = loadSavedRemoteConfig();
  if (endpoints.length > 0 || pubHex || explicitServerUrl) {
    saveRemoteConfig({
      serverBaseUrl: explicitServerUrl?.trim().replace(/\/+$/, '') || endpoints[0]?.url || cfg.serverBaseUrl,
      endpoints: endpoints.length > 0 ? endpoints : cfg.endpoints,
      mailboxPublicKeyHex: pubHex || cfg.mailboxPublicKeyHex,
    });
  }
  const candidates = prioritizedDirectUrls(loadSavedRemoteConfig());
  if (explicitServerUrl) {
    candidates.unshift({ kind: 'origin', url: explicitServerUrl.trim().replace(/\/+$/, ''), priority: 0 });
  }
  let lastErr = 'کد اتصال QR معتبر نیست یا منقضی شده است.';
  for (const ep of candidates) {
    try {
      const resp = await fetch(`${ep.url}/api/v1/connect/qr/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          pair_code: pairCode,
          platform: detectMobilePlatform(),
        }),
      });
      const data = (await resp.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_at_ms?: number;
        refresh_expires_at_ms?: number;
        device?: { id?: string; device_name?: string };
        user?: Record<string, unknown>;
        connect?: { endpoints?: EndpointEntry[]; mailbox_public_key_hex?: string };
        error?: { message?: string };
      };
      if (!resp.ok || !data.access_token) {
        lastErr = data.error?.message || lastErr;
        continue;
      }
      if (data.connect) {
        saveRemoteConfig({
          serverBaseUrl: ep.url,
          endpoints: data.connect.endpoints || [],
          mailboxPublicKeyHex: data.connect.mailbox_public_key_hex || '',
        });
      }
      const auth: MobileAuthState = {
        access_token: data.access_token,
        refresh_token: data.refresh_token || '',
        expires_at_ms: data.expires_at_ms ?? Date.now() + 3600_000,
        refresh_expires_at_ms: data.refresh_expires_at_ms ?? Date.now() + 30 * 86400_000,
        device_id: data.device?.id ?? '',
        device_name: data.device?.device_name ?? 'موبایل',
        user: data.user,
      };
      await saveMobileAuth(auth);
      return auth;
    } catch {
      /* try next */
    }
  }
  throw new Error(lastErr);
}

export const mobileApi = {
  bootstrap: async (): Promise<{ data?: MobileBootstrap; via: string }> => {
    try {
      const result = await remoteApiRequest<MobileBootstrap>('/api/v1/mobile/bootstrap');
      if (!Array.isArray(result.data?.mobile_modules) || !result.data?.license || !result.data?.user) {
        throw new Error('پاسخ سرور موبایل معتبر نیست.');
      }
      return result;
    } catch (err) {
      const relayUrl = relayWorkerEndpoint(loadSavedRemoteConfig()) || DEFAULT_RELAY_WORKER_URL;
      const auth = await loadMobileAuth();
      if (auth?.access_token && auth.access_token.startsWith('edge_v1.')) {
        const resp = await fetch(`${relayUrl}/auth/bootstrap`, {
          headers: { Authorization: `Bearer ${auth.access_token}` },
          cache: 'no-store',
        });
        if (resp.ok) {
          const boot = (await resp.json()) as MobileBootstrap & { mailbox_public_key_hex?: string };
          if (!Array.isArray(boot.mobile_modules) || !boot.license || !boot.user) throw err;
          if (boot.mailbox_public_key_hex) {
            const cfg = loadSavedRemoteConfig();
            saveRemoteConfig({ ...cfg, mailboxPublicKeyHex: boot.mailbox_public_key_hex });
          }
          return { data: boot, via: 'relay' };
        }
      }
      throw err;
    }
  },
  listForms: () => remoteApiRequest<{ forms: MobileFormTemplate[] }>('/api/v1/mobile/forms'),
  submitForm: (formId: string, payload: Record<string, unknown>) =>
    remoteApiRequest<{ ok: boolean; duplicate?: boolean; record?: unknown }>(
      '/api/v1/mobile/forms/submit',
      {
        method: 'POST',
        body: JSON.stringify({
          form_id: formId,
          payload,
          idempotency_key: `form-${formId}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
        }),
      },
      { allowOfflineQueue: true, offlineLabel: `ارسال فرم (${formId})` },
    ),
  notifications: () => remoteApiRequest<{ items: Array<Record<string, any>> }>('/api/v1/mobile/notifications'),
  finance: () => remoteApiRequest<{ wallets: Array<Record<string, any>> }>('/api/v1/mobile/finance'),
  guardSummary: () =>
    remoteApiRequest<{
      guard_enabled: boolean;
      directives: Array<Record<string, any>>;
      recent_events: Array<Record<string, any>>;
      guest_permits: Array<Record<string, any>>;
      incidents: Array<Record<string, any>>;
    }>('/api/v1/mobile/guard/summary'),
  sendGuardDirective: (payload: Record<string, unknown>) =>
    remoteApiRequest<{ ok: boolean; directive?: Record<string, any> }>(
      '/api/v1/mobile/guard/directives',
      { method: 'POST', body: JSON.stringify(payload) },
      { allowOfflineQueue: true, offlineLabel: `دستور انتظامات: ${String(payload.subject || '')}` },
    ),
  ackGuardDirective: (id: string, status: 'acknowledged' | 'completed', note = '') =>
    remoteApiRequest<{ ok: boolean; directive?: Record<string, any> }>(
      `/api/v1/mobile/guard/directives/${encodeURIComponent(id)}/ack`,
      { method: 'POST', body: JSON.stringify({ status, note }) },
      { allowOfflineQueue: true, offlineLabel: `تأیید دریافت دستور انتظامات` },
    ),
  recordGuardEntryExit: (payload: Record<string, unknown>) =>
    remoteApiRequest<{ ok: boolean; event?: Record<string, any> }>(
      '/api/v1/mobile/guard/entry-exit',
      {
        method: 'POST',
        body: JSON.stringify({
          ...payload,
          idempotency_key: `ge-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
        }),
      },
      { allowOfflineQueue: true, offlineLabel: `ثبت تردد انتظامات (${String(payload.plate_text || payload.guest_name || '')})` },
    ),
  reportGuardIncident: (payload: Record<string, unknown>) =>
    remoteApiRequest<{ ok: boolean; incident?: Record<string, any> }>(
      '/api/v1/mobile/guard/incidents',
      { method: 'POST', body: JSON.stringify(payload) },
      { allowOfflineQueue: true, offlineLabel: `گزارش حادثه: ${String(payload.title || '')}` },
    ),
  registerPushToken: (pushToken: string, pushKind: 'webpush' | 'fcm' | 'apns', deviceId?: string) =>
    remoteApiRequest<{ ok: boolean }>('/api/v1/auth/devices/push-token', {
      method: 'POST',
      body: JSON.stringify({ push_token: pushToken, push_kind: pushKind, device_id: deviceId }),
    }),
  correspondenceBootstrap: () =>
    remoteApiRequest<Record<string, any>>('/api/v1/correspondence/bootstrap'),
  correspondenceCartable: (folder = 'inbox') =>
    remoteApiRequest<Record<string, any>>(`/api/v1/correspondence/cartable?folder=${encodeURIComponent(folder)}`),
  correspondenceSave: (input: Record<string, unknown>) =>
    remoteApiRequest<Record<string, any>>(
      '/api/v1/correspondence/letters',
      { method: 'POST', body: JSON.stringify(input) },
      { allowOfflineQueue: true, offlineLabel: `ارسال نامه: ${String(input.subject || '')}` },
    ),
  payFinanceWallet: (walletId: string) =>
    remoteApiRequest<{ ok: boolean; wallet?: Record<string, any> }>(
      '/api/v1/mobile/finance/pay',
      { method: 'POST', body: JSON.stringify({ wallet_id: walletId }) },
      { allowOfflineQueue: true, offlineLabel: `تایید پرداخت شارژ (${walletId})` },
    ),
  remindFinanceWallet: (unitLabel: string) =>
    remoteApiRequest<{ ok: boolean }>(
      '/api/v1/mobile/finance/remind',
      { method: 'POST', body: JSON.stringify({ unit_label: unitLabel }) },
      { allowOfflineQueue: true, offlineLabel: `ارسال پیامک یادآوری (${unitLabel})` },
    ),
  referCorrespondenceLetter: (input: {
    letter_number: string;
    recipient_name: string;
    action_type: string;
    annotation: string;
  }) =>
    remoteApiRequest<{ ok: boolean; letter?: Record<string, any> }>(
      '/api/v1/correspondence/refer',
      { method: 'POST', body: JSON.stringify(input) },
      { allowOfflineQueue: true, offlineLabel: `ارجاع نامه (${input.letter_number})` },
    ),
  listStitchScreens: () =>
    remoteApiRequest<{
      screens: Array<{
        id: string;
        num: number;
        title: string;
        category: string;
        badge: string;
        tab: string;
        hasImage?: boolean;
      }>;
      designMd: string;
    }>('/api/v1/stitch/screens'),
  listLeaks: () =>
    remoteApiRequest<{ items: Array<Record<string, any>> }>('/api/v1/mobile/leaks'),
  createLeak: (payload: Record<string, unknown>) =>
    remoteApiRequest<{ ok: boolean; leak?: Record<string, any> }>(
      '/api/v1/mobile/leaks',
      { method: 'POST', body: JSON.stringify(payload) },
      { allowOfflineQueue: true, offlineLabel: 'ثبت گزارش نشتی آب' },
    ),
  updateLeakStatus: (
    id: string,
    payload: { status: 'active' | 'repairing' | 'resolved'; note?: string; voucherRef?: string },
  ) =>
    remoteApiRequest<{ ok: boolean; leak?: Record<string, any> }>(
      `/api/v1/mobile/leaks/${encodeURIComponent(id)}/status`,
      { method: 'POST', body: JSON.stringify(payload) },
      { allowOfflineQueue: true, offlineLabel: `به‌روزرسانی پرونده نشتی (${id})` },
    ),
  getPettyCash: () =>
    remoteApiRequest<{ data: Record<string, any> }>('/api/v1/mobile/petty-cash'),
  replenishPettyCash: (amountTomans: number, reason: string) =>
    remoteApiRequest<{ ok: boolean; request?: Record<string, any>; data?: Record<string, any> }>(
      '/api/v1/mobile/petty-cash/replenish',
      { method: 'POST', body: JSON.stringify({ amountTomans, reason }) },
      { allowOfflineQueue: true, offlineLabel: 'درخواست شارژ تنخواه' },
    ),
  rebalancePettyCash: () =>
    remoteApiRequest<{ ok: boolean; data?: Record<string, any> }>(
      '/api/v1/mobile/petty-cash/rebalance',
      { method: 'POST', body: JSON.stringify({}) },
      { allowOfflineQueue: true, offlineLabel: 'سند اصلاحی بودجه تنخواه' },
    ),
  getReconciliation: () =>
    remoteApiRequest<{ data: Record<string, any> }>('/api/v1/mobile/finance/reconciliation'),
  reconciliationAction: (payload: {
    action: 'run_auto' | 'resolve_unit' | 'add_expense' | 'close_period';
    unitId?: string;
    expenseTitle?: string;
    expenseAmount?: number;
    fileName?: string;
  }) =>
    remoteApiRequest<{ ok: boolean; data?: Record<string, any> }>(
      '/api/v1/mobile/finance/reconciliation/action',
      { method: 'POST', body: JSON.stringify(payload) },
      { allowOfflineQueue: true, offlineLabel: 'عملیات تطبیق هوشمند بانکی' },
    ),
};

