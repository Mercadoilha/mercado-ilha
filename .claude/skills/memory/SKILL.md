---
name: memory
description: Cierra la sesión de Mercado Ilha — registra lo hecho en el MEMORY.md del propio repo y luego lleva los cambios a producción (build + commit + push a origin main → deploy en Vercel). Todo el registro queda dentro del proyecto, nada por fuera. Invocar con /memory al terminar de trabajar.
---

# /memory — Registrar sesión y desplegar a producción

Skill de cierre de sesión para **Mercado Ilha**. Corre en dos fases: primero **actualiza la
memoria del proyecto** con lo que se hizo en la sesión, después **lleva a producción** lo
realizado. Siempre en ese orden (memoria antes que deploy: si el build falla, la memoria ya
quedó guardada).

**Importante — alcance de la memoria:** todo el registro vive **dentro del repo**, en
`MEMORY.md` (raíz del proyecto). No se escribe en la carpeta de auto-memoria externa de Claude
(fuera del proyecto) — el usuario prefiere que la memoria de este proyecto quede contenida
únicamente en el proyecto.

Idioma: hablar con el usuario en **español**. Mensajes de commit y todo lo visible en
código/UI en **portugués brasileño** (convención del repo).

---

## FASE 1 — Actualizar la memoria (dentro del repo)

### 1.1 Reconstruir qué se hizo en la sesión
- Revisar `git status` y `git diff` (staged + unstaged) para ver los archivos tocados.
- Combinar con lo que se recuerda de la conversación: qué se pedía, qué se cambió y **por qué**.
- Resumir en 1–3 puntos concretos (no genérico: nombres de archivos, funciones, decisiones,
  SQL corrido o pendiente de correr).

### 1.2 Editar `MEMORY.md` (raíz del repo, fuente de verdad)
- **§21 CHANGELOG DE SESIONES** (al final del archivo): SIEMPRE agregar una línea nueva arriba
  de todo, con fecha absoluta de hoy, commit(s) si ya se hizo el push, y qué cambió. Es el
  registro cronológico de cada cierre de sesión.
- **Sección numerada correspondiente** (§1 QUÉ ES … §20 CORRER LOCALMENTE): si el cambio es
  durable/estructural — nueva feature, cambio de arquitectura, nueva tabla/columna DB, nueva
  ruta, decisión de diseño — editar la sección que corresponda. Si no existe una sección para el
  tema, considerar si amerita una nueva (numerarla siguiendo la secuencia) o si alcanza con una
  línea en la sección más cercana.
- **§18 BUGS RESUELTOS — LECCIONES**: si se resolvió un bug con causa raíz no obvia, agregar una
  entrada corta ahí (patrón ya usado en el archivo: problema + causa + fix + commit).
- **§19 PENDIENTES / IDEAS**: mover ahí cualquier tarea que quedó pendiente (SQL sin correr,
  feature a medio camino, algo que el usuario pidió para después). Sacar de ahí lo que se
  completó en la sesión.
- Convertir fechas relativas ("hoy", "ayer") a absolutas. Mantener el estilo conciso ya usado en
  el documento — no reescribir secciones enteras, solo editar/agregar lo necesario.

### 1.3 Confirmar
Mostrar al usuario en 2–4 líneas qué secciones de `MEMORY.md` se actualizaron y con qué resumen.

---

## FASE 2 — Llevar a producción

El único deployable es `frontend/`. Deploy = **commit + push a `origin main`** → Vercel
auto-despliega (región `gru1`). No hay comando manual de deploy; el push dispara el build en
Vercel.

### 2.1 Verificar el build (PILAR DE VELOCIDAD)
```bash
cd "/Users/leo.cufone/Desktop/IA/Mercado Ilha/frontend" && npm run build
```
- Debe terminar sin errores.
- Revisar que las rutas que deben ser estáticas/ISR sigan marcadas `○ (Static)` / con revalidate,
  y que ninguna que era estática pasara a `ƒ (Dynamic)` sin motivo. Si una ruta se volvió dinámica
  por el cambio, **parar y avisar** antes de desplegar (degrada la velocidad de navegación).
- Si el build falla: **NO** hacer commit/push. Reportar el error y detener la fase 2. La memoria
  de la fase 1 ya quedó guardada.

### 2.2 Preparar el commit
- `git add -A` (incluye código + `MEMORY.md`, todo dentro del repo).
- Redactar el mensaje en **portugués**, siguiendo la convención del repo: `feat: …` para
  features, `fix: …` para correcciones. Una línea descriptiva y concreta.
- Terminar el cuerpo del commit con:
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  ```

### 2.3 Punto de confirmación (antes del push)
Mostrar al usuario: el mensaje de commit propuesto y un resumen de 1 línea de los archivos que
se van a subir. Pedir OK explícito antes del `git push` (es una acción hacia afuera / a
producción). Si el usuario ya dijo "hacelo todo" o similar en la sesión, se puede proceder sin
volver a preguntar.

### 2.4 Push y deploy
```bash
git commit -m "…" && git push origin main
```
Vercel detecta el push y despliega automáticamente. Estás en `main` (rama de producción); no
crear rama salvo que el usuario lo pida.

### 2.5 Reportar
- Confirmar que el push salió y que Vercel está desplegando.
- Listar **qué probar y dónde**: URLs de producción afectadas (`https://mercadoilha.vercel.app/…`)
  y, si quedó SQL pendiente de correr en Supabase, recordarlo con instrucciones simples (el
  usuario no es técnico: decir exactamente qué archivo `.sql` correr en el SQL Editor).
- Si en el paso 2.4 se hizo push, volver a `MEMORY.md` §21 y completar la línea del changelog con
  el hash del commit (editar la línea recién agregada en 1.2, no crear una nueva).

---

## Reglas
- Fase 1 antes que fase 2, siempre.
- Todo el registro de memoria queda **dentro del repo** (`MEMORY.md`). No escribir en la carpeta
  de auto-memoria externa de Claude Code (`~/.claude/projects/.../memory/`) para esta skill.
- Nunca hacer push si el `npm run build` falló.
- No inventar cambios: la memoria refleja lo que realmente se hizo en la sesión (verificable en
  `git diff`).
- Si en la sesión no hubo cambios de código (solo lectura/análisis), igual actualizar `MEMORY.md`
  si surgió algo durable, pero saltar la fase 2 (nada que desplegar) y avisarlo.
