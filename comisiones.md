# Modelo de Monetización — Mercado Ilha

## Decisión general
Lanzar **100% gratis** sin límites. Cobrar en una fase futura cuando haya masa crítica de usuarios y anuncios. No comunicar al lanzamiento que habrá cobro — anunciarlo cuando el sitio ya tenga tracción y valor demostrado.

---

## Modelo de cobro por tipo de publicación

### Servicios (categorías de servicios)
- **Modelo:** mensalidade (suscripción mensual)
- Justificación: el anuncio es permanente, como un aviso en guía local. El vendedor se beneficia de visibilidad continua.
- Cada categoría tiene su propio precio configurable desde el panel admin.

### Productos (compra/venta de items)
- **Modelo:** primeras 3 publicaciones gratis, a partir de la 4ta se cobra por publicación
- Justificación: ventas ocasionales, no negocios establecidos. No tiene sentido mensalidad para alguien que vende una tabla de surf usada.

### Donaciones
- **Modelo:** siempre gratis, sin excepción

---

## Precios por categoría (orientativos, a definir)

| Categoría | Modelo | Precio estimado |
|---|---|---|
| Imóveis (terrenos, casas) | Mensalidade | R$49,90 |
| Gastronomia / delivery | Mensalidade | R$29,90 |
| Serviços gerais | Mensalidade | R$19,90 |
| Construção | Mensalidade | R$19,90 |
| Outros serviços | Mensalidade | R$19,90 |
| Produtos (compra/venda) | Por publicação | R$3,00 (3 gratis) |
| Doações | Grátis | — |

> Estos valores son orientativos. Se definen y ajustan desde el panel admin.

---

## Feature de destaque (anuncio destacado)
- El vendedor paga para que su anuncio aparezca primero en la lista
- Solo tiene sentido cuando haya suficiente competencia por categoría (masa crítica)
- Integración: Mercado Pago Checkout Pro
- MP cobra ~3,49% + R$0,40 por transacción (sin mensalidad de la plataforma)
- Implementar después del cobro base

---

## Estructura técnica en DB

Agregar campos a la tabla `categories` existente:

```sql
pricing_model  TEXT     -- 'free' | 'per_listing' | 'monthly'
price_brl      DECIMAL  -- precio en reales
free_limit     INT      -- null = ilimitado (para per_listing: cuántas gratis)
```

Y en `users`:
```sql
plan  TEXT  -- 'free' | 'basic' | 'pro'  (preparado para el futuro)
```

---

## Panel admin — Sección "Configuração de Preços"
- Lista todas las categorías con su modelo y precio actual
- Permite cambiar modelo de cobro, valor y límite gratuito por categoría
- Cambios se aplican inmediatamente a nuevas publicaciones
- Donaciones: bloqueado en "Grátis" (o configurable, a decidir)

---

## Estrategia de comunicación del cambio

**NO comunicar al lanzamiento.** Anunciar cuando:
1. Haya usuarios activos publicando
2. Vendedores vean resultados (contactos por WhatsApp)
3. La plataforma funcione bien y tenga reputación

**Mensaje al momento del cambio:**
> "O Mercado Ilha cresceu! Para continuar melhorando a plataforma, a partir de DD/MM os serviços terão um plano mensal. Os anúncios publicados até essa data continuam ativos sem custo."

**Si alguien pregunta antes de ese momento:** ser honesto — "en el futuro puede haber planes pagos" — pero no incluirlo en el onboarding ni en ningún lugar visible al lanzar.

---

## Hoja de ruta de monetización

1. **Ahora:** lanzar gratis, construir las fases del producto
2. **Fase 6 (admin):** incluir panel de configuración de precios (aunque no esté activo)
3. **Cuando haya tracción:** activar cobro + integrar Mercado Pago
4. **Después:** agregar feature de destaque

---

## Pendientes a decidir
- [ ] Precio exacto por categoría
- [ ] ¿Donaciones siempre gratis o configurable por admin?
- [ ] ¿Grandfathering: anuncios existentes quedan gratis para siempre o hasta que venzan?
- [ ] ¿Período de gracia al anunciar el cambio? (recomendado: mínimo 30 días)

---
---

# Análisis de Monetización — 3 Opciones Concretas (2026-06-18)

## Estado técnico actual de la app

- Sistema de banners rotativos ya construido (posiciones: home, listado)
- Cero tracking de clicks en botón WhatsApp (oportunidad sin explotar)
- No existe concepto de anuncio destacado/premium en la DB ni el frontend
- Los campos `pricing_model`, `price_brl`, `free_limit` de la sección anterior NO están en la DB todavía
- Admin con 7 tabs funcionales, sin configuración de precios
- Tabla `listing_views` existe pero no se muestra al vendedor
- Clicks en banners no se trackean (el link es directo)

---

## Opción 1: Publicidad Local — Venta de Espacios a Negocios

**Concepto:** Mercado Ilha no cobra a los usuarios. Cobra a los negocios de la isla que quieren visibilidad frente a la audiencia cautiva de la app.

