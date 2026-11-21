/**
 * Multi-layer Remote Failover Transport & Offline Zero-Knowledge Encrypted Outbox (`T07`, `T16`).
 *
 * Priority:
 *  1. Same-origin / Configured LAN URL (when reachable on internal network)
 *  2. Cloudflare Tunnel (Domain 1)
 *  3. VPS Reverse Proxy (Domain 2)
 *  4. Cloudflare Worker Encrypted Mailbox (`POST /inbox` via X25519 + ChaCha20-Poly1305)
 */
import { encryptRelayEnvelope } from './cryptoRelay';
import { secureGetItem, secureRemoveItem, secureSetItem, TOKEN_STORE_KEY } from './nativeBridge';
import { beginNetworkFetch, endNetworkFetch } from './ui/ComplexSpinner';

export interface EndpointEntry {
  kind: 'lan' | 'tunnel' | 'vps' | 'relay' | 'origin';
  url: string;
  priority: number;
}

/** Thrown when the session is invalid/revoked and the user must sign in again. */
export class MobileAuthError extends Error {}

export interface MobileAuthState {
  access_token: string;
  refresh_token: string;
  expires_at_ms: number;
  refresh_expires_at_ms: number;
  device_id: string;
  device_name: string;
  edge_auth?: boolean;
  user?: Record<string, unknown>;
}

export interface QueuedEnvelopeItem {
  id: string;
  created_at_ms: number;
  method: 'POST';
  path: string;
  body: Record<string, unknown>;
  label: string;
}

export const DEFAULT_RELAY_WORKER_URL = 'https://alpr-relay-worker.haashemi-alirezs.workers.dev';

const CONFIG_KEY = 'alpr_mobile_connect_cfg_v1';
const OUTBOX_KEY = 'alpr_mobile_outbox_v1';
const ACTIVE_CHANNEL_KEY = 'alpr_mobile_active_channel_v1';

export interface SavedRemoteConfig {
  serverBaseUrl: string; // Primary direct origin if manually typed
  endpoints: EndpointEntry[];
  mailboxPublicKeyHex: string;
}

export function loadSavedRemoteConfig(): SavedRemoteConfig {
  try {
    const raw = window.localStorage.getItem(CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SavedRemoteConfig>;
      const eps = Array.isArray(parsed.endpoints) ? [...parsed.endpoints] : [];
      if (!eps.some((e) => e.kind === 'relay')) {
        eps.push({ kind: 'relay', url: DEFAULT_RELAY_WORKER_URL, priority: 4 });
      }
      return {
        serverBaseUrl: parsed.serverBaseUrl || '',
        endpoints: eps,
        mailboxPublicKeyHex: parsed.mailboxPublicKeyHex || '',
      };
    }
  } catch {
    /* ignore */
  }
  const sameOrigin =
    typeof window !== 'undefined' && /^https?:/i.test(window.location.origin)
      ? window.location.origin
      : '';
  const defaults: EndpointEntry[] = [];
  if (sameOrigin) defaults.push({ kind: 'origin', url: sameOrigin, priority: 0 });
  defaults.push({ kind: 'relay', url: DEFAULT_RELAY_WORKER_URL, priority: 4 });
  return {
    serverBaseUrl: sameOrigin,
    endpoints: defaults,
    mailboxPublicKeyHex: '',
  };
}

export function saveRemoteConfig(cfg: SavedRemoteConfig): void {
  try {
    window.localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  } catch {
    /* ignore */
  }
}

export async function loadMobileAuth(): Promise<MobileAuthState | null> {
  const raw = await secureGetItem(TOKEN_STORE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MobileAuthState;
  } catch {
    return null;
  }
}

export async function saveMobileAuth(auth: MobileAuthState | null): Promise<void> {
  if (!auth) {
    await secureRemoveItem(TOKEN_STORE_KEY);
    return;
  }
  await secureSetItem(TOKEN_STORE_KEY, JSON.stringify(auth));
}

export function loadOutbox(): QueuedEnvelopeItem[] {
  try {
    const raw = window.localStorage.getItem(OUTBOX_KEY);
    return raw ? (JSON.parse(raw) as QueuedEnvelopeItem[]) : [];
  } catch {
    return [];
  }
}

function persistOutbox(items: QueuedEnvelopeItem[]): void {
  try {
    window.localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('alpr-mobile-outbox-changed', { detail: { count: items.length } }));
  } catch {
    /* ignore */
  }
}

