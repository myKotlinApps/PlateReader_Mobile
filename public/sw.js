/* Mobile PWA Service Worker — caches ONLY static app shell assets, NEVER authenticated API data. */
const SHELL_CACHE = 'alpr-mobile-shell-v1';
const STATIC_ASSETS = [
  '/manifest.webmanifest',
  '/favicon.svg',
  '/fonts/Vazirmatn-Regular.woff2',
  '/fonts/Vazirmatn-Medium.woff2',
  '/fonts/Vazirmatn-Bold.woff2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API endpoints, SSE streams, or live camera snapshots
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/internal/') ||
    url.pathname === '/health' ||
    url.pathname.endsWith('.mjpg')
  ) {
    return;
  }

  // Navigation to /m/* or / uses network-first with shell fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/index.html').then((r) => r || Response.error())),
    );
    return;
  }

  // Static hashed assets & fonts use cache-first
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname === '/favicon.svg' ||
    url.pathname === '/manifest.webmanifest'
  ) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((net) => {
            if (net && net.ok) {
              const clone = net.clone();
              caches.open(SHELL_CACHE).then((c) => c.put(req, clone)).catch(() => undefined);
            }
            return net;
          }),
      ),
    );
  }
});

self.addEventListener('push', (event) => {
  let title = 'اعلان سامانه شهرک';
  let body = 'پیام یا وضعیت جدید در کارتابل شما ثبت شد.';
  let url = '/m/notifications';
  try {
    const data = event.data ? event.data.json() : null;
    if (data && typeof data.title === 'string') title = data.title;
    if (data && typeof data.body === 'string') body = data.body;
    if (data && typeof data.url === 'string') url = data.url;
  } catch {
    /* ignore malformed push payload; show generic prompt */
  }
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      dir: 'rtl',
      lang: 'fa',
      icon: '/images/logo-abbr.png',
      data: { url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/m/notifications';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(target).catch(() => undefined);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
