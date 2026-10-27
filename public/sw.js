// Bürolist Service Worker
// Conservative caching strategy for Render Free Tier compatibility - ported
// from FleetTrack's sw.js, inkl. Push fuer die taegliche Erfassungserinnerung.

// Version hochzaehlen, wenn sich gecachte statische Dateien (Logos, Icons)
// aendern - beim Aktivieren werden die alten Caches geloescht. Icon-Dateinamen
// zusaetzlich versionieren (-v2), damit Browser/OS das neue App-Icon erkennen.
const CACHE_NAME = 'buerolist-v2';
const STATIC_CACHE_NAME = 'buerolist-static-v2';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/offline.html',
  '/icon-192x192-v2.png',
  '/icon-512x512-v2.png',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // NEVER cache API calls (important for Render Free Tier)
  if (url.pathname.startsWith('/api/') || url.hostname.includes('onrender.com')) {
    return event.respondWith(fetch(request));
  }

  // Cache-first for static assets
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font' ||
    request.destination === 'image' ||
    url.pathname.match(/\.(js|css|woff2?|png|jpg|jpeg|svg|gif|webp|ico)$/i)
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Network-first for HTML pages
  event.respondWith(
    fetch(request)
      .then((response) => {
        return response;
      })
      .catch(() => {
        // Offline fallback
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Show offline page if nothing cached
          if (request.mode === 'navigate') {
            return caches.match('/offline.html');
          }
        });
      })
  );
});

// Erinnerung anzeigen - gemeinsam fuer echte Pushes und die Test-Benachrichtigung
function showReminder(data) {
  const title = data.title || 'Bürolist';
  const options = {
    body: data.body || '',
    icon: '/icon-192x192-v2.png',
    // Android zeigt in der Statusleiste nur den Alphakanal des Badges (weiss
    // eingefaerbt) - deshalb eine transparente Logo-Silhouette statt des
    // vollflaechigen App-Icons (das sonst als Glocke/Quadrat erscheint).
    badge: '/notification-badge.png',
    data: { url: data.url || '/' },
  };
  return self.registration.showNotification(title, options);
}

// Push-Nachricht (Erfassungserinnerung) anzeigen
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(showReminder(data));
});

// Test-Benachrichtigung aus den Einstellungen (Einstellungen -> Erinnerung).
// Antwortet nur ein aktueller Service Worker - bleibt die Antwort aus, laeuft
// auf dem Geraet noch eine alte Version.
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'TEST_NOTIFICATION') return;
  event.waitUntil(
    showReminder(event.data.payload || {}).then(
      () => event.ports[0]?.postMessage({ ok: true }),
      (error) => event.ports[0]?.postMessage({ ok: false, error: String(error) })
    )
  );
});

// Notification-Klick - vorhandenes Fenster fokussieren statt ein neues zu oeffnen
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
