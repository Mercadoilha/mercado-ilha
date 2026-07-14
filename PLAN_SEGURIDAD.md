# PLAN DE SEGURIDAD — Mercado Ilha

> Plan de remediación de la auditoría de ciberseguridad (Fable 5, 2026-07-11).
> Escrito para que **Opus** (u otro modelo) lo ejecute paso a paso.
> Antes de empezar: leer `CLAUDE.md`, `MEMORY.md` y `manual_fable5.md`.

---

## Reglas globales (aplican a TODAS las fases)

1. **Verificar antes de creer** (manual_fable5 §1): leer el código real antes de tocar;
   confirmar cada arreglo ejercitando el flujo, no solo con `npm run build`.
2. **Pilar de velocidad** (CLAUDE.md): ningún cambio debe degradar la navegación. Tras
   los cambios de código correr `npm run build` y confirmar que las rutas siguen
   `○ Static`/ISR donde corresponde. (Ninguna tarea de este plan afecta la navegación:
   son reglas de base de datos, cabeceras estáticas y validaciones en acciones puntuales.)
3. **SQL para el dueño**: los cambios de base de datos se entregan como archivos
   `supabase/fase-NN-*.sql`. El dueño los corre en **Supabase → SQL Editor → New query →
   pegar → Run**. Indicárselo en lenguaje simple.
4. **Comunicación no técnica** (CLAUDE.md §8): al reportar al dueño, síntesis breve y
   simple; sin nombres de archivos ni funciones.
5. **Orden recomendado**: primero la Fase 1 SQL (cierra los agujeros graves sin necesidad
   de deploy), luego el código, luego el resto. Detalle de orden al final.
6. **No romper nada**: cada tarea incluye por qué el cambio es seguro (qué usa la app hoy).

---

## RESUMEN DE HALLAZGOS (auditados y confirmados)

| # | Severidad | Problema | Fase |
|---|---|---|---|
| H1 | 🔴 Crítico | Un usuario registrado puede ascenderse a **admin** editando su propio perfil | 1 |
| H2 | 🔴 Alto | Un usuario con **un** anuncio puede **borrar fotos de cualquiera** (fallo de autorización en el borrado) | 1 |
| H3 | 🟠 Alto | Cualquier registrado puede **leer todos los WhatsApp** de los vendedores | 1 |
| H4 | 🟠 Medio | Dependencia interna con fallas conocidas (**undici**) | 2 |
| H5 | 🟡 Bajo | Faltan **cabeceras de seguridad** HTTP | 2 |
| H6 | 🟡 Bajo | Emails de vencimiento arman HTML **sin escapar** el título | 3 |
| H7 | 🟡 Bajo | Subida de fotos **sin límite** por usuario | 3 |
| H8 | 🟡 Bajo | Columnas muertas `secret_question`/`secret_answer` en texto plano | 3 |

---

# FASE 1 — CRÍTICO (aplicar YA)

Cierra las tres puertas graves. Un archivo SQL nuevo (T1.0–T1.2) + un cambio de código (T1.3).

Crear `supabase/fase-23-seguridad-critico.sql` con las tareas T1.0, T1.1 y T1.2 en ese orden.

---

## T1.0 — Prerrequisito: `is_admin()` como SECURITY DEFINER

**Por qué:** en T1.2 la política de lectura de `profiles` va a llamar a `is_admin()`.
Como `is_admin()` hace un `select` sobre `profiles`, si la política de lectura también la
llama, se genera **recursión infinita** en RLS. La solución estándar de Supabase es que
`is_admin()` corra con `security definer` (lee `profiles` como dueño, salteando RLS → corta
la recursión). Hoy está definida sin `security definer` (ver `fase-1.sql:106`).

**SQL (primer bloque de `fase-23-seguridad-critico.sql`):**

```sql
-- T1.0 — is_admin() con SECURITY DEFINER (evita recursión de RLS y endurece la función).
-- Misma semántica que antes: devuelve true si el usuario actual es admin.
create or replace function public.is_admin()
returns boolean
stable
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;
```

**Seguro porque:** el valor de retorno no cambia; solo cambia con qué privilegios lee la
tabla. Mejora además todas las demás políticas que ya la usan (listings, banners, reports…).

