# SKILL — Navigation & Routing Optimizer
## Subagente: Agent-3-Nav-Router
## Proyecto: Mercado Ilha (Next.js 14 App Router)

---

## MISIÓN
Optimizar la velocidad de navegación entre rutas. Implementar prefetching,
link optimizados, transiciones suaves, y eliminar los re-renders del layout
que causan la sensación de "pantalla en blanco" al navegar.

---

## CONTEXTO PRECARGADO

### Rutas implementadas
```
/                   → home (Server Component pesado)
/listings           → listados (Server Component + filtros client)
/listings/[id]      → detalle (Server Component)
/publish            → formulario (Client Component pesado)
/profile            → perfil (Client Component)
/signin             → login/registro (Client Component)
/store/[id]         → tienda pública (Server Component)
/admin              → panel admin (Client Component muy pesado)
```

### Layout raíz (`app/layout.tsx`)
```typescript
// Layout actual:
export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <BottomNav />      ← se re-renderiza en cada navegación
        <RegisterSW />     ← registra service worker
      </body>
    </html>
  )
}
```

### Bottom Nav (5 items)
```
Início | Anúncios | ➕(arena) | 🍽️ Comida | Perfil/Entrar
```

---

## OPTIMIZACIONES DE NAVEGACIÓN

### 1. Reemplazar `<a href>` por `<Link>` de Next.js

Buscar y reemplazar TODOS los enlaces internos:
```typescript
// MAL — causa full page reload:
<a href="/listings">Ver anúncios</a>
<a href={`/listings/${id}`}>Ver</a>

// BIEN — navegación SPA:
import Link from 'next/link'
<Link href="/listings">Ver anúncios</Link>
<Link href={`/listings/${id}`}>Ver</Link>
```

Comando para encontrar href internos sin Link:
```bash
grep -r 'href="/' frontend/app frontend/components --include="*.tsx" | grep -v "next/link"
grep -r "href={`/" frontend/app frontend/components --include="*.tsx" | grep -v "Link"
```

### 2. Prefetching inteligente

Next.js App Router prefetchea `<Link>` en viewport por defecto. Pero hay
situaciones donde conviene prefetch explícito:

```typescript
// En BottomNav — los destinos del nav se prefetchean al cargar:
import Link from 'next/link'
// El <Link prefetch={true}> (default) ya hace prefetch al entrar en viewport
// Para la home, listings y comida — ya está cubierto por Link default

// Para el botón de publicar (ruta /publish):
// Prefetch solo cuando el usuario está autenticado
'use client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

function PublishButton({ isAuth }: { isAuth: boolean }) {
  const router = useRouter()
  
  useEffect(() => {
    if (isAuth) router.prefetch('/publish')
  }, [isAuth, router])
  
  return (
    <button onClick={() => router.push(isAuth ? '/publish' : '/signin')}>
      +
    </button>
  )
}
```

### 3. Streaming con Suspense (eliminar pantalla en blanco)

Patrón para rutas con datos lentos:
```typescript
// app/listings/page.tsx
import { Suspense } from 'react'
import { ListingsSkeleton } from '@/components/ListingsSkeleton'

export default function ListingsPage({ searchParams }) {
  return (
    <main>
      <SearchBar /> {/* Client Component ligero, se muestra de inmediato */}
      <Suspense fallback={<ListingsSkeleton />}>
        <ListingsContent searchParams={searchParams} />
      </Suspense>
    </main>
  )
}

// Componente separado para los datos (permite streaming):
async function ListingsContent({ searchParams }) {
  const listings = await getListings(searchParams) // query Supabase
  return <ListingList listings={listings} />
}
```

### 4. Skeletons que evitan layout shift

```typescript
// components/ListingsSkeleton.tsx
export function ListingsSkeleton() {
  return (
    <div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} style={{
          display: 'flex', gap: 12, padding: '12px 16px',
          borderBottom: '1px solid var(--color-border-tertiary)',
          animation: 'pulse 1.5s ease-in-out infinite'
        }}>
          {/* Miniatura */}
          <div style={{ width: 80, height: 80, borderRadius: 8,
            background: 'var(--color-background-secondary)', flexShrink: 0 }} />
          {/* Texto */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ height: 16, width: '70%', borderRadius: 4,
              background: 'var(--color-background-secondary)' }} />
            <div style={{ height: 14, width: '40%', borderRadius: 4,
              background: 'var(--color-background-secondary)' }} />
            <div style={{ height: 12, width: '55%', borderRadius: 4,
              background: 'var(--color-background-secondary)' }} />
          </div>
        </div>
      ))}
    </div>
  )
}
```

Animación en globals.css:
```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
```

### 5. BottomNav — active state sin re-render total

```typescript
'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

