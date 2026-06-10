# SKILL — Component & Rendering Optimizer
## Subagente: Agent-4-Component-Renderer
## Proyecto: Mercado Ilha (Next.js 14 + TypeScript)

---

## MISIÓN
Optimizar los componentes React: reducir re-renders innecesarios, separar
correctamente Server Components de Client Components, implementar memoización
donde sea necesario, y optimizar la galería de fotos y las imágenes.

---

## CONTEXTO PRECARGADO

### Componentes existentes
```
components/
├── BottomNav.tsx      ← 'use client' — sesión + pathname
├── BannerRotativo.tsx ← 'use client' — setInterval rotación
├── ListingCard.tsx    ← ¿'use client'? — card horizontal con favorito
└── RegisterSW.tsx     ← 'use client' — registra SW
```

### Paleta CSS (variables en globals.css)
```css
--blue-main:   #185FA5
--blue-mid:    #1a6fbd
--blue-light:  #B5D4F4
--blue-xlight: #E6F1FB
--sand:        #EF9F27
--sand-light:  #FAC775
--green-sea:   #9FE1CB
--green-dark:  #0F6E56
```

### Layout de ListingCard
```
[foto 80x80px] | [título] [precio] [descripción] [❤ favorito]
```

---

## OPTIMIZACIONES DE COMPONENTES

### 1. ListingCard — Server Component con favorito client

El card es estático salvo el botón de favorito. Separar:
```typescript
// components/ListingCard.tsx — Server Component base
import Image from 'next/image'
import Link from 'next/link'
import { FavoriteButton } from './FavoriteButton'

interface Listing {
  id: string
  title: string
  price: number | null
  condition: 'novo' | 'usado' | null
  status: string
  created_at: string
  listing_photos: { url: string; order_num: number }[]
  subzone?: { name: string }
  category?: { name: string }
}

export function ListingCard({ listing }: { listing: Listing }) {
  const photo = listing.listing_photos
    .sort((a, b) => a.order_num - b.order_num)[0]
  
  return (
    <Link href={`/listings/${listing.id}`} style={{
      display: 'flex', gap: 12,
      padding: '12px 16px',
      borderBottom: '1px solid var(--color-border-tertiary)',
      textDecoration: 'none', color: 'inherit',
      background: 'var(--color-background-primary)',
    }}>
      {/* Foto optimizada */}
      <div style={{ width: 80, height: 80, flexShrink: 0,
        borderRadius: 8, overflow: 'hidden', background: 'var(--color-background-secondary)' }}>
        {photo ? (
          <Image
            src={photo.url}
            alt={listing.title}
            width={80}
            height={80}
            style={{ objectFit: 'cover', width: '100%', height: '100%' }}
            loading="lazy"
          />
        ) : (
          <div style={{ width: 80, height: 80, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 24, color: 'var(--color-text-tertiary)' }}>
            📷
          </div>
        )}
      </div>
      
      {/* Info */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex',
        flexDirection: 'column', justifyContent: 'space-between' }}>
        <p style={{ margin: 0, fontWeight: 500, fontSize: 14,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          color: 'var(--color-text-primary)' }}>
          {listing.title}
        </p>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 700,
          color: 'var(--blue-main)' }}>
          {listing.price
            ? `R$ ${listing.price.toLocaleString('pt-BR')}`
            : 'A combinar'}
        </p>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {listing.condition && (
            <span style={{
              fontSize: 11, padding: '2px 6px', borderRadius: 4,
              background: listing.condition === 'novo'
                ? 'var(--green-sea)' : 'var(--color-background-secondary)',
              color: listing.condition === 'novo'
                ? 'var(--green-dark)' : 'var(--color-text-secondary)',
              fontWeight: 500
            }}>
              {listing.condition === 'novo' ? 'Novo' : 'Usado'}
            </span>
          )}
          {listing.subzone && (
            <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
              📍 {listing.subzone.name}
            </span>
          )}
        </div>
      </div>
      
      {/* Favorito — Client Component aislado */}
      <FavoriteButton listingId={listing.id} />
    </Link>
  )
}
```

### 2. FavoriteButton — Client Component aislado

