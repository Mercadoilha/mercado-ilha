# Multi-categoría — un anuncio en varias categorías/subcategorías

> Cómo funciona la función que permite que **un mismo anuncio aparezca en varias
> categorías y subcategorías** sin tener que publicarlo varias veces.
> Implementado el 2026-07-02 (fase-15).

---

## 1. Idea en una frase

Cada anuncio tiene **una categoría principal** (la de siempre, en `listings.category_id` /
`listings.subcategory_id`) **+ hasta 4 categorías secundarias** guardadas en una tabla aparte.
Las secundarias son **solo para descubrimiento**: hacen que el aviso también aparezca en esos
filtros, pero **no cambian nada del comportamiento** del anuncio.

**La categoría PRINCIPAL sigue mandando** en todo:
- el texto del botón de contacto (`contact_button_text`),
- el mensaje de WhatsApp pre-armado (`whatsapp_message`),
- el tipo de ubicación (`location_type`: fija / zonas de atención),
- la fecha de expiración (`expires_at`).

Las secundarias **no afectan** ninguna de esas cosas. Solo dicen "mostrame también acá".

---

## 2. Modelo de datos

Tabla nueva: **`public.listing_extra_categories`** (definida en
[`supabase/fase-15-multi-categoria.sql`](supabase/fase-15-multi-categoria.sql)).

| Columna          | Tipo   | Notas                                                        |
|------------------|--------|-------------------------------------------------------------|
| `id`             | bigint | PK                                                          |
| `listing_id`     | bigint | FK → `listings(id)` · `on delete cascade`                   |
| `category_id`    | bigint | FK → `categories(id)` · `on delete cascade`                 |
| `subcategory_id` | bigint | FK → `subcategories(id)` · `on delete cascade` · **nullable** |
| `created_at`     | timestamptz | default now()                                          |

- `unique(listing_id, category_id)` → un anuncio no puede repetir la misma categoría secundaria.
- `subcategory_id` es **null** cuando la categoría secundaria elegida **no tiene** subcategorías.
- **Índices**: `ix_lec_category (category_id, subcategory_id)` para el filtro, y
  `ix_lec_listing (listing_id)` para el borrado en cascada.

**Borrado automático (cascade):**
- Si se borra el anuncio → se borran sus filas secundarias.
- Si un admin borra una categoría o subcategoría → desaparecen las referencias a ella.
- No queda basura huérfana ni hace falta limpieza manual.

**RLS (seguridad):**
- Lectura **pública** (los tags de categoría no son sensibles).
- Escritura **solo del dueño del anuncio o admin** (mismo criterio que `listing_service_zones`).

> ⚠️ La tabla `listings` **no se tocó**: `category_id` y `subcategory_id` siguen siendo la
> categoría principal, y todo el comportamiento anterior quedó intacto.

---

## 3. Archivos involucrados

| Archivo | Rol |
|---------|-----|
| [`supabase/fase-15-multi-categoria.sql`](supabase/fase-15-multi-categoria.sql) | Tabla + índices + RLS. Ya ejecutado en Supabase. |
| [`frontend/components/ExtraCategoriesPicker.tsx`](frontend/components/ExtraCategoriesPicker.tsx) | Componente UI compartido ("Aparecer também em"). |
| [`frontend/app/publish/PublishForm.tsx`](frontend/app/publish/PublishForm.tsx) | Publicar: elegir secundarias + insert. |
| [`frontend/app/listings/[id]/edit/page.tsx`](frontend/app/listings/[id]/edit/page.tsx) | Editar: precarga + replace al guardar. |
| [`frontend/app/listings/page.tsx`](frontend/app/listings/page.tsx) | Filtro de listados: incluye principal **o** secundaria. |

---

## 4. Cómo funciona cada parte

### 4.1 El componente `ExtraCategoriesPicker`
- Recibe la lista de categorías, la **categoría principal** (para excluirla) y el array de
  entradas (`extraEntries`).
- Cada entrada es `{ categoryId, subcategoryId, hasSubcats? }`.
- Al elegir una categoría secundaria, carga sus subcategorías **on-demand** (misma consulta que
  el formulario principal) y solo muestra el select de subcategoría si esa categoría tiene.
- `hasSubcats` se completa solo cuando se cargan las subcategorías; sirve para que el formulario
  sepa si la subcategoría es obligatoria.
- Excluye del dropdown la categoría principal y las ya elegidas en otras filas (no se repiten).
- Máximo 4 entradas (`max` por defecto = 4). Reutiliza clases del formulario (`.card`,
  `.form-group`, `.form-select`) → sin estilos nuevos.