export function BottomNav() {
  const pathname = usePathname()
  
  const isActive = (href: string) => 
    href === '/' ? pathname === '/' : pathname.startsWith(href)
  
  return (
    <nav style={{ /* estilos */ }}>
      <Link href="/" style={{ color: isActive('/') ? 'var(--blue-main)' : 'inherit' }}>
        Início
      </Link>
      <Link href="/listings" style={{ color: isActive('/listings') ? 'var(--blue-main)' : 'inherit' }}>
        Anúncios
      </Link>
      {/* ... */}
    </nav>
  )
}
```

### 6. Loading UI por segmento (Next.js App Router)

Crear `loading.tsx` en cada carpeta de ruta:
```typescript
// app/listings/loading.tsx
import { ListingsSkeleton } from '@/components/ListingsSkeleton'

export default function Loading() {
  return (
    <div>
      <div style={{ height: 56 }} /> {/* espacio para el header */}
      <ListingsSkeleton />
    </div>
  )
}

// app/listings/[id]/loading.tsx
export default function Loading() {
  return (
    <div style={{ padding: 16 }}>
      <div style={{ height: 300, background: 'var(--color-background-secondary)',
        borderRadius: 12, marginBottom: 16,
        animation: 'pulse 1.5s ease-in-out infinite' }} />
      <div style={{ height: 24, width: '60%', background: 'var(--color-background-secondary)',
        borderRadius: 6, marginBottom: 12,
        animation: 'pulse 1.5s ease-in-out infinite' }} />
    </div>
  )
}
```

### 7. Scroll restoration

En `app/layout.tsx`:
```typescript
// Asegurar que Next.js restaura el scroll al navegar atrás
// Esto es automático en App Router, pero verificar que no hay
// overflow: hidden en el body que lo bloquee

// En globals.css, verificar:
html { scroll-behavior: smooth; }
body { overflow-x: hidden; /* NO overflow-y: hidden */ }
```

### 8. Route Groups para layouts anidados

Si el header se repite en varias rutas (listings, store), moverlo a un
layout compartido sin re-montarlo:
```
app/
├── (main)/           ← route group (no afecta URL)
│   ├── layout.tsx    ← Header + BottomNav compartido
│   ├── page.tsx      ← home /
│   ├── listings/     ← /listings
│   └── store/        ← /store/[id]
└── (auth)/
    ├── signin/       ← /signin
    └── ...
```

---

## CHECKLIST DE VERIFICACIÓN

Después de aplicar cada optimización, verificar:

```bash
# 1. Que no hay <a href> internos sin Link
grep -rn 'href="/' frontend/app --include="*.tsx" | grep -v "Link\|link\|//\|localhost\|http"

# 2. Que todos los loading.tsx existen
ls frontend/app/listings/loading.tsx
ls frontend/app/listings/\[id\]/loading.tsx

# 3. Que BottomNav no tiene useEffect con deps faltantes
grep -A5 "useEffect" frontend/components/BottomNav.tsx

# 4. Build sin errores
cd frontend && npm run build
```

---

## ARCHIVOS A CREAR/MODIFICAR

| Archivo | Acción | Prioridad |
|---------|--------|-----------|
| `app/listings/loading.tsx` | CREAR | Alta |
| `app/listings/[id]/loading.tsx` | CREAR | Alta |
| `app/publish/loading.tsx` | CREAR | Media |
| `app/store/[id]/loading.tsx` | CREAR | Media |
| `components/ListingsSkeleton.tsx` | CREAR | Alta |
| `components/BottomNav.tsx` | MODIFICAR | Alta |
| `app/globals.css` | MODIFICAR (añadir pulse) | Alta |
| `app/listings/page.tsx` | MODIFICAR (Suspense) | Media |

---

## REGLAS DE OPERACIÓN

1. Siempre usar `<Link>` de `next/link` para navegación interna.
2. No usar `window.location.href` para navegación interna.
3. Los skeletons deben tener exactamente el mismo layout que el contenido
   real para evitar layout shift.
4. Los `loading.tsx` son automáticos en App Router — solo crearlos.
5. No usar `router.push()` donde `<Link>` es suficiente.
6. Reportar al Orchestrador si encuentra rutas que usan `router.push` 
   innecesariamente.
