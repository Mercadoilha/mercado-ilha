// Service Worker — Mercado Ilha
// v5 (Fase 4 V1): estrategias por tipo de request, caches separados con tope, offline.html.
// v6 (Fase 2 V2 · T6): la NAVEGACIÓN deja de ser network-first puro y pasa a
//   "race red-vs-timeout": si hay copia cacheada del documento, la red fresca compite
//   contra un timeout corto (NAV_TIMEOUT_MS). Si la red no llegó a tiempo, se sirve el
//   caché AL INSTANTE y la red sigue en segundo plano refrescando el caché para la
//   próxima apertura. En conexión buena gana la red (contenido fresco, sin cambios); en
//   4G lenta la app abre al toque con la última versión vista — comportamiento
//   Instagram/Mercado Livre. Con ISR de 60s en el server, tolerar unos segundos de stale
//   al abrir es parte del diseño; la apertura siguiente ya trae el contenido refrescado.
//   Además: Navigation Preload (la request parte en paralelo al boot del SW) + seed del
//   documento '/' en install/activate (la 1ª apertura standalone ya tiene algo que pintar).
// Reglas irrompibles (intactas): NUNCA interceptar Supabase (auth + datos), NUNCA cachear
//   rutas privadas (/publish, /profile, /admin) ni /api/auth; los payloads RSC siguen
//   network-first (el race aplica SOLO a documentos HTML de apertura, no a la navegación
//   client-side, para respetar el ISR de 60s). Subir CACHE_VERSION en cada cambio.
// v7 (Fase 5 V3 · T12): IMAGES_LIMIT 60 → 150. Con 60, una sola pasada por /listings (hasta
//   60 cards) podía llenar/evacuar el caché de imágenes entero, y la visita siguiente re-baja
//   todo del edge (latencia en 4G + edge requests contra el cupo). 150 cubre navegar varias
//   vistas sin desalojar (~2–5 MB extra de storage, acotado). Estrategias por tipo intactas.
// v8 (2026-07-20): bump para forzar refresh del logo. El rediseño de logo (commit 2285c3b,
//   2026-07-18) cambió logo.svg / logo-dark.svg / logo-entrada.svg pero NO subió la versión,
//   y como los assets de /public se sirven cache-first, los dispositivos que abrieron la app
//   antes seguían mostrando el logo viejo precacheado. Subir la versión borra mi-*-v7 en
//   activate y vuelve a bajar el logo nuevo. Estrategias por tipo intactas.

const CACHE_VERSION = 'v8';
const STATIC_CACHE = `mi-static-${CACHE_VERSION}`; // shell, íconos, /_next/static (inmutable)
const PAGES_CACHE = `mi-pages-${CACHE_VERSION}`;   // navegaciones HTML + payloads RSC
const IMAGES_CACHE = `mi-images-${CACHE_VERSION}`; // /_next/image + fotos R2
const DATA_CACHE = `mi-data-${CACHE_VERSION}`;     // /api/mares (única API pública de lectura)

const CURRENT_CACHES = [STATIC_CACHE, PAGES_CACHE, IMAGES_CACHE, DATA_CACHE];

// Topes por caché (LRU simple por orden de inserción) — mantiene el storage acotado.
const PAGES_LIMIT = 30;
const IMAGES_LIMIT = 150;
const DATA_LIMIT = 16;

// Cuánto espera una navegación CON caché a que la red fresca gane antes de servir el
// caché. Corto para que en 4G lenta abra al instante; suficiente para que en buena
// conexión gane la red casi siempre y se sirva contenido fresco.
const NAV_TIMEOUT_MS = 500;