**Por qué funciona aquí:**
- La infraestructura de banners YA EXISTE — es el camino más corto a generar ingresos
- Los usuarios nunca pagan. La app sigue 100% gratuita. Cero fricción de adopción
- En una isla turística, pousadas, restaurantes, lanchas y tours NECESITAN publicidad local y hoy no tienen un canal digital efectivo
- La venta es presencial (la isla es chica), no necesita plataforma de pagos online
- Es el modelo de "diario del barrio" o "guía local" — los negocios lo entienden sin explicación

**Qué se vende:**

| Producto | Precio sugerido | Frecuencia |
|----------|----------------|------------|
| Banner rotativo Home (posición premium) | R$150-200/mes | Mensual |
| Banner rotativo Listado (categorías) | R$80-120/mes | Mensual |
| Banner en detalle de anuncio (nuevo) | R$100-150/mes | Mensual |
| Banner exclusivo por categoría (nuevo) | R$200-300/mes | Mensual |

**Revenue estimado:** 3-5 anunciantes × R$100-200 = **R$300 a R$1.000/mes** desde el arranque.

**Qué hay que construir:**
- Expandir posiciones de banner: detalle de anuncio, página de categoría
- Dashboard de métricas para anunciantes (impresiones, clicks en banner)
- Tracking de clicks en banners (hoy el link es directo, sin conteo)
- Media kit simple (PDF de una página con precios y audiencia)

**Riesgo:** Techo de revenue bajo. En una isla con pocos negocios, el inventario publicitario se agota rápido. Pero es dinero real desde el día 1.

---

## Opción 2: Anuncios Destacados — Pago por Visibilidad

**Concepto:** Publicar es gratis. Destacar tu anuncio para que aparezca primero cuesta dinero. El vendedor paga cuando quiere más visibilidad en un momento competitivo.

**Por qué funciona aquí:**
- Es la monetización más natural de un marketplace — el que paga, sale primero
- Solo tiene sentido cuando hay competencia por categoría (varios anuncios similares), lo cual coincide con el momento de tracción que necesitás para activar cobro
- El vendedor ve valor directo: "pago R$10 y mi anuncio sale primero 7 días"
- No castiga al usuario casual que vende algo una vez
- Funciona especialmente bien en Imóveis (terrenos, casas, aluguéis) donde los montos en juego justifican pagar por visibilidad

**Modelo de precios:**

| Tipo | Precio | Duración |
|------|--------|----------|
| Destaque por publicación (Produtos) | R$5-10 | 7 días |
| Destaque por publicación (Imóveis) | R$15-25 | 15 días |
| Destaque mensual (Serviços, Gastronomia) | R$19.90-39.90 | 30 días |

**Cómo funciona en la práctica (fase inicial — sin integración de pago):**
1. Vendedor quiere destacar → botón "Destacar anúncio" en su perfil
2. App muestra precio y pide Pix o WhatsApp al admin para coordinar pago
3. Admin recibe pago, entra al panel y activa el destaque manualmente
4. Anuncio destacado sube al tope de su categoría con badge visual "⭐ Destaque"

**Revenue estimado:** 10-20 destacados/mes × R$10-30 = **R$100 a R$600/mes** (crece con la base).

**Qué hay que construir:**
- Campos en listings: `is_featured`, `featured_until`
- Ordenamiento: featured primero, luego por fecha
- Badge visual en el card del anuncio
- Botón "Destacar" en el perfil del vendedor con instrucciones de pago
- Admin: toggle manual para destacar/quitar destaque
- (Fase posterior) Integración Mercado Pago para pago automático

**Riesgo:** Necesita masa crítica. Si hay 3 anuncios en una categoría, nadie paga por destacar. Pero escala bien con el crecimiento.

---

## Opción 3: Suscripción "Vendedor Pro" — Funcionalidades Premium

**Concepto:** Todos publican gratis, sin límite. Los vendedores que quieren herramientas profesionales pagan una mensualidad baja por un paquete de beneficios.

**Por qué funciona aquí:**
- En la isla hay negocios establecidos (pedreiros, electricistas, restaurantes, pousadas) que publican permanentemente — para ellos R$19.90/mes es nada comparado con el valor de tener presencia digital
- El valor no es "poder publicar" (eso es gratis), es "vender MÁS y MEJOR"
- Crea un flujo de ingreso recurrente y predecible (MRR)
- El badge de "Vendedor Verificado" genera confianza en el comprador, lo cual justifica el pago del vendedor

**Qué incluye el plan Pro (R$19.90-29.90/mes):**

| Beneficio | Gratis | Pro |
|-----------|--------|-----|
| Publicar anuncios | ✅ Ilimitado | ✅ Ilimitado |
| Fotos por anuncio | 4 | 6 |
| Destaque automático | ❌ | ✅ 1 destaque/mes incluido |
| Badge "Vendedor Verificado" | ❌ | ✅ |
| Métricas (views + clicks WhatsApp) | ❌ | ✅ |
| Posición prioritaria en búsqueda | ❌ | ✅ |
| Logo/banner en su tienda pública | ❌ | ✅ |

