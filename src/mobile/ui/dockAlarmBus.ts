export interface DockAlarmToast {
  id: string;
  message: string;
  title?: string;
  tone: 'info' | 'success' | 'danger';
  createdAtMs: number;
  durationMs: number;
  onAction?: () => void;
  onClose?: () => void;
}

type MultiListener = (toasts: DockAlarmToast[]) => void;
type LegacyListener = (toast: DockAlarmToast | null) => void;

export const DEFAULT_ALARM_DURATION_MS = 5000;
const MAX_VISIBLE_ALARMS = 4;

let toasts: DockAlarmToast[] = [];
const timers = new Map<string, number>();
const multiListeners = new Set<MultiListener>();
const legacyListeners = new Set<LegacyListener>();
let hasShellHost = false;

function notifyAll(): void {
  const snapshot = [...toasts];
  for (const fn of multiListeners) {
    fn(snapshot);
  }
  const top = snapshot[0] ?? null;
  for (const fn of legacyListeners) {
    fn(top);
  }
}

function clearTimer(id: string): void {
  const handle = timers.get(id);
  if (handle !== undefined && typeof window !== 'undefined') {
    window.clearTimeout(handle);
  }
  timers.delete(id);
}

export function registerDockAlarmHost(active: boolean): void {
  hasShellHost = active;
}

export function isDockAlarmHostMounted(): boolean {
  return hasShellHost;
}

/**
 * Pushes a new floating alarm pill to the TOP of the alarm stack (above previous alarms).
 * Every alarm maintains its own independent 5-second (5000ms) auto-dismiss timer.
 */
export function pushDockAlarm(
  toast: Omit<DockAlarmToast, 'id' | 'createdAtMs' | 'durationMs'> & {
    id?: string;
    durationMs?: number;
  },
): string {
  const id = toast.id || `dk_toast_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`;
  const durationMs =
    typeof toast.durationMs === 'number' && toast.durationMs > 0
      ? toast.durationMs
      : DEFAULT_ALARM_DURATION_MS;

  clearTimer(id);

  const entry: DockAlarmToast = {
    id,
    message: toast.message,
    title: toast.title,
    tone: toast.tone,
    createdAtMs: Date.now(),
    durationMs,
    onAction: toast.onAction,
    onClose: toast.onClose,
  };

  // Newest alarm goes at index 0 -> renders ABOVE older alarms in the vertical stack
  const filtered = toasts.filter((t) => t.id !== id);
  const dropped = filtered.slice(MAX_VISIBLE_ALARMS - 1);
  for (const old of dropped) {
    clearTimer(old.id);
  }
  toasts = [entry, ...filtered.slice(0, MAX_VISIBLE_ALARMS - 1)];
  notifyAll();

  if (typeof window !== 'undefined') {
    const handle = window.setTimeout(() => {
      dismissDockAlarm(id);
    }, durationMs);
    timers.set(id, handle);
  }

  return id;
}

export function dismissDockAlarm(id?: string): void {
  if (toasts.length === 0) return;

  if (!id) {
    const all = [...toasts];
    toasts = [];
    for (const item of all) {
      clearTimer(item.id);
    }
    notifyAll();
    for (const item of all) {
      item.onClose?.();
    }
    return;
  }

  const target = toasts.find((t) => t.id === id);
  if (!target) return;
  clearTimer(id);
  toasts = toasts.filter((t) => t.id !== id);
  notifyAll();
  target.onClose?.();
}

export function subscribeDockAlarms(listener: MultiListener): () => void {
  multiListeners.add(listener);
  listener([...toasts]);
  return () => {
    multiListeners.delete(listener);
  };
}

export function subscribeDockAlarm(listener: LegacyListener): () => void {
  legacyListeners.add(listener);
  listener(toasts[0] ?? null);
  return () => {
    legacyListeners.delete(listener);
  };
}