// Precache del shell offline: la página offline + marca. Best-effort: si un asset falla,
// no aborta la instalación (evita que un 404 puntual deje al SW sin instalar).
const PRECACHE = [
  '/offline.html',
  '/manifest.json',
  '/logo.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const staticCache = await caches.open(STATIC_CACHE);
      await Promise.all(
        PRECACHE.map((url) => staticCache.add(url).catch(() => {/* asset opcional ausente */}))
      );
      // Seed del documento raíz en PAGES_CACHE: la PRIMERA apertura standalone tras
      // instalar el PWA ya tiene algo que pintar al instante (best-effort: si falla, la
      // navegación cae al comportamiento sin caché, que espera la red).
      const pagesCache = await caches.open(PAGES_CACHE);
      await pagesCache.add('/').catch(() => {/* sin conexión al instalar: se sembrará al 1er visit */});
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      // Navigation Preload: al abrir, la request de navegación parte en paralelo al boot
      // del SW → la red fresca llega antes y tiene más chances de ganar el race.
      if (self.registration.navigationPreload) {
        try { await self.registration.navigationPreload.enable(); } catch (err) {/* no soportado */}
      }
      // Borrar caches de versiones anteriores (v6 → v7 limpia mi-*-v6).
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !CURRENT_CACHES.includes(k)).map((k) => caches.delete(k))
      );
      // Refrescar el seed de '/' (el precacheado en install puede quedar viejo tras un
      // update del SW). Best-effort: si no hay red, queda el seed de install.
      try {
        const res = await fetch('/');
        if (res && res.ok) {
          const cache = await caches.open(PAGES_CACHE);
          await cache.put('/', res.clone());
        }
      } catch (err) {/* sin conexión: se refresca en la próxima apertura */}
      await self.clients.claim();
    })()
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

// Red para una navegación: usa el navigation preload si está disponible (request ya
// disparada en paralelo al boot del SW), sino un fetch normal. Al llegar una respuesta ok
// refresca PAGES_CACHE al vuelo (fire-and-forget, mismo patrón que staleWhileRevalidate).
// Devuelve la Response de red (o rechaza si la red falla).
function fetchNavigation(request, event) {
  return Promise.resolve(event.preloadResponse)
    .then((preload) => preload || fetch(request))
    .then((res) => {
      if (res && res.ok) {
        caches.open(PAGES_CACHE).then((cache) =>
          cache.put(request, res.clone()).then(() => trimCache(PAGES_CACHE, PAGES_LIMIT))
        );
      }
      return res;
    });
}

// Navegación HTML (apertura de documento / refresh / deep link).
//  - Rutas privadas: SIEMPRE red, NUNCA caché (regla irrompible). Fallback offline.
//  - Sin caché del documento: se espera la red; si falla → offline.
//  - Con caché: la red fresca compite contra un timeout corto. Si la red no llegó a
//    tiempo (o falló), se sirve el caché al instante y la red sigue refrescándolo.
async function handleNavigation(request, isPrivate, event) {
  if (isPrivate) {
    try {
      const preload = await event.preloadResponse;
      return preload || (await fetch(request));
    } catch (err) {
      const offline = await caches.match('/offline.html');
      if (offline) return offline;
      throw err;
    }
  }

  const pagesCache = await caches.open(PAGES_CACHE);
  const cached = await pagesCache.match(request);
  const network = fetchNavigation(request, event);

  // Sin caché: comportamiento clásico — esperar la red; si falla, página offline.
  if (!cached) {
    try {
      const res = await network;
      event.waitUntil(network.catch(() => {})); // dejar terminar la escritura del caché
      return res;
    } catch (err) {
      const offline = await caches.match('/offline.html');
      if (offline) return offline;
      throw err;
    }
  }

  // Con caché: race red-vs-timeout. `outcome` NUNCA rechaza (así no quedan rechazos
  // flotando cuando gana el timeout): { res } si la red trajo algo ok, {} si falló/no-ok.
  const outcome = network.then(
    (res) => (res && res.ok ? { res } : {}),
    () => ({})
  );
  let timeoutId;
  const timeout = new Promise((resolve) => {
    timeoutId = setTimeout(() => resolve('timeout'), NAV_TIMEOUT_MS);
  });

  const winner = await Promise.race([outcome, timeout]);
  clearTimeout(timeoutId);
  // Sea quien sea el ganador, la red sigue viva para refrescar el caché de la próxima vez.
  event.waitUntil(outcome);

  if (winner === 'timeout') return cached; // red lenta → caché al instante
  if (winner.res) return winner.res;        // red fresca ganó → contenido fresco
  return cached;                            // red falló/no-ok antes del timeout → caché
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