**Verificación:** después de correr el SQL, confirmar que la app sigue funcionando (home
carga, admin entra). El efecto real se prueba en T1.2.

---

## T1.1 — Trigger anti-escalada de privilegios (H1) 🔴

**Problema:** la política `"Profiles owner update"` (`fase-1.sql:235`) permite a un usuario
editar su propia fila con `using (auth.uid() = id or is_admin())` y **sin `with check` ni
protección de columna**. Resultado: cualquier usuario puede correr
`supabase.from('profiles').update({ role: 'admin' }).eq('id', <su id>)` y volverse admin.

**Causa raíz:** no hay ningún control sobre QUÉ columnas puede cambiar el dueño de la fila.

**Fix:** un trigger `BEFORE UPDATE` que, si el que edita **no** es admin, restaura los valores
previos de `role` e `is_active` (los ignora en silencio). El panel admin cambia esos campos
siendo admin → pasa sin problema.

**SQL (segundo bloque de `fase-23-seguridad-critico.sql`):**

```sql
-- T1.1 — Impide que un usuario no-admin cambie su propio role o is_active.
-- Los usuarios normales editan nombre/whatsapp/avatar; esos campos NO se tocan.
-- El panel admin sí puede cambiarlos porque is_admin() es true para el admin.
create or replace function public.guard_profile_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.role := old.role;
    new.is_active := old.is_active;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_privileged_fields on public.profiles;
create trigger guard_profile_privileged_fields
  before update on public.profiles
  for each row
  execute function public.guard_profile_privileged_fields();
```

**Seguro porque:** los flujos legítimos de usuario (`profile/page.tsx:123` actualiza
`full_name`/`whatsapp`; `AvatarUpload.tsx:101` actualiza `avatar_url`) no tocan `role` ni
`is_active`. El panel admin (`admin/page.tsx:1534` y `:1541`) los cambia siendo admin.

**Verificación (end-to-end, obligatoria):**
1. Con una cuenta de prueba **no admin**, en la consola del navegador ejecutar
   `await supabase.from('profiles').update({ role: 'admin' }).eq('id', '<id de la cuenta>')`.
2. Volver a leer el perfil y confirmar que `role` sigue siendo `'user'`. ✅ = arreglado.
3. Confirmar que el panel admin (con cuenta admin) todavía puede dar/quitar admin a otros.

---

## T1.2 — Cerrar la lectura de perfiles / fuga de WhatsApp (H3) 🟠

**Problema:** la política `"Profiles auth read"` (`security-fix-profiles.sql:9`) usa
`using (auth.uid() is not null)` → **cualquier usuario logueado lee toda la tabla `profiles`**,
incluidas las columnas `whatsapp` de todos. La RPC `get_seller_whatsapp` y la vista
`profiles_public` solo protegen al usuario **anónimo**; a un registrado no lo frenan.

**Causa raíz:** la política da lectura de todas las filas a cualquier autenticado, sin
distinguir "mi fila" de "las de los demás".

**Fix:** restringir el `select` directo sobre `profiles` a **la propia fila o admin**. Los
datos públicos del vendedor ya salen por otros caminos que NO se tocan.

**SQL (tercer bloque de `fase-23-seguridad-critico.sql`):**

```sql
-- T1.2 — Cada usuario lee solo su propia fila de profiles; el admin lee todas.
-- El nombre/avatar públicos del vendedor siguen saliendo por la vista profiles_public,
-- y el teléfono por la RPC get_seller_whatsapp (ambos ya usados por la app).
drop policy if exists "Profiles auth read" on public.profiles;
create policy "Profiles self or admin read"
  on public.profiles
  for select
  using (auth.uid() = id or public.is_admin());
```

**Seguro porque (VERIFICADO en el código):** todas las lecturas públicas de vendedor ya usan
la vista segura, no la tabla:
- `ListingDetailClient.tsx:131` → `from("profiles_public")` (sin whatsapp).
- `store/[id]/StoreClient.tsx:61` → `from("profiles_public")` (sin whatsapp).
- El teléfono se pide con `supabase.rpc("get_seller_whatsapp", …)` (SECURITY DEFINER).

Las lecturas directas de `profiles` restantes son **la propia fila** (`profile/page.tsx:64`,
`publish/PublishForm.tsx:70`, `lib/profileCache.ts:25`) o **el panel admin**
(`admin/page.tsx:1524`, que es admin). Ninguna se rompe.