```typescript
// components/FavoriteButton.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'

export function FavoriteButton({ listingId }: { listingId: string }) {
  const [isFav, setIsFav] = useState(false)
  
  useEffect(() => {
    const favs = JSON.parse(localStorage.getItem('favorites') ?? '[]')
    setIsFav(favs.includes(listingId))
  }, [listingId])
  
  const toggle = useCallback((e: React.MouseEvent) => {
    e.preventDefault() // evitar que el Link del padre navegue
    e.stopPropagation()
    
    setIsFav(prev => {
      const favs: string[] = JSON.parse(localStorage.getItem('favorites') ?? '[]')
      const next = prev
        ? favs.filter(id => id !== listingId)
        : [...favs, listingId]
      localStorage.setItem('favorites', JSON.stringify(next))
      return !prev
    })
  }, [listingId])
  
  return (
    <button
      onClick={toggle}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        padding: 4, alignSelf: 'flex-start', flexShrink: 0,
        fontSize: 18, lineHeight: 1
      }}
      aria-label={isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
    >
      {isFav ? '❤️' : '🤍'}
    </button>
  )
}
```

### 3. BannerRotativo — optimizar re-renders

```typescript
// components/BannerRotativo.tsx
'use client'
import { useState, useEffect, useCallback, memo } from 'react'
import Image from 'next/image'

interface Banner {
  id: string
  image_url: string
  link_url: string | null
  position: string
}

// memo evita re-render cuando el padre re-renderiza
export const BannerRotativo = memo(function BannerRotativo({
  banners
}: {
  banners: Banner[]
}) {
  const [current, setCurrent] = useState(0)
  
  useEffect(() => {
    if (banners.length <= 1) return
    const id = setInterval(() => {
      setCurrent(c => (c + 1) % banners.length)
    }, 4000)
    return () => clearInterval(id)
  }, [banners.length]) // ← solo banners.length, no el array completo
  
  const goTo = useCallback((i: number) => setCurrent(i), [])
  
  if (banners.length === 0) {
    return <BannerPlaceholder />
  }
  
  const banner = banners[current]
  
  return (
    <div style={{ position: 'relative', width: '100%',
      aspectRatio: '16/5', overflow: 'hidden', borderRadius: 12 }}>
      {banner.link_url ? (
        <a href={banner.link_url} target="_blank" rel="noopener noreferrer"
          style={{ display: 'block', width: '100%', height: '100%' }}>
          <Image
            src={banner.image_url}
            alt="Publicidade"
            fill
            style={{ objectFit: 'cover' }}
            priority={current === 0} // LCP hint para el primer banner
          />
        </a>
      ) : (
        <Image src={banner.image_url} alt="Publicidade" fill
          style={{ objectFit: 'cover' }}
          priority={current === 0} />
      )}
      
      {/* Dots de navegación */}
      {banners.length > 1 && (
        <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0,
          display: 'flex', justifyContent: 'center', gap: 6 }}>
          {banners.map((_, i) => (
            <button key={i} onClick={() => goTo(i)}
              style={{
                width: i === current ? 20 : 8,
                height: 8, borderRadius: 4,
                background: i === current ? '#fff' : 'rgba(255,255,255,0.5)',
                border: 'none', cursor: 'pointer', padding: 0,
                transition: 'width 0.3s ease'
              }}
              aria-label={`Banner ${i + 1}`}
            />
          ))}
        </div>
      )}
      
      {/* Etiqueta publicidade */}
      <span style={{ position: 'absolute', top: 8, right: 8,
        fontSize: 10, background: 'rgba(0,0,0,0.45)', color: '#fff',
        padding: '2px 6px', borderRadius: 4 }}>
        Publicidade
      </span>
    </div>
  )
})

function BannerPlaceholder() {
  return (
    <div style={{ /* ... */ }}>
      <p>Seu negócio aqui!</p>
    </div>
  )
}
```

### 4. Imágenes con `next/image` y remotePatterns

**`next.config.js`** (verificar y completar):
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
    // Tamaños que se pre-generan (optimiza LCP):
    deviceSizes: [390, 480, 640, 750, 828],
    imageSizes: [80, 160, 256],
    formats: ['image/webp'],
  },
}