export function activeTransportLabel(): { kind: string; url: string } {
  try {
    const raw = window.localStorage.getItem(ACTIVE_CHANNEL_KEY);
    if (raw) return JSON.parse(raw) as { kind: string; url: string };
  } catch {
    /* ignore */
  }
  return { kind: 'origin', url: typeof window !== 'undefined' ? window.location.origin : '' };
}

function setActiveTransportLabel(kind: string, url: string) {
  try {
    window.localStorage.setItem(ACTIVE_CHANNEL_KEY, JSON.stringify({ kind, url }));
    window.dispatchEvent(new CustomEvent('alpr-mobile-channel-changed', { detail: { kind, url } }));
  } catch {
    /* ignore */
  }
}

export function prioritizedDirectUrls(cfg: SavedRemoteConfig): EndpointEntry[] {
  const list: EndpointEntry[] = [];
  const seen = new Set<string>();
  const add = (kind: EndpointEntry['kind'], url: string, priority: number) => {
    const clean = (url || '').trim().replace(/\/+$/, '');
    if (!clean || !/^https?:\/\//i.test(clean) || seen.has(clean)) return;
    seen.add(clean);
    list.push({ kind, url: clean, priority });
  };
  if (cfg.serverBaseUrl) {
    const configured = cfg.endpoints.find((ep) => ep.url === cfg.serverBaseUrl);
    add(configured?.kind ?? 'origin', cfg.serverBaseUrl, 0);
  }
  for (const ep of cfg.endpoints) {
    if (ep.kind !== 'relay') add(ep.kind, ep.url, ep.priority);
  }
  if (typeof window !== 'undefined' && /^https?:/i.test(window.location.origin)) {
    add('origin', window.location.origin, 1);
  }
  return list.sort((a, b) => a.priority - b.priority);
}

export function relayWorkerEndpoint(cfg: SavedRemoteConfig): string | null {
  const rel = cfg.endpoints.find((e) => e.kind === 'relay');
  return rel?.url ? rel.url.replace(/\/+$/, '') : null;
}

export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 7000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: 'no-store' });
  } finally {
    window.clearTimeout(timer);
  }
}