**Depende de T1.0** (si no, esta política recursiona). Correr T1.0 antes en el mismo archivo.

**Verificación (end-to-end):**
1. Con cuenta de prueba **no admin**:
   `await supabase.from('profiles').select('id,whatsapp').neq('id', '<mi id>')` → debe
   devolver **vacío** (antes devolvía todos). ✅
2. Abrir un anuncio de otro y tocar "Contatar" → el WhatsApp del vendedor **sigue apareciendo**
   (vía RPC). ✅ (no se rompió el contacto).
3. Entrar al panel admin con cuenta admin → la lista de usuarios con sus WhatsApp **sigue
   cargando**. ✅

---

## T1.3 — Fix de autorización en el borrado de archivos (H2) 🔴

**Problema (IDOR):** en `frontend/app/api/delete-file/route.ts`, cuando llega `listingId`,
el endpoint verifica que el usuario sea dueño **de ese `listingId`** (`route.ts:51-60`), pero
después borra el archivo cuya dirección viene en `url` — **sin comprobar que ese `url`
pertenezca al `listingId`**. Un usuario dueño de UN anuncio puede mandar
`{ listingId: <suyo>, url: <foto de otra persona> }` y el server borra la foto ajena de R2.
Como las direcciones de fotos son públicas, se pueden recolectar y borrar en masa.

**Causa raíz:** la autorización se hace sobre un dato (`listingId`) desacoplado del objeto que
realmente se borra (`url`).

**Fix:** derivar la autorización del **propio `url`**. Buscar en `listing_photos` la foto con
ese `photo_url`, obtener su anuncio y confirmar que ese anuncio es del usuario. El `listingId`
que manda el cliente deja de usarse para autorizar (se puede ignorar).

**Archivo:** `frontend/app/api/delete-file/route.ts`. Reemplazar el bloque `if (!isAdmin) { … }`
(actualmente `route.ts:50-67`) por una autorización basada en el `url`:

```ts
if (!isAdmin) {
  if (listingId != null) {
    // Foto de anuncio: el url debe pertenecer a un anuncio del usuario.
    // (Se ignora el listingId declarado por el cliente: la autoridad es el url real.)
    const { data: photo } = await supabaseAdmin
      .from("listing_photos")
      .select("listings!inner(user_id)")
      .eq("photo_url", url)
      .limit(1)
      .maybeSingle();
    const ownerId = (photo?.listings as any)?.user_id;
    if (!ownerId || ownerId !== user.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }
  } else {
    // Avatar: el url debe ser el avatar actual del propio usuario.
    if (!profile?.avatar_url || profile.avatar_url !== url) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }
  }
}
```

**Seguro porque (VERIFICADO en los 4 llamadores):** todos borran la foto en R2 **mientras la
fila `listing_photos` todavía existe**, así que la búsqueda por `photo_url` la encuentra:
- `EditListingForm.tsx:326` llama al endpoint y recién después borra las filas
  (`listing_photos.delete()` en `:333`).
- `profile/page.tsx:154` y `admin/page.tsx:423` leen las fotos y borran R2 antes de borrar el
  anuncio (la cascada elimina las filas después).
- `AvatarUpload.tsx:92` no manda `listingId` → rama avatar, y borra el avatar viejo **antes**
  de actualizar `avatar_url` (`:101`), así que `profile.avatar_url === url` sigue siendo cierto.
- El caso admin sigue pasando por el `isAdmin` (bypass) sin cambios.

**Verificación (end-to-end):**
1. Con dos cuentas de prueba (A dueña del anuncio 1, B dueña del anuncio 2): estando logueado
   como B, llamar a `/api/delete-file` con `{ listingId: <anuncio 2 de B>, url: <foto del
   anuncio 1 de A> }` → debe responder **403** y la foto de A **sigue existiendo**. ✅
2. Editar un anuncio propio y quitar una foto → se borra normal. ✅
3. Cambiar el avatar propio → el avatar viejo se borra normal. ✅

---

# FASE 2 — DEPENDENCIAS Y CABECERAS (rápido, bajo riesgo)

## T2.1 — Actualizar dependencia con fallas (H4) 🟠

**Problema:** `npm audit` reporta `undici` (severidad alta, varias CVE) en el árbol de
producción. Hay fix **no disruptivo**.

