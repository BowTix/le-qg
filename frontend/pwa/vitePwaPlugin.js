const SERVICE_WORKER_SOURCE = String.raw`
const APP_CACHE = 'le-qg-app-' + VERSION;
const RUNTIME_CACHE = 'le-qg-runtime-' + VERSION;
const FONT_CACHE = 'le-qg-fonts-v1';
const CACHE_PREFIX = 'le-qg-';
const FONT_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com', 'api.fontshare.com']);

async function cacheResponse(cacheName, request, response) {
  if (!response || (!response.ok && response.type !== 'opaque')) return response;
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
  return response;
}

async function navigationResponse(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(APP_CACHE);
      await cache.put('/index.html', response.clone());
    }
    return response;
  } catch {
    return (await caches.match('/index.html')) || (await caches.match('/offline.html'));
  }
}

async function cacheFirst(request, cacheName = RUNTIME_CACHE) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  return cacheResponse(cacheName, request, response);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE)
      .then((cache) => Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && ![APP_CACHE, RUNTIME_CACHE, FONT_CACHE].includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (request.mode === 'navigate') {
    event.respondWith(navigationResponse(request));
    return;
  }

  if (FONT_HOSTS.has(url.hostname)) {
    event.respondWith(cacheFirst(request, FONT_CACHE));
    return;
  }

  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.includes('/backend/public/api/')) return;

  event.respondWith(cacheFirst(request));
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'CACHE_URLS' && Array.isArray(event.data.urls)) {
    event.waitUntil(caches.open(RUNTIME_CACHE).then((cache) => cache.addAll(event.data.urls)));
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag !== 'le-qg-offline-results') return;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => clients.forEach((client) => client.postMessage({ type: 'SYNC_OFFLINE_RESULTS' })))
  );
});
`;

export default function vitePwaPlugin() {
  return {
    name: 'le-qg-pwa',
    apply: 'build',
    generateBundle(_, bundle) {
      const version = Date.now().toString(36);
      const generatedAssets = Object.keys(bundle)
        .filter((fileName) => /\.(?:js|css|html)$/.test(fileName))
        .map((fileName) => `/${fileName}`);
      const precacheUrls = Array.from(new Set([
        '/',
        '/index.html',
        '/offline.html',
        '/manifest.webmanifest',
        '/favicon.svg',
        '/pwa-192.png',
        '/pwa-512.png',
        ...generatedAssets,
      ]));

      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: `const VERSION = ${JSON.stringify(version)};\nconst PRECACHE_URLS = ${JSON.stringify(precacheUrls)};\n${SERVICE_WORKER_SOURCE}`,
      });
    },
  };
}
