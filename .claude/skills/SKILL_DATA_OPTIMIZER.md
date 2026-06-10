# SKILL — Data Layer Optimizer
## Subagente: Agent-2-Data-Optimizer
## Proyecto: Mercado Ilha (Next.js 14 + Supabase + Vercel)

---

## MISIÓN
Optimizar todas las consultas a Supabase y la gestión de datos en la app.
Eliminar waterfalls, agregar índices, implementar caché donde corresponde,
y asegurar que cada ruta haga el mínimo número de queries necesarios.

---

## CONTEXTO PRECARGADO

### Esquema de tablas relevantes
```sql
-- Tablas principales (en orden de frecuencia de acceso)
islands           → id, name, slug
localities        → id, island_id, name, slug
subzones          → id, locality_id, name, slug, is_outros
categories        → id, name, slug, icon, order_num, expiry_days,
                    whatsapp_message, button_text, location_type
subcategories     → id, category_id, name, slug, order_num
listings          → id, user_id, category_id, subcategory_id,
                    subzone_id, title, description, price, condition,
                    status (active|paused|sold|expired|hidden),
                    created_at, expires_at
listing_photos    → id, listing_id, url, order_num
listing_service_zones → id, listing_id, subzone_id, all_island (bool)
profiles          → id (= auth.users.id), name, whatsapp, role
banners           → id, image_url, link_url, position, active,
                    starts_at, ends_at
admin_settings    → key, value (JSONB)
reports           → id, listing_id, user_id, reason, status
```

### Variables de entorno Supabase
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY  ← solo server
```

---

## PATRONES DE OPTIMIZACIÓN

### 1. Queries paralelas (eliminar waterfall)

**Ruta Home (`app/page.tsx`) — patrón correcto:**
```typescript
// ANTES (waterfall — 3 roundtrips secuenciales):
const { data: cats } = await supabase.from('categories').select('*').order('order_num')
const { data: listings } = await supabase.from('listings')
  .select('*, listing_photos(*), profiles(name)')
  .eq('status', 'active').limit(20).order('created_at', { ascending: false })
const { data: banners } = await supabase.from('banners')
  .select('*').eq('active', true).eq('position', 'home')

// DESPUÉS (paralelo — 1 roundtrip efectivo):
const [catsResult, listingsResult, bannersResult] = await Promise.all([
  supabase.from('categories').select('*').order('order_num'),
  supabase.from('listings')
    .select('id, title, price, condition, status, created_at, subzone_id, category_id, subcategory_id, listing_photos(url, order_num), profiles(name, id)')
    .eq('status', 'active').limit(20).order('created_at', { ascending: false }),
  supabase.from('banners')
    .select('id, image_url, link_url, position')
    .eq('active', true).eq('position', 'home')
    .lte('starts_at', new Date().toISOString())
    .or('ends_at.is.null,ends_at.gte.' + new Date().toISOString())
])
```

### 2. Selects específicos (no `select('*')`)

Siempre seleccionar solo los campos necesarios:
```typescript
// ListingCard necesita:
.select('id, title, price, condition, status, created_at, subzone_id, category_id, listing_photos(url, order_num)')

// Detalle del anuncio necesita todo + vendedor:
.select(`
  id, title, description, price, condition, status, created_at, expires_at,
  subzone_id, category_id, subcategory_id,
  listing_photos(id, url, order_num),
  listing_service_zones(subzone_id, all_island),
  profiles(id, name, whatsapp),
  categories(name, whatsapp_message, button_text, location_type),
  subcategories(name)
`)
```

### 3. Caché con Next.js `unstable_cache`

Para datos que cambian poco (categorías, zonas geográficas):
```typescript
// lib/cachedQueries.ts
import { unstable_cache } from 'next/cache'
import { createClient } from './supabaseClient'

export const getCategories = unstable_cache(
  async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('categories')
      .select('id, name, slug, icon, order_num, location_type, button_text, whatsapp_message, expiry_days')
      .order('order_num')
    return data ?? []
  },
  ['categories'],
  { revalidate: 3600 } // 1 hora
)

export const getLocalities = unstable_cache(
  async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('localities')
      .select('id, name, slug, island_id, subzones(id, name, slug, is_outros)')
      .order('name')
    return data ?? []
  },
  ['localities'],
  { revalidate: 3600 }
)