**Pasos:**
1. `cd frontend`
2. `npm audit` → anotar el estado antes.
3. `npm audit fix` (SIN `--force`; `--force` subiría a Next 16 y rompería, **no usarlo**).
4. `npm audit` → confirmar que `undici` ya no aparece (postcss moderate puede quedar; es solo
   de build, aceptable).
5. `npm run build` → debe pasar igual.
6. Commitear el `package-lock.json` actualizado.

**Nota:** `next@14.2.35` está por encima del umbral del bypass de middleware (CVE-2025-29927,
parcheado en 14.2.25) → **no** requiere acción urgente. No subir a 16 en esta tarea.

## T2.2 — Cabeceras de seguridad HTTP (H5) 🟡

**Problema:** no hay cabeceras de seguridad (`next.config.mjs` y `vercel.json` no las definen).

**Fix:** agregar `async headers()` en `frontend/next.config.mjs` (dentro del objeto
`nextConfig`, junto a `images`):

```js
async headers() {
  return [
    {
      source: "/:path*",
      headers: [
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    },
  ];
}
```

**No incluir un CSP estricto en esta tarea:** la app usa estilos inline y un script inline en
`layout.tsx:59`; un CSP mal calibrado rompería la página. `X-Frame-Options` ya cubre el
clickjacking. Un CSP con pruebas queda como mejora futura (anotarlo, no implementarlo a ciegas).

**Verificación:** `npm run build` pasa; tras deploy, revisar en las DevTools (pestaña Network,
respuesta del documento) que aparezcan las cabeceras. Confirmar que la app se ve y navega igual
(pilar de velocidad).

---

# FASE 3 — HIGIENE Y HARDENING (menor)

## T3.1 — Escapar HTML en los emails del cron (H6) 🟡

**Problema:** en `frontend/app/api/cron/expire-listings/route.ts`, `buildExpiredEmail` y
`buildDeletionWarningEmail` interpolan `l.title` y `name` en el HTML sin escapar
(`route.ts:99`, `:143`, y los `${name}` en el cuerpo). El email va solo al propio dueño
(riesgo bajo), pero es buena higiene.

**Fix:** agregar un helper y usarlo en título y nombre.

```ts
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
```

Aplicarlo donde se arma el HTML: `escapeHtml(l.title)` en los `map(...)` de `listItems`, y
`escapeHtml(name)` y `escapeHtml(listings[0].title)` en los `subject`/cuerpo. (El `subject` es
texto plano, escaparlo no molesta y es consistente.)

**Verificación:** `npm run build` pasa. Opcional: correr el cron manualmente con el
`CRON_SECRET` en local y revisar que el email se arma bien con un título que tenga `<` o `&`.

## T3.2 — Límite de subida por usuario (H7) 🟡 — *prioridad más baja, decisión del dueño*

**Problema:** `/api/upload` exige sesión, valida tipo, tamaño (10 MB) y carpeta, pero no limita
**cuántas** subidas hace un usuario → un registrado podría subir masivamente y generar costo/
espacio en R2.

**Fix propuesto (durable, encaja con el stack):**
1. Nuevo `supabase/fase-24-upload-rate-limit.sql`: tabla `upload_events(user_id uuid,
   created_at timestamptz default now())` con índice `(user_id, created_at)`, RLS habilitado y
   **sin** políticas para anon/authenticated (solo el service role la escribe/lee).
2. En `frontend/app/api/upload/route.ts`, tras validar la sesión y antes de subir: con el
   cliente service-role, contar eventos del usuario en la última hora; si supera un umbral
   (ej. **60/hora**) responder `429`. Tras subir OK, insertar un evento.
3. Podarla desde el cron (agregar a `prune_tracking` o borrar `< now() - 1 día`).

**Tradeoff (pilar de velocidad):** agrega una consulta a la ruta de subida (NO a la
navegación). Es aceptable porque la subida ya es una acción de red pesada. Si el dueño prefiere
no sumar complejidad ahora, **se puede diferir**: es de severidad baja y requiere una cuenta.
Preguntar al dueño si quiere implementarlo o dejarlo anotado como pendiente.

**Verificación:** subir 3-4 fotos normalmente sigue funcionando; superar el umbral devuelve 429.

