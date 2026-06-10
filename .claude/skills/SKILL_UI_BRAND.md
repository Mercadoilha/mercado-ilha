# SKILL — UI Brand & Missing Features
## Subagente: Agent-6-UI-Brand
## Proyecto: Mercado Ilha (Next.js 14 + TypeScript)

---

## MISIÓN
Implementar mejoras de UI/UX pendientes: logo SVG definitivo, features
faltantes del backlog (marcar vendido, republicar, filtros), y pulir la
interfaz para que sea consistente con la identidad de marca.

---

## CONTEXTO PRECARGADO

### Identidad visual
```
Nombre:       Mercado Ilha
Paleta:
  --blue-main:   #185FA5  (primario)
  --blue-mid:    #1a6fbd
  --blue-light:  #B5D4F4
  --blue-xlight: #E6F1FB
  --sand:        #EF9F27  (acento / botón publicar)
  --sand-light:  #FAC775
  --green-sea:   #9FE1CB
  --green-dark:  #0F6E56

Logo actual: 🏝️ + texto (placeholder)
Logo definitivo: bolsa de compras que contiene un montículo de arena
  con un faro encima (faro blanco, franjas rojas, luz amarilla)

Bottom nav: Início | Anúncios | ➕(arena,circular) | 🍽️ Comida | Perfil/Entrar
Layout: mobile-first, max-width: 480px
Idioma: Portugués brasileño
```

### Backlog de features pendientes
```
✅ Implementado
⬜ Pendiente

⬜ Logo SVG definitivo
⬜ Íconos PWA con logo real
⬜ Botón "Marcar como vendido" desde perfil
⬜ Republicar anuncio vencido con 1 clic
⬜ Filtros adicionales: precio, sub-zona
⬜ Botón "Instalar app" in-app (beforeinstallprompt)
⬜ Panel admin: gestión de localidades/sub-zonas
⬜ Panel admin: edición de categorías y atributos
```

---

## LOGO SVG DEFINITIVO

### Especificación
- Bolsa de compras (forma trapezoidal con asas) como contenedor
- Dentro de la bolsa: montículo de arena estilizado en la base
- Sobre el montículo: faro blanco con franjas rojas y luz amarilla
- Colores: bolsa en --blue-main, arena en --sand, faro blanco/rojo/amarillo

### SVG del logo (para usar en header y PWA)

```svg
<!-- Logo Mercado Ilha — 48x48px -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
  <!-- Bolsa de compras -->
  <path d="M8 18 L10 38 Q10 40 12 40 L36 40 Q38 40 38 38 L40 18 Z"
    fill="#185FA5"/>
  <!-- Asas de la bolsa -->
  <path d="M17 18 Q17 11 24 11 Q31 11 31 18"
    fill="none" stroke="#185FA5" stroke-width="2.5"
    stroke-linecap="round"/>
  <!-- Montículo de arena -->
  <ellipse cx="24" cy="38" rx="12" ry="4" fill="#EF9F27" opacity="0.9"/>
  <path d="M14 38 Q18 30 24 30 Q30 30 34 38 Z" fill="#EF9F27"/>
  <!-- Faro — cuerpo -->
  <rect x="21.5" y="20" width="5" height="11" rx="1" fill="#FFFFFF"/>
  <!-- Franjas rojas del faro -->
  <rect x="21.5" y="22.5" width="5" height="2" fill="#E53E3E"/>
  <rect x="21.5" y="27" width="5" height="2" fill="#E53E3E"/>
  <!-- Cúpula del faro -->
  <path d="M20.5 20 Q24 17 27.5 20 Z" fill="#FFFFFF"/>
  <rect x="20.5" y="19.5" width="7" height="1.5" rx="0.5" fill="#B0B8C1"/>
  <!-- Luz del faro -->
  <circle cx="24" cy="18.5" r="2" fill="#FAC775" opacity="0.95"/>
  <!-- Rayos de luz -->
  <line x1="24" y1="15" x2="24" y2="13" stroke="#FAC775" stroke-width="1" opacity="0.7"/>
  <line x1="27" y1="16" x2="28.5" y2="14.5" stroke="#FAC775" stroke-width="1" opacity="0.7"/>
  <line x1="21" y1="16" x2="19.5" y2="14.5" stroke="#FAC775" stroke-width="1" opacity="0.7"/>
</svg>
```

Para el header (inline SVG + texto):
```typescript
// components/Logo.tsx
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <svg xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 48 48" width={size} height={size}>
        {/* ... paths del logo ... */}
      </svg>
      <span style={{
        fontWeight: 700, fontSize: size * 0.5,
        color: '#fff', letterSpacing: -0.5
      }}>
        Mercado Ilha
      </span>
    </div>
  )
}
```

---

## FEATURE: Marcar como vendido + Republicar

### En `app/profile/page.tsx`

```typescript
// Acciones para cada anuncio del usuario
async function markAsSold(listingId: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('listings')
    .update({ status: 'sold' })
    .eq('id', listingId)
  if (error) throw error
}

async function republishListing(listingId: string, categoryExpiryDays: number | null) {
  const supabase = createClient()
  const expiresAt = categoryExpiryDays
    ? new Date(Date.now() + categoryExpiryDays * 24 * 60 * 60 * 1000).toISOString()
    : null
  
  const { error } = await supabase
    .from('listings')
    .update({
      status: 'active',
      expires_at: expiresAt,
      created_at: new Date().toISOString() // sube al top del listado
    })
    .eq('id', listingId)
  if (error) throw error
}
```

### UI de acciones por anuncio

