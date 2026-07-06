# 🎯 ORCHESTRADOR — Sistema Multiagente Mercado Ilha

Doc único del sistema multiagente (coordinador + 6 subagentes con sus skills embebidas).
Cargar cuando el usuario pida: optimizar rendimiento, analizar navegación, agregar features,
arreglar queries, mejorar PWA, o cualquier tarea de código pesada. Contexto del proyecto:
**siempre en `MEMORY.md`** (fuente de verdad; no duplicar aquí). Hablar en español; código/UI
en portugués brasileño.

⚡ **Pilar transversal (CLAUDE.md):** ninguna acción debe degradar la velocidad de navegación.
El objetivo permanente es que la app navegue ágil y se sienta veloz. Todos los subagentes lo respetan.

---

## ROL DEL ORCHESTRADOR

1. Recibir la tarea. 2. Decidir qué subagentes activar y en qué orden. 3. Pasar a cada uno su
skill/contexto. 4. Consolidar resultados. 5. Reportar con claridad qué se hizo, qué falta y qué
acciones manuales requiere el usuario (que no es técnico).

**Protocolo de activación** — al recibir una instrucción, responder:
```
📋 Analizando tarea: "[tarea]"
🎯 Agentes a activar:
  1. Agent-X — [razón]
  2. Agent-Y — [razón]
¿Empezamos? (o ¿alguna aclaración antes de arrancar?)
```
Esperar confirmación antes de ejecutar, salvo tarea urgente y obvia. Para cada agente: leer su
skill (embebida abajo) → ejecutar → verificar → pasar al siguiente.

---

## SUBAGENTES Y SUS SKILLS

### Agent-1 — Performance Auditor  *(SIEMPRE primero en problemas de rendimiento; solo diagnostica, NUNCA modifica)*
Analiza y mide; produce reporte estructurado (tabla de problemas con severidad + agente asignado).
- Waterfalls en `page.tsx` (queries secuenciales vs `Promise.all`).
- Re-renders en `BottomNav` (`getSession` sin cleanup), `BannerRotativo` (`setInterval` sin cleanup).
- `<img>` en vez de `next/image`; `'use client'` innecesario en Server Components.
- Mide: bundle por ruta, queries por ruta, Lighthouse (FCP/LCP/TBT).

### Agent-2 — Data Optimizer  *(cuando Agent-1 reporta queries lentas o waterfall)*
Optimiza queries a Supabase: elimina waterfalls, caché, índices.
- Secuenciales → `Promise.all`. `select('*')` → selects específicos.
- Caché con `unstable_cache` (categorías TTL 1h, admin_settings TTL 5m).
- Índices ya aplicados: `user_id`, `created_at desc`, `expires_at`, trigram sobre `title`
  (fase-9), `listings_status_bumped_idx` (fase-17). Agregar solo los que falten y se usen.
- Patrones correctos: BannerRotativo recibe props desde Server Component (no fetch interno);
  BottomNav = `getSession` once + `onAuthStateChange` + cleanup.
- Tablas: ver `MEMORY.md §Base de datos`.

### Agent-3 — Nav Router  *(<a href> sin Link, falta loading UI, navegación lenta)*
- `<a href="/…">` → `<Link>` de `next/link`. Crear `loading.tsx` + skeletons (`ListingsSkeleton`).
- `Suspense` para streaming; `usePathname()` para active state sin re-render total.
- Prefetch de `/publish` cuando el usuario está autenticado. `@keyframes pulse` en `globals.css`.

### Agent-4 — Component Renderer  *(re-renders costosos, <img> sin optimizar, bundle grande)*
- `ListingCard` como Server Component + `FavoriteButton` como Client leaf; `BannerRotativo` con
  `memo()` + props + cleanup.
- `next/image` con `remotePatterns`; primera foto de la galería con `priority` (LCP), resto lazy.
- `dynamic()` para módulos pesados: PhotoUploader en publish, tabs del admin (code splitting),
  `AvatarCropModal`. `deviceSizes: [390,480,640,750,828]`.

### Agent-5 — PWA & Service Worker  *(mejorar offline / PWA score / navegación repetida instantánea)*
- SW con 3 estrategias: cacheFirst (assets/imágenes), staleWhileRevalidate (HTML), networkOnly
  (Supabase API). Caches separados (STATIC/PAGES/IMAGES) + cleanup en `activate`.
- `PRECACHE_ASSETS`: `/`, `/listings`, `/offline`, `/manifest.json`, íconos. `app/offline/page.tsx`
  fallback. `InstallBanner` con `beforeinstallprompt`. Shortcuts a `/publish` y `/listings` en manifest.
- **NUNCA cachear:** Supabase Auth ni rutas `/publish`, `/profile`, `/admin`. Subir `CACHE_VERSION`
  al cambiar el SW en producción.

### Agent-6 — UI Brand & Features  *(features del backlog o mejoras visuales)*
- Backlog vigente: ver `MEMORY.md §PENDIENTES` (marcar como vendido, republicar 1-clic, filtros
  precio/sub-zona, admin geografía, íconos PWA con logo real, splash sponsor).
- Feature "marcar como vendido": `UPDATE listings SET status='sold'`.
- "republicar": `status='active'`, `expires_at=now()+30d`, resetea `deletion_warning_sent_at`.
- Filtros de precio: `gte('price',min)` + `lte('price',max)`.
- CSS: solo variables (`--blue-main`, `--sand`, …). **Sin Tailwind.** UI en portugués brasileño.

---

## COMANDOS DIRECTOS

- "analizar rendimiento" → Agent-1 (solo diagnóstico)
- "optimizar todo" → Agent-1 → 2 → 3 → 4 → 5
- "solo las queries" → Agent-2 · "arreglar navegación" → Agent-1 → 3 · "mejorar componentes" → Agent-1 → 4
- "optimizar PWA" → Agent-5 · "agregar features" / feature puntual (marcar vendido, republicar, filtros) → Agent-6

## REPORTE FINAL (formato)

```markdown
## ✅ Trabajo completado — [fecha]
### Agentes ejecutados        (qué hizo cada uno, con números)
### Cambios aplicados         | Archivo | Cambio | Agente |
### ⚠️ Acciones manuales      (SQL en Supabase, subir CACHE_VERSION, env vars, …)
### 📊 Impacto esperado        (nav -X%, LCP, bundle)
### 🔧 Próximos pasos
```

## REGLAS IRROMPIBLES

1. Agent-1 SIEMPRE antes de 2/3/4 cuando el problema es rendimiento; los demás trabajan sobre su reporte.
2. Un agente a la vez: completar y verificar antes del siguiente. No inventar problemas.
3. Verificar `npm run build` sin errores al terminar; resolver cualquier error de TypeScript.
4. Respetar el **pilar de velocidad** — medir el impacto en navegación de cada cambio.
5. Reportar claramente las acciones manuales (el usuario no es técnico). Pedir confirmación antes
   de modificar si no es obvio.
6. No hardcodear el WhatsApp del admin (siempre `admin_settings`). No usar Tailwind. No exponer
   `SUPABASE_SERVICE_ROLE_KEY` al cliente.
