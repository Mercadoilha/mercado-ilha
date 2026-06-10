# SKILL — PWA & Service Worker Optimizer
## Subagente: Agent-5-PWA-SW
## Proyecto: Mercado Ilha (Next.js 14 + PWA)

---

## MISIÓN
Optimizar el Service Worker y la estrategia de caché de la PWA para que la
navegación sea instantánea en visitas repetidas. Implementar precaching de
assets, cache-first para estáticos, y stale-while-revalidate para páginas.

---

## CONTEXTO PRECARGADO

### Archivos PWA actuales
```
public/
├── manifest.json        ← PWA manifest
├── sw.js                ← service worker actual
├── icon-192.png         ← ícono PWA
├── icon-512.png         ← ícono PWA
└── apple-touch-icon.png ← iOS
```

### Service Worker actual (estrategia base)
```javascript
// sw.js actual (simplificado):
// cache-first para assets, network-first para HTML
// Sin precaching de páginas
// Sin estrategia para API calls de Supabase
```

### Manifest actual
```json
{
  "name": "Mercado Ilha",
  "short_name": "Mercado Ilha",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#185FA5",
  "background_color": "#E6F1FB",
  "icons": [...]
}
```

### RegisterSW.tsx
```typescript
// components/RegisterSW.tsx — registra el SW
'use client'
import { useEffect } from 'react'
export function RegisterSW() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
    }
  }, [])
  return null
}
```

---

## SERVICE WORKER OPTIMIZADO

### 1. `public/sw.js` — versión completa con estrategias por recurso

```javascript
// public/sw.js — Mercado Ilha Service Worker v2
const CACHE_VERSION = 'v2'
const STATIC_CACHE  = `static-${CACHE_VERSION}`
const PAGES_CACHE   = `pages-${CACHE_VERSION}`
const IMAGES_CACHE  = `images-${CACHE_VERSION}`

// Assets estáticos a precargar en install
const PRECACHE_ASSETS = [
  '/',
  '/listings',
  '/offline',           // ← página offline (crear)
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
]

// ─── Install: precachear assets críticos ───────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  )
})

// ─── Activate: limpiar caches viejos ───────────────────────────────
self.addEventListener('activate', event => {
  const valid = [STATIC_CACHE, PAGES_CACHE, IMAGES_CACHE]
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => !valid.includes(k)).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

// ─── Fetch: estrategia por tipo de recurso ─────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // 1. Supabase API calls — Network only (datos siempre frescos)
  if (url.hostname.includes('supabase.co')) {
    return event.respondWith(fetch(request))
  }

  // 2. Imágenes de Supabase Storage — Cache first, red como fallback
  if (url.hostname.includes('supabase.co') && url.pathname.includes('/storage/')) {
    return event.respondWith(
      cacheFirst(request, IMAGES_CACHE, { maxEntries: 100 })
    )
  }

  // 3. Assets estáticos (JS, CSS, fonts) — Cache first
  if (
    request.destination === 'script'
    || request.destination === 'style'
    || request.destination === 'font'
    || url.pathname.startsWith('/_next/static/')
  ) {
    return event.respondWith(
      cacheFirst(request, STATIC_CACHE, { maxEntries: 200 })
    )
  }

  // 4. Imágenes locales (íconos PWA) — Cache first
  if (request.destination === 'image') {
    return event.respondWith(
      cacheFirst(request, IMAGES_CACHE, { maxEntries: 60 })
    )
  }

  // 5. Navegación HTML — Stale-while-revalidate
  if (request.mode === 'navigate') {
    return event.respondWith(
      staleWhileRevalidate(request, PAGES_CACHE)
    )
  }

  // 6. Todo lo demás — network first con fallback a caché
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  )
})

// ─── Helpers ───────────────────────────────────────────────────────

async function cacheFirst(request, cacheName, { maxEntries = 50 } = {}) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached
  
  try {
    const response = await fetch(request)
    if (response.ok) {
      await cache.put(request, response.clone())
      await trimCache(cache, maxEntries)
    }
    return response
  } catch {
    return new Response('Offline', { status: 503 })
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  
  // Revalidar en background (no await)
  const fetchPromise = fetch(request)
    .then(response => {
      if (response.ok) cache.put(request, response.clone())
      return response
    })
    .catch(() => null)
  
  // Retornar caché inmediatamente si existe, sino esperar red
  return cached ?? fetchPromise ?? offlineFallback()
}

async function trimCache(cache, maxEntries) {
  const keys = await cache.keys()
  if (keys.length > maxEntries) {
    await Promise.all(
      keys.slice(0, keys.length - maxEntries).map(k => cache.delete(k))
    )
  }
}

function offlineFallback() {
  return caches.match('/offline') ?? new Response(
    '<h1>Sem conexão</h1><p>Verifique sua internet.</p>',
    { headers: { 'Content-Type': 'text/html' } }
  )
}

// ─── Background Sync (futuro) ───────────────────────────────────────
// Para cuando se quiera implementar "publicar en background"
```