async function tryRefreshAuth(baseUrls: EndpointEntry[], auth: MobileAuthState): Promise<MobileAuthState | null> {
  if (!auth.refresh_token) return null;
  for (const ep of baseUrls) {
    try {
      const resp = await fetchWithTimeout(`${ep.url}/api/v1/auth/device/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: auth.refresh_token }),
      });
      if (!resp.ok) continue;
      const data = (await resp.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_at_ms?: number;
        refresh_expires_at_ms?: number;
        device?: { id?: string; device_name?: string };
        user?: Record<string, unknown>;
      };
      if (data.access_token && data.refresh_token) {
        const next: MobileAuthState = {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at_ms: data.expires_at_ms ?? Date.now() + 3600_000,
          refresh_expires_at_ms: data.refresh_expires_at_ms ?? auth.refresh_expires_at_ms,
          device_id: data.device?.id ?? auth.device_id,
          device_name: data.device?.device_name ?? auth.device_name,
          user: data.user ?? auth.user,
        };
        await saveMobileAuth(next);
        return next;
      }
    } catch {
      /* try next failover endpoint */
    }
  }
  return null;
}

export async function remoteApiRequest<T>(
  path: string,
  init: RequestInit = {},
  opts: { allowOfflineQueue?: boolean; offlineLabel?: string } = {},
): Promise<{ data?: T; queuedOffline?: boolean; via: string }> {
  beginNetworkFetch();
  try {
    return await executeRemoteApiRequest<T>(path, init, opts);
  } finally {
    endNetworkFetch();
  }
}

async function executeRemoteApiRequest<T>(
  path: string,
  init: RequestInit = {},
  opts: { allowOfflineQueue?: boolean; offlineLabel?: string } = {},
): Promise<{ data?: T; queuedOffline?: boolean; via: string }> {
  const cfg = loadSavedRemoteConfig();
  const directList = prioritizedDirectUrls(cfg);
  let auth = await loadMobileAuth();

  const tryDirect = async (tok?: string): Promise<{ ok: true; data: T; via: string } | { fatalStatus: number; message: string; code?: string } | { networkFail: true }> => {
    for (const ep of directList) {
      const headers = new Headers(init.headers);
      if (!headers.has('Content-Type') && init.body) {
        headers.set('Content-Type', 'application/json');
      }
      if (tok) {
        headers.set('Authorization', `Bearer ${tok}`);
      }
      try {
        const resp = await fetchWithTimeout(`${ep.url}${path}`, {
          ...init,
          headers,
          credentials: init.credentials ?? (tok ? 'omit' : 'include'),
        });
        const text = await resp.text();
        let parsed: any = undefined;
        try {
          parsed = text ? JSON.parse(text) : undefined;
        } catch {
          parsed = text;
        }
        if (resp.ok && parsed && typeof parsed === 'object') {
          setActiveTransportLabel(ep.kind, ep.url);
          return { ok: true, data: parsed as T, via: ep.kind };
        }
        const errCode = parsed?.error?.code as string | undefined;
        const errMsg = (parsed?.error?.message as string) || `HTTP ${resp.status}`;
        if (resp.status >= 400 && resp.status < 500) {
          return { fatalStatus: resp.status, message: errMsg, code: errCode };
        }
      } catch {
        // Network error or timeout on this endpoint -> automatically fail over to next endpoint
      }
    }
    return { networkFail: true };
  };

  let attempt = await tryDirect(auth?.access_token);
  if ('fatalStatus' in attempt && attempt.fatalStatus === 401 && attempt.code !== 'device_revoked' && auth?.refresh_token) {
    const refreshed = await tryRefreshAuth(directList, auth);
    if (refreshed) {
      auth = refreshed;
      attempt = await tryDirect(auth.access_token);
    }
  }

  if ('ok' in attempt) {
    return { data: attempt.data, via: attempt.via };
  }
  if ('fatalStatus' in attempt) {
    if (attempt.code === 'device_revoked') {
      await saveMobileAuth(null);
    }
    if (attempt.fatalStatus === 401 || attempt.code === 'device_revoked') {
      throw new MobileAuthError(attempt.message);
    }
    throw new Error(attempt.message);
  }

  // All direct links unreachable -> if offline queueable POST, encrypt with X25519+ChaCha20-Poly1305 & try Relay Worker or save locally
  const method = (init.method || 'GET').toUpperCase();
  if (method === 'POST' && opts.allowOfflineQueue) {
    let bodyObj: Record<string, unknown> = {};
    if (typeof init.body === 'string') {
      try {
        bodyObj = JSON.parse(init.body) as Record<string, unknown>;
      } catch {
        bodyObj = {};
      }
    }
    if (!bodyObj.idempotency_key) {
      bodyObj.idempotency_key = `idem-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    }
    const envId = String(bodyObj.idempotency_key);
    const relayUrl = relayWorkerEndpoint(cfg);
    if (relayUrl && cfg.mailboxPublicKeyHex && auth?.access_token) {
      try {
        const envelope = encryptRelayEnvelope(cfg.mailboxPublicKeyHex, envId, {
          access_token: auth.access_token,
          method: 'POST',
          path,
          body: bodyObj,
        });
        const resp = await fetchWithTimeout(`${relayUrl}/inbox`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...envelope, device_id: auth.device_id }),
        });
        if (resp.ok) {
          setActiveTransportLabel('relay', relayUrl);
          return { queuedOffline: true, via: 'relay' };
        }
      } catch {
        /* fallback to device local storage outbox */
      }
    }
    const queue = loadOutbox();
    queue.push({
      id: envId,
      created_at_ms: Date.now(),
      method: 'POST',
      path,
      body: bodyObj,
      label: opts.offlineLabel || path,
    });
    persistOutbox(queue);
    setActiveTransportLabel('offline', 'local-queue');
    return { queuedOffline: true, via: 'local-outbox' };
  }

  throw new Error('ارتباط با سرور شهرک برقرار نشد؛ وضعیت اینترنت یا آدرس تونل/VPS را بررسی کنید.');
}

export async function flushOfflineOutbox(): Promise<{ sent: number; remaining: number }> {
  const queue = loadOutbox();
  if (queue.length === 0) return { sent: 0, remaining: 0 };
  const remaining: QueuedEnvelopeItem[] = [];
  let sent = 0;

  for (const item of queue) {
    try {
      const res = await remoteApiRequest(
        item.path,
        { method: 'POST', body: JSON.stringify(item.body) },
        { allowOfflineQueue: false },
      );
      if (res.data) {
        sent += 1;
      } else {
        remaining.push(item);
      }
    } catch (err) {
      // Only keep in queue if network failed; validation/permission rejection drops poison pill safely or keeps for review
      if (err instanceof Error && err.message.includes('برقرار نشد')) {
        remaining.push(item);
      }
    }
  }
  persistOutbox(remaining);
  return { sent, remaining: remaining.length };
}
