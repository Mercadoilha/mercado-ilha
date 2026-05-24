const CACHE = 'mercado-ilha-v1';
const PRECACHE = ['/', '/listings', '/signin', '/manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Solo manejamos GET
  if (e.request.method !== 'GET') return;

  // Peticiones a Supabase siempre van a la red
  if (e.request.url.includes('supabase.co')) return;

  e.respondWith(
    caches.match(e.request).then((cached) => {
      const network = fetch(e.request).then((res) => {
        if (res.ok && res.type !== 'opaque') {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      });
      // Cache-first para assets, network-first para páginas HTML
      return cached && !e.request.headers.get('accept')?.includes('text/html')
        ? cached
        : network.catch(() => cached);
    })
  );
});