**Revenue estimado:** 15-30 suscriptores × R$19.90 = **R$300 a R$600/mes** recurrentes.

**Qué hay que construir:**
- Tracking de WhatsApp clicks por anuncio (esencial para las métricas)
- Tracking de views por anuncio (ya existe `listing_views` pero no se muestra al vendedor)
- Dashboard de vendedor con métricas
- Sistema de suscripción (campo `plan` en profiles + lógica de features)
- Badge visual "Verificado" en listings y tienda
- Integración de pago recurrente (Mercado Pago o Pix manual al inicio)
- Límite de fotos condicional al plan

**Riesgo:** Es el más complejo de implementar. Requiere tracking, dashboard de métricas, y gestión de suscripción. Pero es el que genera MRR (monthly recurring revenue) más sólido.

---

## Comparativa rápida

| Criterio | Publicidad | Destacados | Suscripción Pro |
|----------|-----------|------------|-----------------|
| Complejidad técnica | Baja | Media | Alta |
| Tiempo a primer ingreso | Inmediato | 2-3 meses | 3-6 meses |
| Revenue potencial mensual | R$300-1.000 | R$100-600 | R$300-600 |
| Escalabilidad | Baja (techo) | Alta | Alta |
| Fricción para usuarios | Cero | Baja | Baja |
| Necesita masa crítica | No | Sí | Sí |
| Necesita integración de pago | No | Eventual | Sí |

---

## Secuencia estratégica recomendada

Las 3 opciones NO son mutuamente excluyentes. Se aplican en capas:

1. **Ahora → Publicidad local** (revenue inmediato, el sistema de banners ya existe, solo hay que vender los espacios)
2. **Cuando haya competencia por categoría → Destacados** (monetiza el crecimiento orgánico)
3. **Cuando haya vendedores habituales identificados → Suscripción Pro** (captura el valor recurrente)

Cada capa se suma a la anterior. Un restaurante podría tener banner publicitario + anuncio destacado + plan Pro.

---

## Acción inmediata pre-monetización: Tracking de WhatsApp

Independientemente de qué opción se implemente primero, **trackear los clicks del botón WhatsApp es fundamental**. Es la métrica de valor #1 de la plataforma: cada click = un lead real generado. Sin ese dato:
- No podés demostrar valor a anunciantes (Opción 1)
- No podés justificar el precio de destacados (Opción 2)
- No podés ofrecer métricas a vendedores Pro (Opción 3)

Implementar una tabla `whatsapp_clicks` (listing_id, clicked_at, visitor_id) es un paso técnico pequeño con impacto enorme en cualquier estrategia de monetización.

---

## ✅ IMPLEMENTADO (2026-06-18) — Tracking pre-monetización

Lanzamiento decidido: **100% gratis, sin opción paga visible.** Solo se construyó la recolección de datos (lo único irrecuperable hacia atrás). Features de cobro (precios, destaque, Pro) se posponen hasta tener tracción.

**Lo que se construyó:**
- `supabase/fase-monetizacion-tracking.sql` — correr en Supabase SQL Editor (idempotente).
  - Tablas nuevas: `whatsapp_clicks`, `banner_clicks` (RLS: lectura/borrado solo admin; escritura solo vía RPC).
  - Fix: `track_listing_view` ahora es `security definer` (antes fallaba para visitantes por RLS de `listing_statistics` → las vistas nunca se grababan).
  - RPCs: `track_whatsapp_click`, `track_banner_click`, `track_listing_view`, `get_tracking_summary`, `get_top_listings_by_whatsapp`.
- Frontend:
  - `lib/visitorId.ts` — UUID anónimo en localStorage.
  - `lib/tracking.ts` — helpers fire-and-forget (nunca bloquean la UX).
  - Vista de anuncio: se graba al abrir el detalle (`app/listings/[id]/page.tsx`).
  - WhatsApp: contacto en anuncio + tienda + CTAs de banner + sugerencia home.
  - Banner: click en imagen del banner (`components/BannerRotativo.tsx`).
  - Admin: pestaña **📈 Métricas** (solo lectura) con totales + top anuncios por contactos.

**Quién ve los datos:**
- **Admin:** todo, en `/admin` → pestaña Métricas (totales + top anuncios).
- **Vendedor (probadita gratis):** 2 números por anuncio (👁️ vistas + 💬 contatos) en su perfil, sobre cada anuncio suyo. RPC `get_my_listings_stats` (filtra por `auth.uid()`). Enganche de retención + crea deseo del Pro. Solo el "cuánto".
- **Reservado para el Pro futuro:** el "cómo/cuándo/por qué" → dashboard de análisis con tendencias por día, últimos 7/30 días, tasa de conversión vista→contato, badge "Verificado".

**Pendiente para activar cuando haya tracción:** todo lo de las secciones anteriores (campos de precio, `is_featured`, panel de precios, suscripción, Mercado Pago).