### 4.2 Publicar ([PublishForm.tsx](frontend/app/publish/PublishForm.tsx))
1. Estado `extraEntries`. La sección se muestra apenas hay una categoría principal elegida.
2. Un `useEffect` quita cualquier secundaria que coincida con la principal (evita duplicar).
3. En el submit valida: si una secundaria tiene subcategorías, la subcategoría es obligatoria.
4. Después de insertar el `listing`, inserta las filas en `listing_extra_categories`
   (`subcategory_id = null` si la categoría no tiene subcategorías).

### 4.3 Editar ([edit/page.tsx](frontend/app/listings/[id]/edit/page.tsx))
1. Al cargar el anuncio, precarga las secundarias existentes en `extraEntries`.
2. Al guardar usa estrategia **replace**: `delete` de todas las filas del anuncio + `insert`
   de las nuevas (mismo patrón que las zonas de atención). Simple y sin diffs.

### 4.4 Filtro de listados ([listings/page.tsx](frontend/app/listings/page.tsx))
Cuando entrás a `/listings?category=<slug>` (con o sin `&subcategory_id=<n>`):
1. Resuelve el `slug` → `category_id` (y de paso la etiqueta del encabezado).
2. Busca en `listing_extra_categories` los `listing_id` que tengan esa categoría
   (y subcategoría, si se filtró) como **secundaria**.
3. Arma la consulta con un OR:
   ```
   category_id.eq.<catId>                          (o and(category_id, subcategory_id) si hay subcat)
   OR id.in.(<ids de los que la tienen como secundaria>)
   ```
   Es decir: **muestra los que la tienen como principal + los que la tienen como secundaria.**
4. Este `.or()` de categoría convive con el `.or()` del filtro de zona: en PostgREST, dos
   `.or()` distintos se combinan con **AND** entre ellos (ambos deben cumplirse).

---

## 5. Reglas de negocio (resumen)

- **1 principal + hasta 4 secundarias** = máximo 5 categorías por anuncio.
- En una categoría secundaria, **elegir subcategoría es obligatorio si esa categoría tiene
  subcategorías** (mismo criterio que la principal). Si no tiene, se guarda con `subcategory_id`
  nulo y el anuncio aparece en la categoría pero no bajo un filtro de subcategoría.
- Una categoría no puede ser principal y secundaria a la vez (se filtra en la UI + `unique`).
- Las secundarias **nunca** cambian botón, mensaje de WhatsApp, ubicación ni expiración.

---

## 6. Qué NO cambió

- Comportamiento del aviso (botón, WhatsApp, ubicación, expiración) → 100% de la principal.
- Home (`app/page.tsx`) y perfil-tienda (`/store/[id]`) → muestran recientes / por vendedor,
  sin filtro por categoría → sin cambios.
- Favoritos, búsqueda por texto (`?q=`), cron de expiración → sin cambios.

---

## 7. Diagnóstico / troubleshooting

**"Publiqué en varias categorías pero no aparece en la secundaria."**
1. Confirmá que existe la fila en la tabla:
   ```sql
   select * from public.listing_extra_categories where listing_id = <ID_DEL_ANUNCIO>;
   ```
2. Si no hay fila → falló el insert. Revisá RLS: el insert lo hace el **dueño** del anuncio
   (política "owner write"). Si estás probando con otro usuario, no se inserta.
3. Si hay fila pero no aparece en `/listings?category=<slug>&subcategory_id=<n>`, verificá que
   el `subcategory_id` de la fila coincide con el del filtro (o es null si filtrás sin subcat).

**"Aparece duplicado en la lista."**
- No debería: la consulta filtra `listings` una sola vez (el OR no hace join que multiplique).
  Si pasa, revisá que no haya lógica adicional de merge en el front.

**"Quiero ver todas las categorías (principal + secundarias) de un anuncio."**
```sql
select l.id, l.title,
       pc.name as principal,
       c.name  as secundaria,
       s.name  as subcategoria_secundaria
from public.listings l
join public.categories pc on pc.id = l.category_id
left join public.listing_extra_categories lec on lec.listing_id = l.id
left join public.categories c    on c.id = lec.category_id
left join public.subcategories s on s.id = lec.subcategory_id
where l.id = <ID_DEL_ANUNCIO>;
```

**"Borré una categoría en el admin y quiero saber si afectó anuncios."**
- Las filas secundarias que apuntaban a esa categoría se borraron solas (cascade). Los anuncios
  cuya **principal** era esa categoría es otro tema (la FK de `listings.category_id` no tiene
  cascade de borrado; en la práctica no se borran categorías con anuncios principales).

---

## 8. Posible mejora futura (no implementada)

Mostrar en el **detalle del anuncio** (`app/listings/[id]/page.tsx`) unos chips con las
categorías secundarias además de la principal. Es puramente visual; la funcionalidad ya
funciona sin eso.
