/*
 * JalSafa service worker — practical offline support for the prototype:
 *  • App shell + its hashed JS/CSS → cached on install (offline reload works,
 *    even for a first-time visitor)
 *  • /api/* GET → network-first, saved copy used when the network fails
 *  • OSM tiles  → cache-first (map stays visible offline where already visited)
 *  • Static JS/CSS/fonts → cache-first (hashed filenames, safe to cache)
 */
const VERSION = 'jalsafa-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const DATA_CACHE = `${VERSION}-data`;
const TILE_CACHE = `${VERSION}-tiles`;
const ASSET_CACHE = `${VERSION}-assets`;
const MAX_TILES = 400;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        cache
          .addAll(['/', '/index.html'])
          // Also precache the hashed JS/CSS index.html references. On a first
          // visit those files are fetched BEFORE this worker controls the page,
          // so they would never enter the cache otherwise — and an offline
          // reload would return the shell HTML with no scripts (blank page).
          .then(() => cache.match('/index.html'))
          .then((res) => (res ? res.text() : ''))
          .then((html) => {
            const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
            return assets.length
              ? caches.open(ASSET_CACHE).then((c) => c.addAll(assets))
              : undefined;
          }),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request, cacheName, fallback) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (fallback) {
      const shell = await caches.match(fallback);
      if (shell) return shell;
    }
    return new Response(JSON.stringify({ error: 'offline', offline: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    cache.put(request, response.clone());
    if (cacheName === TILE_CACHE) {
      const keys = await cache.keys();
      if (keys.length > MAX_TILES) await cache.delete(keys[0]);
    }
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // API: network first, cached copy as fallback (facility browsing works offline)
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  // Map tiles: cache first so the map renders offline
  if (url.hostname.endsWith('tile.openstreetmap.org')) {
    event.respondWith(
      cacheFirst(request, TILE_CACHE).catch(
        () =>
          new Response('', { status: 503 }), // tile missing offline → blank area, list still works
      ),
    );
    return;
  }

  // App shell navigations: network first so updates arrive, cache as offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL_CACHE, '/index.html'));
    return;
  }

  // Hashed build assets: cache first
  if (url.origin === self.location.origin) {
    event.respondWith(
      cacheFirst(request, ASSET_CACHE).catch(async () => {
        const cached = await caches.match(request);
        return cached ?? new Response('', { status: 504 });
      }),
    );
  }
});
