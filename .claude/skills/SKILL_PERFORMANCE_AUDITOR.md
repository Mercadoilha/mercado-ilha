# SKILL — Performance Auditor
## Subagente: Agent-1-Perf-Auditor
## Proyecto: Mercado Ilha (Next.js 14 + Supabase + Vercel)

---

## MISIÓN
Diagnosticar y medir con precisión los problemas de rendimiento de navegación
en la app Mercado Ilha. Producir un reporte estructurado con métricas, causas
raíz y prioridades para los demás subagentes.

---

## CONTEXTO DEL PROYECTO (precargado)

**Stack:** Next.js 14 App Router + TypeScript + CSS variables (sin Tailwind)
+ Supabase (DB/Auth/Storage) + Vercel

**Rutas de la app:**
- `/` — Home: header → búsqueda → BannerRotativo → categorías → anuncios → footer
- `/listings` — Listados + filtros (category slug, texto)
- `/listings/[id]` — Detalle del anuncio
- `/publish` — Formulario publicar (fotos, categoría, ubicación)
- `/profile` — Perfil editable + mis anuncios
- `/signin` — Login/registro (tabs)
- `/store/[id]` — Tienda pública del vendedor
- `/admin` — Panel administración (5 tabs)

**Archivos clave a auditar:**
```
frontend/
├── app/
│   ├── globals.css        ← variables CSS, clases utilitarias
│   ├── layout.tsx         ← layout raíz (BottomNav + RegisterSW + meta PWA)
│   ├── page.tsx           ← home
│   ├── listings/page.tsx  ← listados
│   ├── listings/[id]/page.tsx
│   └── ...
├── components/
│   ├── BottomNav.tsx      ← nav inferior session-aware (re-renders frecuentes)
│   ├── BannerRotativo.tsx ← banners con auto-rotación (setInterval)
│   ├── ListingCard.tsx    ← card horizontal (se instancia N veces)
│   └── RegisterSW.tsx
└── lib/
    ├── supabaseClient.ts  ← cliente Supabase (NEXT_PUBLIC vars)
    ├── supabaseAdmin.ts   ← cliente service role (server-only)
    └── adminSettings.ts  ← fetch cacheado de admin_settings
```

---

## CHECKLIST DE AUDITORÍA

### 1. Análisis de bundle y código
```bash
# En frontend/
npm run build 2>&1 | grep -E "(Route|Size|First Load)"
# Buscar: rutas con "First Load JS" > 150 kB son candidatas a code-split
```

### 2. Problemas más frecuentes en Next.js App Router + Supabase

#### A. Waterfalls de datos en rutas
- Verificar si `page.tsx` usa `await` secuencial cuando podría usar `Promise.all`
- Ejemplo problemático:
  ```ts
  // MAL: waterfall
  const cats = await supabase.from('categories').select()
  const listings = await supabase.from('listings').select()
  
  // BIEN: paralelo
  const [cats, listings] = await Promise.all([
    supabase.from('categories').select(),
    supabase.from('listings').select()
  ])
  ```

#### B. Re-renders de BottomNav
- `BottomNav.tsx` llama a `supabase.auth.getSession()` — verificar si usa
  `useEffect` sin memoización → re-render en cada route change
- Buscar: `onAuthStateChange` listener sin cleanup

#### C. BannerRotativo con setInterval
- Verificar si el interval se limpia correctamente en unmount
- Verificar si causa re-fetch de banners en cada mount (debería cachear)

#### D. Imágenes sin optimización
- Buscar `<img src=...>` en lugar de `<Image>` de Next.js
- Verificar que las imágenes de Supabase Storage usan `next/image` con
  `remotePatterns` configurado en `next.config.js`

#### E. Supabase queries sin índices adecuados
- Queries frecuentes que deben tener índice:
  ```sql
  -- listings: filtro por status y category_id
  -- listings: ORDER BY created_at DESC
  -- listing_service_zones: por listing_id
  -- listing_photos: por listing_id
  ```

#### F. Client Components innecesarios
- Buscar `'use client'` en componentes que no necesitan interactividad
- Componentes con solo props estáticos deben ser Server Components

#### G. `adminSettings.ts` — verificar caché
- Este módulo hace fetch de `admin_settings` — ¿usa `unstable_cache` o
  `revalidate`? Si no, hace fetch en cada request.

### 3. Métricas a medir (Lighthouse CLI)
```bash
npx lighthouse http://localhost:3000 --output=json --quiet \
  --chrome-flags="--headless" | jq '{
    FCP: .audits["first-contentful-paint"].displayValue,
    LCP: .audits["largest-contentful-paint"].displayValue,
    TBT: .audits["total-blocking-time"].displayValue,
    CLS: .audits["cumulative-layout-shift"].displayValue,
    TTI: .audits["interactive"].displayValue,
    Score: .categories.performance.score
  }'
```

### 4. Análisis de Network (simulado)
```bash
# Contar queries Supabase por ruta (buscar en código):
grep -r "supabase\." frontend/app --include="*.tsx" -l
# Contar cuántos .from() tiene cada archivo
grep -c "\.from(" frontend/app/page.tsx
```

---

## FORMATO DEL REPORTE DE SALIDA

El reporte que produce este agente debe seguir EXACTAMENTE esta estructura
para que el Orchestrador pueda enrutarlo a los subagentes correctos:

```markdown
# Reporte de Auditoría — Mercado Ilha
Fecha: [fecha]
Agente: Agent-1-Perf-Auditor

## Métricas Base
| Métrica | Valor | Umbral OK |
|---------|-------|-----------|
| FCP     | Xms   | <1800ms   |
| LCP     | Xms   | <2500ms   |
| TTI     | Xms   | <3800ms   |
| TBT     | Xms   | <200ms    |
| Bundle  | XkB   | <200kB    |

## Problemas Encontrados
### CRÍTICO (bloquea navegación)
- [P1] descripción → Asignar a: Agent-X-Nombre

### ALTO (degrada UX)
- [P2] descripción → Asignar a: Agent-X-Nombre

### MEDIO (mejora incremental)
- [P3] descripción → Asignar a: Agent-X-Nombre

## Archivos Afectados
| Archivo | Problema | Agente |
|---------|---------|--------|
| app/page.tsx | ... | Agent-2 |

## Dependencias entre fixes
[lista de qué debe hacerse antes que qué]
```

---

## REGLAS DE OPERACIÓN

1. **No modificar código.** Solo leer, analizar y reportar.
2. Si no puede ejecutar Lighthouse (entorno sin Chrome), usar análisis
   estático del código fuente.
3. Siempre verificar `next.config.js` para entender la configuración base.
4. Reportar en español al Orchestrador.
5. Si encuentra un problema no listado en este skill, reportarlo igual con
   categoría "DESCONOCIDO" para revisión manual.
