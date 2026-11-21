export interface DockAlarmToast {
  id: string;
  message: string;
  title?: string;
  tone: 'info' | 'success' | 'danger';
  onClose?: () => void;
}

type Listener = (toast: DockAlarmToast | null) => void;

let currentToast: DockAlarmToast | null = null;
let autoClearTimer: number | null = null;
const listeners = new Set<Listener>();
let hasShellHost = false;

function notifyAll(): void {
  for (const fn of listeners) {
    fn(currentToast);
  }
}

export function registerDockAlarmHost(active: boolean): void {
  hasShellHost = active;
}

export function isDockAlarmHostMounted(): boolean {
  return hasShellHost;
}

export function pushDockAlarm(toast: Omit<DockAlarmToast, 'id'> & { id?: string }): string {
  if (autoClearTimer !== null && typeof window !== 'undefined') {
    window.clearTimeout(autoClearTimer);
    autoClearTimer = null;
  }
  const id = toast.id || `dk_toast_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`;
  currentToast = {
    id,
    message: toast.message,
    title: toast.title,
    tone: toast.tone,
    onClose: toast.onClose,
  };
  notifyAll();

  if (typeof window !== 'undefined') {
    autoClearTimer = window.setTimeout(() => {
      if (currentToast?.id === id) {
        const cb = currentToast.onClose;
        currentToast = null;
        notifyAll();
        cb?.();
      }
    }, 6500);
  }
  return id;
}

export function dismissDockAlarm(id?: string): void {
  if (!currentToast) return;
  if (id && currentToast.id !== id) return;
  if (autoClearTimer !== null && typeof window !== 'undefined') {
    window.clearTimeout(autoClearTimer);
    autoClearTimer = null;
  }
  const cb = currentToast.onClose;
  currentToast = null;
  notifyAll();
  cb?.();
}

export function subscribeDockAlarm(listener: Listener): () => void {
  listeners.add(listener);
  listener(currentToast);
  return () => {
    listeners.delete(listener);
  };
}