### 2. Página offline (`app/offline/page.tsx`)

```typescript
// app/offline/page.tsx
export default function OfflinePage() {
  return (
    <main style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: '100dvh', padding: 24, textAlign: 'center',
      background: 'var(--blue-xlight)'
    }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>🏝️</div>
      <h1 style={{ color: 'var(--blue-main)', margin: '0 0 8px' }}>
        Sem conexão
      </h1>
      <p style={{ color: 'var(--color-text-secondary)', maxWidth: 280 }}>
        Parece que você está offline. Verifique sua conexão e tente novamente.
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          marginTop: 24, padding: '12px 24px',
          background: 'var(--blue-main)', color: '#fff',
          border: 'none', borderRadius: 24,
          fontSize: 15, cursor: 'pointer'
        }}>
        Tentar novamente
      </button>
    </main>
  )
}
```

### 3. Botón "Instalar app" (beforeinstallprompt)

```typescript
// components/InstallBanner.tsx
'use client'
import { useState, useEffect } from 'react'

export function InstallBanner() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)
  
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    
    // No mostrar si ya está instalada
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setDismissed(true)
    }
    
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])
  
  if (!prompt || dismissed) return null
  
  const install = async () => {
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setPrompt(null)
    setDismissed(true)
  }
  
  return (
    <div style={{
      position: 'fixed', bottom: 72, left: 16, right: 16,
      background: 'var(--blue-main)', color: '#fff',
      borderRadius: 12, padding: '12px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 4px 16px rgba(24,95,165,0.3)',
      zIndex: 100
    }}>
      <span style={{ fontSize: 24 }}>📲</span>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>
          Instalar Mercado Ilha
        </p>
        <p style={{ margin: 0, fontSize: 12, opacity: 0.85 }}>
          Acesse mais rápido pela tela inicial
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setDismissed(true)}
          style={{ background: 'rgba(255,255,255,0.2)', border: 'none',
            color: '#fff', borderRadius: 6, padding: '4px 10px',
            cursor: 'pointer', fontSize: 13 }}>
          Agora não
        </button>
        <button onClick={install}
          style={{ background: 'var(--sand)', border: 'none',
            color: '#fff', borderRadius: 6, padding: '4px 12px',
            cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          Instalar
        </button>
      </div>
    </div>
  )
}

// Declaración del tipo global (TypeScript):
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
```

### 4. Manifest completo

```json
{
  "name": "Mercado Ilha",
  "short_name": "Mercado Ilha",
  "description": "Marketplace da ilha de Tinharé — Morro de São Paulo",
  "start_url": "/?source=pwa",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "theme_color": "#185FA5",
  "background_color": "#E6F1FB",
  "categories": ["shopping", "lifestyle"],
  "lang": "pt-BR",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/apple-touch-icon.png",
      "sizes": "180x180",
      "type": "image/png"
    }
  ],
  "shortcuts": [
    {
      "name": "Publicar anúncio",
      "short_name": "Publicar",
      "description": "Criar um novo anúncio",
      "url": "/publish",
      "icons": [{ "src": "/icon-192.png", "sizes": "192x192" }]
    },
    {
      "name": "Ver anúncios",
      "short_name": "Anúncios",
      "url": "/listings",
      "icons": [{ "src": "/icon-192.png", "sizes": "192x192" }]
    }
  ]
}
```

---

## CHECKLIST DE VERIFICACIÓN

```bash
# 1. Verificar que sw.js existe y tiene las 3 estrategias
grep -c "cacheFirst\|staleWhile\|networkOnly" public/sw.js

# 2. Verificar manifest
cat public/manifest.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('OK' if d.get('display')=='standalone' else 'ERROR')"

# 3. Verificar que offline page existe
ls frontend/app/offline/page.tsx

# 4. Lighthouse PWA score
npx lighthouse http://localhost:3000 --only-categories=pwa --output=json \
  --quiet | jq '.categories.pwa.score'
```

---

## REGLAS DE OPERACIÓN

1. **Nunca cachear requests a Supabase Auth** — pueden contener tokens.
2. **Nunca cachear rutas que requieren auth** (`/publish`, `/profile`, `/admin`)
   con estrategia cache-first — siempre network-first.
3. El Service Worker nuevo solo activa en la próxima visita (skipWaiting
   cambia esto — usarlo con cuidado).
4. Reportar al Orchestrador el número de versión del SW para que el equipo
   sepa que es necesario un hard reload en pruebas.
5. Los íconos PWA actuales son placeholders ("MI" azul) — la tarea de
   reemplazarlos con el logo real SVG es del Agent-6-UI-Brand.
