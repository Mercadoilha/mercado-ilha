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