module.exports = nextConfig
```

### 5. Galería de fotos en detalle — lazy load

```typescript
// En app/listings/[id]/page.tsx — galería optimizada
function PhotoGallery({ photos }: { photos: { url: string; order_num: number }[] }) {
  const sorted = [...photos].sort((a, b) => a.order_num - b.order_num)
  const [active, setActive] = useState(0)
  
  return (
    <div>
      {/* Foto principal — eager load (LCP) */}
      <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3' }}>
        <Image
          src={sorted[active].url}
          alt="Foto do anúncio"
          fill
          style={{ objectFit: 'cover' }}
          priority // ← LCP: cargar eager
          sizes="(max-width: 480px) 100vw, 480px"
        />
        {/* Contador */}
        <span style={{ position: 'absolute', bottom: 8, right: 8,
          background: 'rgba(0,0,0,0.5)', color: '#fff',
          padding: '2px 8px', borderRadius: 12, fontSize: 12 }}>
          {active + 1}/{sorted.length}
        </span>
      </div>
      
      {/* Thumbnails — lazy load */}
      {sorted.length > 1 && (
        <div style={{ display: 'flex', gap: 8, padding: '8px 16px',
          overflowX: 'auto', scrollbarWidth: 'none' }}>
          {sorted.map((p, i) => (
            <button key={p.url} onClick={() => setActive(i)}
              style={{ flexShrink: 0, border: i === active
                ? '2px solid var(--blue-main)' : '2px solid transparent',
                borderRadius: 6, overflow: 'hidden',
                background: 'none', padding: 0, cursor: 'pointer' }}>
              <Image
                src={p.url}
                alt={`Foto ${i + 1}`}
                width={60}
                height={60}
                style={{ objectFit: 'cover', display: 'block' }}
                loading="lazy" // ← no bloquean LCP
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

### 6. Formulario de publicación — lazy load del editor de fotos

```typescript
// app/publish/page.tsx — cargar el componente pesado solo cuando se necesita
import dynamic from 'next/dynamic'

const PhotoUploader = dynamic(
  () => import('@/components/PhotoUploader'),
  { 
    loading: () => <div style={{ height: 200, background: 'var(--color-background-secondary)',
      borderRadius: 12, animation: 'pulse 1.5s infinite' }} />,
    ssr: false // no se puede pre-renderizar en servidor
  }
)
```

### 7. Admin panel — code splitting por tab

```typescript
// app/admin/page.tsx — cargar cada tab dinámicamente
import dynamic from 'next/dynamic'

const DashboardTab = dynamic(() => import('./tabs/DashboardTab'), { ssr: false })
const AnunciosTab  = dynamic(() => import('./tabs/AnunciosTab'),  { ssr: false })
const DenunciasTab = dynamic(() => import('./tabs/DenunciasTab'), { ssr: false })
const BannersTab   = dynamic(() => import('./tabs/BannersTab'),   { ssr: false })
const UsuariosTab  = dynamic(() => import('./tabs/UsuariosTab'),  { ssr: false })

// Solo se carga el tab activo:
const TABS = { dashboard: DashboardTab, anuncios: AnunciosTab, ... }
const Tab = TABS[activeTab]
return <Tab />
```

---

## CHECKLIST DE VERIFICACIÓN

```bash
# 1. Verificar que ListingCard NO tiene 'use client' innecesario
head -3 frontend/components/ListingCard.tsx

# 2. Verificar next.config.js tiene remotePatterns
cat frontend/next.config.js | grep supabase

# 3. Verificar que BannerRotativo tiene cleanup
grep -A3 "setInterval" frontend/components/BannerRotativo.tsx

# 4. Build
cd frontend && npm run build 2>&1 | grep "First Load JS"
```

---

## REGLAS DE OPERACIÓN

1. Preferir Server Components — solo agregar `'use client'` cuando hay
   interactividad real (useState, useEffect, event handlers).
2. Los Client Components deben ser los más pequeños posibles (leaf nodes).
3. Nunca pasar funciones callback desde Server Components a Client Components
   como props (rompe la serialización).
4. `memo()` solo donde hay evidencia de re-renders costosos — no memoizar todo.
5. `Image` de next/image SIEMPRE para imágenes de Supabase Storage.
6. Reportar al Orchestrador qué archivos se modificaron y qué impacto en
   bundle size (antes/después del build).
