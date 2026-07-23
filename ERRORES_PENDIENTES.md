# Errores pendientes — Mercado Ilha

> Lista corta de problemas detectados pero **no resueltos todavía**. No son
> tareas planificadas (esas viven en `historico/planes/OPTIMIZATION_MASTER_PLAN_V2.md` o en
> `MEMORY.md §19`) — son *hallazgos sueltos* que quedaron anotados para no
> perderlos. Regla: si en el camino de otra tarea aparece la oportunidad de
> arreglar uno de estos, mencionarlo o resolverlo de paso; si no, esperar a
> que el usuario pregunte por esta lista.

---

## 1. CLS 0.47 (Poor) en mobile

- **Detectado:** 2026-07-08, Vercel Speed Insights (Mobile, últimas 24h), ANTES
  del deploy de la Fase 1 de `OPTIMIZATION_MASTER_PLAN_V2.md`.
- **Dato:** Cumulative Layout Shift = 0.47 (umbral "Poor" es >0.25; "Good" es <0.1).
  Real Experience Score general: 75 (Needs Improvement).
- **Ruta más señalada:** `/store/[id]` en "Needs Improvement" (score 52) — la única
  ruta con datos suficientes en la ventana de 24h además de `/` (que salió "Great").
- **Sospechosos, sin confirmar todavía:**
  - `BannerRotativo.tsx` — si el banner reserva su alto recién cuando carga la imagen,
    empuja el contenido de abajo al aparecer.
  - Imágenes (`next/image`) sin `width`/`height`/`aspect-ratio` reservado en algún
    punto de `/store/[id]` (galería de fotos del vendedor, avatar).
  - Fuentes o iconos que cambian de tamaño tras la hidratación.
- **Qué falta para resolverlo:** reproducir con Chrome DevTools → Performance
  (o Lighthouse local) en `/store/[id]`, ver qué elemento específico dispara el
  shift, y fijar sus dimensiones/reservar el espacio antes de que cargue.
- **No se tocó todavía** — no formaba parte de la Fase 1 recién desplegada.

---

## Cómo se usa este archivo

- Al cerrar cada sesión de trabajo (vía `/memory`), revisar si algo nuevo detectado
  merece agregarse acá.
- Al arrancar una tarea que toque un archivo/ruta mencionado en esta lista, chequear
  primero si aplica una solución de paso.
- Cuando un ítem se resuelve: mover el resumen a `MEMORY.md §18 BUGS RESUELTOS` (con
  causa raíz + fix + commit) y borrarlo de acá.