export const getAdminSettings = unstable_cache(
  async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('admin_settings')
      .select('key, value')
    return Object.fromEntries((data ?? []).map(r => [r.key, r.value]))
  },
  ['admin_settings'],
  { revalidate: 300 } // 5 minutos
)
```

### 4. Índices SQL recomendados

Script a ejecutar en Supabase SQL Editor:
```sql
-- Índices para listings (las queries más frecuentes)
CREATE INDEX IF NOT EXISTS idx_listings_status 
  ON listings(status);

CREATE INDEX IF NOT EXISTS idx_listings_status_created 
  ON listings(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_listings_category_status 
  ON listings(category_id, status);

CREATE INDEX IF NOT EXISTS idx_listings_user_status 
  ON listings(user_id, status);

CREATE INDEX IF NOT EXISTS idx_listings_expires_at 
  ON listings(expires_at) WHERE expires_at IS NOT NULL;

-- Índices para fotos (JOIN frecuente)
CREATE INDEX IF NOT EXISTS idx_listing_photos_listing 
  ON listing_photos(listing_id, order_num);

-- Índices para zonas de atención
CREATE INDEX IF NOT EXISTS idx_service_zones_listing 
  ON listing_service_zones(listing_id);

CREATE INDEX IF NOT EXISTS idx_service_zones_subzone 
  ON listing_service_zones(subzone_id);

-- Índices para búsqueda de texto (si no existe)
CREATE INDEX IF NOT EXISTS idx_listings_search 
  ON listings USING gin(to_tsvector('portuguese', title || ' ' || COALESCE(description, '')));
```

### 5. Paginación en lugar de limit fijo

Para la home y listados:
```typescript
const PAGE_SIZE = 20

// En page.tsx — recibe searchParams
const page = Number(searchParams.page ?? 1)
const from = (page - 1) * PAGE_SIZE
const to = from + PAGE_SIZE - 1

const { data, count } = await supabase
  .from('listings')
  .select('...', { count: 'exact' })
  .eq('status', 'active')
  .range(from, to)
  .order('created_at', { ascending: false })
```

### 6. BannerRotativo — evitar re-fetch en mount

```typescript
// components/BannerRotativo.tsx — patrón correcto
// Los banners deben venir como PROP desde el Server Component padre,
// NO fetching desde el Client Component con useEffect

// Server Component padre:
const banners = await getBannersHome() // función cacheada
return <BannerRotativo banners={banners} />

// BannerRotativo.tsx (Client Component solo para la rotación):
'use client'
export function BannerRotativo({ banners }: { banners: Banner[] }) {
  const [current, setCurrent] = useState(0)
  
  useEffect(() => {
    if (banners.length <= 1) return
    const id = setInterval(() => 
      setCurrent(c => (c + 1) % banners.length), 4000)
    return () => clearInterval(id) // ← cleanup obligatorio
  }, [banners.length])
  
  // render...
}
```

### 7. BottomNav — leer sesión sin re-render

```typescript
// components/BottomNav.tsx
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabaseClient'

export function BottomNav() {
  const [userId, setUserId] = useState<string | null>(null)
  
  useEffect(() => {
    const supabase = createClient()
    
    // Leer sesión inicial UNA vez
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null)
    })
    
    // Escuchar cambios (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_, session) => setUserId(session?.user.id ?? null)
    )
    
    return () => subscription.unsubscribe() // ← cleanup obligatorio
  }, []) // ← array vacío: solo en mount
  
  // render con userId...
}
```

---

## ARCHIVOS A MODIFICAR (en orden de prioridad)

1. `lib/cachedQueries.ts` — CREAR (queries cacheadas)
2. `app/page.tsx` — Promise.all + usar cachedQueries
3. `app/listings/page.tsx` — Promise.all + paginación
4. `components/BannerRotativo.tsx` — props en lugar de fetch interno
5. `components/BottomNav.tsx` — fix cleanup y memoización
6. SQL en Supabase — agregar índices
7. `next.config.js` — verificar remotePatterns para imágenes

---

## REGLAS DE OPERACIÓN

1. **Siempre mostrar el código ANTES y DESPUÉS** para cada cambio.
2. Verificar que los tipos TypeScript son correctos después de cada cambio.
3. No romper RLS: nunca usar supabaseAdmin en Client Components.
4. Si una query necesita service role, implementar como Route Handler en
   `app/api/` con el cliente admin, nunca exponer la key al cliente.
5. Reportar al Orchestrador qué cambios se aplicaron y cuáles requieren
   intervención manual (SQL en Supabase Dashboard).
6. Escribir código en TypeScript, comentarios en español.
