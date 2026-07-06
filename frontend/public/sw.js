// Service Worker — Mercado Ilha
// Reescrito en la Fase 4 del plano de otimização (T12 + T13).
// Estrategias explícitas por tipo de request, caches separados con tope, y página offline.
// Reglas irrompibles: NUNCA interceptar Supabase (auth + datos), NUNCA cachear rutas
// privadas (/publish, /profile, /admin) ni /api/auth. Subir CACHE_VERSION en cada cambio.

const CACHE_VERSION = 'v5';
const STATIC_CACHE = `mi-static-${CACHE_VERSION}`; // shell, íconos, /_next/static (inmutable)
const PAGES_CACHE = `mi-pages-${CACHE_VERSION}`;   // navegaciones HTML + payloads RSC
const IMAGES_CACHE = `mi-images-${CACHE_VERSION}`; // /_next/image + fotos R2
const DATA_CACHE = `mi-data-${CACHE_VERSION}`;     // /api/mares (única API pública de lectura)

const CURRENT_CACHES = [STATIC_CACHE, PAGES_CACHE, IMAGES_CACHE, DATA_CACHE];

// Topes por caché (LRU simple por orden de inserción) — mantiene el storage acotado.
const PAGES_LIMIT = 30;
const IMAGES_LIMIT = 60;
const DATA_LIMIT = 16;

// Precache del shell offline: la página offline + marca. Best-effort: si un asset falla,
// no aborta la instalación (evita que un 404 puntual deje al SW sin instalar).
const PRECACHE = [
  '/offline.html',
  '/manifest.json',
  '/logo.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      await Promise.all(
        PRECACHE.map((url) => cache.add(url).catch(() => {/* asset opcional ausente */}))
      );
      await self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => !CURRENT_CACHES.includes(k)).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// --- helpers ---

// Recorta un caché a su tope borrando las entradas más viejas (keys() respeta el orden
// de inserción, así que las primeras son las más antiguas).
async function trimCache(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= limit) return;
  for (let i = 0; i < keys.length - limit; i++) {
    await cache.delete(keys[i]);
  }
}

function isRSC(request, url) {
  return url.searchParams.has('_rsc') || request.headers.get('RSC') === '1';
}

function isPrivatePath(path) {
  return (
    path === '/publish' ||
    path.startsWith('/publish/') ||
    path === '/profile' ||
    path.startsWith('/profile/') ||
    path === '/admin' ||
    path.startsWith('/admin/')
  );
}

// Cache-first: para assets inmutables con hash (/_next/static) y assets del shell.
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res && res.ok) cache.put(request, res.clone());
  return res;
}

// Stale-while-revalidate con tope: para imágenes. Devuelve el caché al instante y
// revalida en segundo plano; si no hay caché, espera la red.
function staleWhileRevalidate(request, cacheName, limit, event) {
  return caches.open(cacheName).then((cache) =>
    cache.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque')) {
            cache.put(request, res.clone()).then(() => trimCache(cacheName, limit));
          }
          return res;
        })
        .catch(() => null);
      if (cached) {
        event.waitUntil(network);
        return cached;
      }
      return network.then((res) => res || cached);
    })
  );
}

// Network-first con tope: para /api/mares y RSC. Red fresca cuando hay conexión; el caché
// solo es fallback offline. Corrige mareas y payloads RSC congelados del SW anterior.
async function networkFirst(request, cacheName, limit, event) {
  try {
    const res = await fetch(request);
    if (res && res.ok) {
      const clone = res.clone();
      event.waitUntil(
        caches.open(cacheName).then((cache) =>
          cache.put(request, clone).then(() => trimCache(cacheName, limit))
        )
      );
    }
    return res;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw err;
  }
}

// Navegación HTML: network-first con fallback a la página cacheada y, en última instancia,
// a la página offline de marca.
async function handleNavigation(request, isPrivate, event) {
  try {
    const res = await fetch(request);
    if (res && res.ok && !isPrivate) {
      const clone = res.clone();
      event.waitUntil(
        caches.open(PAGES_CACHE).then((cache) =>
          cache.put(request, clone).then(() => trimCache(PAGES_CACHE, PAGES_LIMIT))
        )
      );
    }
    return res;
  } catch (err) {
    // Rutas privadas nunca se sirven desde caché: solo offline.
    if (!isPrivate) {
      const cached = await caches.match(request);
      if (cached) return cached;
    }
    const offline = await caches.match('/offline.html');
    if (offline) return offline;
    throw err;
  }
}

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return; // mutaciones (POST/PUT/…) van directo a la red

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Cross-origin
  if (url.origin !== self.location.origin) {
    if (url.hostname.endsWith('supabase.co')) return; // auth + datos: nunca interceptar
    if (url.hostname.endsWith('r2.dev')) {
      e.respondWith(staleWhileRevalidate(request, IMAGES_CACHE, IMAGES_LIMIT, e));
    }
    return; // otros orígenes: dejar pasar
  }

  const path = url.pathname;

  // Payloads RSC de navegación client-side → network-first (nunca cache-first): así el ISR
  // de 60s es efectivo dentro del PWA y no se muestran anuncios viejos.
  if (isRSC(request, url)) {
    e.respondWith(networkFirst(request, PAGES_CACHE, PAGES_LIMIT, e));
    return;
  }

  // Assets inmutables con hash → cache-first.
  if (path.startsWith('/_next/static/')) {
    e.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Imágenes optimizadas por Next → SWR con tope.
  if (path.startsWith('/_next/image')) {
    e.respondWith(staleWhileRevalidate(request, IMAGES_CACHE, IMAGES_LIMIT, e));
    return;
  }

  // APIs: solo /api/mares (GET público de lectura) recibe network-first para soporte
  // offline; el resto (auth, upload, revalidate, admin, cron, delete-file) no se intercepta.
  if (path.startsWith('/api/')) {
    if (path.startsWith('/api/mares')) {
      e.respondWith(networkFirst(request, DATA_CACHE, DATA_LIMIT, e));
    }
    return;
  }

  // Navegaciones HTML (carga de documento / refresh / deep link).
  if (request.mode === 'navigate') {
    e.respondWith(handleNavigation(request, isPrivatePath(path), e));
    return;
  }

  // Resto de assets same-origin del /public (svg, png sueltos, fuentes) → cache-first.
  e.respondWith(cacheFirst(request, STATIC_CACHE));
});