## T3.3 — Eliminar columnas muertas de "pregunta secreta" (H8) 🟡

**Problema:** `secret-question.sql` agregó `secret_question`/`secret_answer` (respuesta en texto
plano). **VERIFICADO:** ningún archivo del frontend ni RPC las usa (búsqueda sin resultados).
Son columnas muertas; si tuvieran datos, serían legibles y en texto plano.

**Fix:** nuevo `supabase/fase-25-drop-secret-question.sql`:

```sql
-- Elimina campos de "pergunta secreta" que quedaron sin uso (recuperación de senha
-- hoy es por código al email, ver forgot-password/page.tsx).
alter table public.profiles drop column if exists secret_question;
alter table public.profiles drop column if exists secret_answer;
```

**Antes de correrlo:** reconfirmar con `grep -rn "secret_answer\|secret_question" frontend
supabase` que nada los usa fuera de `secret-question.sql`. Si aparece uso, **frenar y avisar**.

**Verificación:** `npm run build` pasa; registro/login/recuperación de senha siguen funcionando.

---

# FASE 4 — VERIFICACIÓN INTEGRAL Y DEPLOY

1. `cd frontend && npm run build` → pasa, y las rutas afectadas siguen `○ Static`/ISR (pilar de
   velocidad). Revisar especialmente que `/`, `/listings`, `/store/[id]`, `/listings/[id]` no
   hayan cambiado de tipo de render.
2. Repasar los checklists de verificación end-to-end de T1.1, T1.2, T1.3 con cuentas de prueba.
3. Confirmar que **no quedaron restos** (console.log de debug, código comentado).
4. `git add` de: `supabase/fase-23-*.sql` (+ `fase-24`, `fase-25` si se hicieron),
   `frontend/app/api/delete-file/route.ts`, `frontend/next.config.mjs`,
   `frontend/app/api/cron/expire-listings/route.ts`, `frontend/package-lock.json`
   (+ `frontend/app/api/upload/route.ts` si se hizo T3.2).
5. Commit descriptivo (ej. `fix(seguridad): corrige escalada de rol, borrado ajeno y fuga de
   contactos; hardening`) con el `Co-Authored-By` del proyecto.
6. Deploy (push a `origin main` → Vercel), como en `/memory`.
7. Actualizar `MEMORY.md` del repo con el registro del cambio de seguridad.

---

## ORDEN DE EJECUCIÓN RECOMENDADO

1. **El dueño corre `fase-23-seguridad-critico.sql`** en Supabase → cierra H1 y H3 al instante,
   sin esperar deploy.
2. **Opus** hace T1.3 (código), Fase 2 y Fase 3.1 → build → commit → deploy → cierra H2, H4, H5, H6.
3. **El dueño corre `fase-25-drop-secret-question.sql`** (H8), en cualquier momento.
4. **T3.2 (H7)**: implementar solo si el dueño lo aprueba (tiene un pequeño costo de latencia en
   la subida); si no, dejar anotado como pendiente en MEMORY.md.

## Instrucciones simples para el dueño (SQL)

> Para cada archivo `fase-NN-*.sql` que te pasemos:
> 1. Entrá a **Supabase** → tu proyecto → menú **SQL Editor** → **New query**.
> 2. Pegá todo el contenido del archivo.
> 3. Apretá **Run** (abajo a la derecha). Si dice *Success*, listo.
> Corré primero el `fase-23` (es el importante). Los otros dos van después, en cualquier orden.

---

## Qué NO es un problema (auditado, para no perder tiempo)

- La tabla `conversations` que consulta el panel admin **sí existe** (`fase-2.sql:14`, chat
  viejo sin uso) → el endpoint de stats no falla por eso.
- El `dangerouslySetInnerHTML` de `layout.tsx:59` usa un texto **fijo** (detección de Android),
  no entra dato de usuario → no es XSS.
- La búsqueda está **blindada** contra inyección de filtros PostgREST: `foldWords`
  (`lib/searchNorm.ts:17`) elimina `,()"'\` antes de armar el `.or()`.
- Las **claves secretas** (service role, R2, Resend, cron) son solo de servidor, sin prefijo
  `NEXT_PUBLIC`, y `.env.local` está en `.gitignore` (no subido).
- El teléfono del vendedor está oculto para visitantes **anónimos** (vista + RPC).