```typescript
// En la lista de "Meus anúncios" — botones de acción
function ListingActions({
  listing,
  onRefresh
}: {
  listing: Listing & { categories: { expiry_days: number | null } }
  onRefresh: () => void
}) {
  const [loading, setLoading] = useState(false)
  
  const handleSold = async () => {
    setLoading(true)
    await markAsSold(listing.id)
    setLoading(false)
    onRefresh()
  }
  
  const handleRepublish = async () => {
    setLoading(true)
    await republishListing(listing.id, listing.categories.expiry_days)
    setLoading(false)
    onRefresh()
  }
  
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
      {listing.status === 'active' && (
        <button onClick={handleSold} disabled={loading}
          style={{ fontSize: 12, padding: '4px 10px',
            background: 'var(--green-sea)', color: 'var(--green-dark)',
            border: 'none', borderRadius: 6, cursor: 'pointer' }}>
          ✓ Marcar como vendido
        </button>
      )}
      {(listing.status === 'expired' || listing.status === 'sold') && (
        <button onClick={handleRepublish} disabled={loading}
          style={{ fontSize: 12, padding: '4px 10px',
            background: 'var(--sand)', color: '#fff',
            border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
          🔄 Republicar
        </button>
      )}
    </div>
  )
}
```

---

## FEATURE: Filtros adicionales (precio + sub-zona)

### En `app/listings/page.tsx`

```typescript
// Nuevos searchParams soportados:
// ?category=slug&q=texto&min_price=X&max_price=Y&subzone=slug

// Componente FilterBar (Client) — recibe searchParams actuales
'use client'
function FilterBar({ currentFilters }: { currentFilters: URLSearchParams }) {
  const router = useRouter()
  const pathname = usePathname()
  
  const update = (key: string, value: string) => {
    const params = new URLSearchParams(currentFilters)
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`${pathname}?${params.toString()}`)
  }
  
  return (
    <div style={{ padding: '8px 16px', display: 'flex', gap: 8,
      overflowX: 'auto', scrollbarWidth: 'none',
      borderBottom: '1px solid var(--color-border-tertiary)' }}>
      
      {/* Precio mínimo */}
      <input
        type="number"
        placeholder="R$ mín"
        defaultValue={currentFilters.get('min_price') ?? ''}
        onBlur={e => update('min_price', e.target.value)}
        style={{ width: 90, padding: '4px 8px', borderRadius: 8,
          border: '1px solid var(--color-border-secondary)',
          fontSize: 13, flexShrink: 0 }}
      />
      
      {/* Precio máximo */}
      <input
        type="number"
        placeholder="R$ máx"
        defaultValue={currentFilters.get('max_price') ?? ''}
        onBlur={e => update('max_price', e.target.value)}
        style={{ width: 90, padding: '4px 8px', borderRadius: 8,
          border: '1px solid var(--color-border-secondary)',
          fontSize: 13, flexShrink: 0 }}
      />
      
      {/* Sub-zona select (se carga dinámicamente) */}
      <SubzoneFilter
        currentSubzone={currentFilters.get('subzone') ?? ''}
        onChange={v => update('subzone', v)}
      />
    </div>
  )
}
```

### Query con filtros de precio y subzona

```typescript
// En el Server Component que hace la query:
let query = supabase
  .from('listings')
  .select('...')
  .eq('status', 'active')

if (searchParams.min_price) {
  query = query.gte('price', Number(searchParams.min_price))
}
if (searchParams.max_price) {
  query = query.lte('price', Number(searchParams.max_price))
}
if (searchParams.subzone) {
  // Para ubicación fija: filtrar por subzone directamente
  // Para zonas de atención: filtrar por listing_service_zones
  query = query.or(
    `subzone_id.eq.${subzoneId},` +
    `listing_service_zones.subzone_id.eq.${subzoneId},` +
    `listing_service_zones.all_island.eq.true`
  )
}
```

---

## PANEL ADMIN: Gestión de localidades y sub-zonas

### Nuevo tab en `/admin` — Geografía

```typescript
// Tab que permite al admin:
// 1. Ver todas las localidades de Tinharé
// 2. Agregar sub-zonas a una localidad
// 3. Editar nombre de sub-zonas existentes
// 4. Crear nuevas sub-zonas a partir de las referencias "Outros" frecuentes

// Estructura de UI:
// [Tinharé] → [Morro de São Paulo ▾] [Gamboa ▾] [Zimbo ▾] [Galeão ▾]
//   ↳ Lista de sub-zonas con edición inline + botón Agregar
```

---

## CHECKLIST DE VERIFICACIÓN

```bash
# 1. Verificar que el logo SVG renderiza en el header
grep -n "Logo\|logo" frontend/app/layout.tsx

# 2. Verificar que republish actualiza expires_at correctamente
# (revisar en Supabase Table Editor después de ejecutar)

# 3. Verificar filtros de precio en la URL
# Navegar a /listings?min_price=100&max_price=500 y verificar results
```

---

## REGLAS DE OPERACIÓN

1. Mantener TODA la UI en Portugués brasileño.
2. Usar SOLO las variables CSS de la paleta (`--blue-main`, `--sand`, etc.).
3. No usar Tailwind — solo CSS inline con variables.
4. Botones de acción destructiva (vender, eliminar) deben pedir confirmación.
5. El logo SVG debe quedar en `public/logo.svg` Y como componente
   `components/Logo.tsx` (para usar inline en el código).
6. Reportar al Orchestrador qué features se completaron y cuáles
   requieren ajustes en la base de datos.
