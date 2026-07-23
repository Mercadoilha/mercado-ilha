# Prompt para Opus — Fixes Android (pantalla vendedor + instalación directa)

Antes de empezar: leé CLAUDE.md, MEMORY.md y manual_fable5.md del proyecto. Aplicá el
método de trabajo (verificar antes de creer, causa raíz, checklist de cierre). Mostrá un
plan breve y esperá OK antes de cambios no triviales. Respetá el pilar de velocidad.

Hay dos problemas reportados por el dueño tras probar la app en un teléfono Android real.

---

## Problema 1 — La página del vendedor (loja) se ve distinta en Android que en iPhone

**Síntoma:** en Android, los botones de la cabecera de la loja del vendedor —
"💬 Falar com o vendedor" y "Compartilhar loja" — aparecen desacomodados (distinto
acomodo que en iPhone, donde se ven bien).

**Dónde:** `frontend/app/store/[id]/StoreClient.tsx`. Los dos botones están en un
contenedor `display: flex; flexWrap: "wrap"; justifyContent: "center"` (~línea 224).

**Hipótesis a verificar (no asumir):** con `flexWrap: "wrap"`, si el ancho combinado de
los dos pills no entra en una fila, el segundo baja de línea. En Android la fuente del
sistema (Roboto) rinde más ancha que en iOS (SF), y eso puede hacer que en Android
wrapee y en iPhone no. Verificar contra el código y reproducir (DevTools con viewport
angosto ~360px + user agent Android) antes de tocar nada.

**Requisito de producto:** la pantalla debe verse IGUAL en Android y en iPhone (mismo
acomodo de botones). La única diferencia permitida entre plataformas son las
particularidades del flujo de instalación (Problema 2). La solución debe ser robusta e
independiente de las métricas de fuente del sistema operativo (por ejemplo: permitir
que los botones se encojan, ajustar padding/tamaño, o definir un acomodo fijo que sea
idéntico en ambas plataformas — decidir mirando el diseño real).

**Revisar también:** la página de detalle del anuncio
(`frontend/app/listings/[id]/ListingDetailClient.tsx`, botones "Contatar pelo WhatsApp"
y "Compartilhar anúncio") y cualquier otra fila de botones similar, por si sufren el
mismo problema de wrap dependiente de plataforma.

---

## Problema 2 — En Android, TODO botón "Instalar App" debe instalar directo (sin pantalla intermedia)

**Regla de producto (sin excepciones):**
- **Android:** cualquier CTA de instalar (popup del home, franja, botón en /instalar,
  cualquier uso de `InstallCtaButton`) debe disparar el prompt nativo de Chrome e
  instalar en el acto. **En Android NO existe pantalla de instrucciones**: jamás derivar
  a `/instalar` ni a ninguna otra pantalla, en ningún caso. Si instalar no es posible
  (app ya instalada, Chrome no lo permite), el CTA no se muestra.
- **iPhone:** única excepción — va a la pantalla guiada `/instalar` (Chrome→Safari,
  video). Este flujo NO se toca. La pantalla `/instalar` es exclusiva de iPhone.

**Síntoma:** en un Android real, el popup de invitación del home
(`frontend/components/InstallInvitePopup.tsx`) mostró "Instalar App", pero al tocarlo
llevó a la pantalla `/instalar` en vez de instalar; recién ahí, tocando de nuevo, instaló.

**Contexto del código (ya existe un fix parcial, commit 9878ae4):**
- `frontend/app/layout.tsx` tiene un script inline en `<head>` que captura
  `beforeinstallprompt` globalmente en `window.__deferredInstallPrompt` y emite el
  evento `bip-ready`.
- `frontend/lib/installPrompt.ts` expone `getInstallPrompt()`, `triggerInstall()` y
  `onInstallPromptChange()` (suscripción a `bip-ready` / `appinstalled`).
- `frontend/components/InstallCtaButton.tsx` (handleClick): si es Android y
  `getInstallPrompt()` devuelve el evento → `triggerInstall()`; si no → fallback
  `router.push("/instalar")`.

**Causa probable (verificar):** el popup aparece ~1.4s después del load; en ese momento
Chrome todavía no había disparado `beforeinstallprompt` (el navegador puede demorarlo).
`getInstallPrompt()` devolvió null → el botón cayó al fallback `/instalar`. Cuando el
usuario llegó a `/instalar`, el evento ya había sido capturado, por eso ahí sí instaló
directo. Es un problema de timing, no de captura.

**Fix requerido (DECISIÓN CONFIRMADA por el dueño — no es opcional):**
- En Android, el popup de invitación NO debe aparecer hasta que el prompt de instalación
  esté disponible. Puede demorar lo que haga falta: se espera `bip-ready` (vía
  `onInstallPromptChange` o chequeando `getInstallPrompt()`) sin límite de tiempo, y
  recién cuando el prompt está capturado se muestra el popup. Así el tap SIEMPRE instala
  directo. Mantener el diferimiento mínimo actual (~1.4s) como piso para no afectar el
  LCP; la espera del prompt se suma a eso.
- Si Chrome nunca emite el evento (criterios de instalabilidad no cumplidos, app ya
  instalada, etc.), el popup simplemente no aparece en Android — no mostrar un popup
  cuyo botón derive a otra pantalla.
- El contador "1 vez por día" (localStorage) debe registrarse cuando el popup
  efectivamente se muestra, no antes.
- Botones de instalar fijos en pantalla (fuera del popup) — DECISIÓN CONFIRMADA por el
  dueño: siguen siempre visibles (solo se ocultan si la app ya está instalada — regla
  general de todos los CTAs de instalar). Si el usuario los toca "a destiempo" (antes
  de que el prompt esté capturado), NO navegar a ninguna pantalla: mostrar en la parte
  superior de la pantalla un indicador de progreso animado (una línea que avanza) con
  el texto "Preparando a instalação…" mientras se espera `bip-ready`. Al llegar el
  prompt, disparar `prompt()` automáticamente — SIN pedir otro toque — si la user
  activation del tap original sigue vigente (ventana de pocos segundos; en el caso
  normal el prompt llega dentro de ella). El diálogo nativo aparece solo y, si el
  usuario acepta, Android muestra su propio progreso de instalación arriba y termina
  solo (comportamiento nativo, no construirlo).
  - Solo si el prompt llega DESPUÉS de que expiró la activation (caso raro), no fallar
    en silencio: el indicador pasa a "Pronto — toque para instalar" y ese único toque
    extra instala. Verificar con prueba real qué tan larga es la ventana en Chrome
    Android actual y ajustar.
  - En la práctica el usuario recién entra y tarda unos segundos en llegar al botón,
    así que todo este camino será poco frecuente; no debe agregar peso a la carga
    inicial (cargar el indicador en forma diferida/lazy).
- **Nunca navegar a `/instalar` en Android** — el fallback actual de `InstallCtaButton`
  (`router.push("/instalar")`) debe eliminarse para Android en todos los casos.
- Si un usuario Android llega a `/instalar` por URL directa, el botón de esa pantalla
  también instala directo (ya funciona así); pero ningún flujo de Android debe
  llevarlo ahí.
- **Post-cadastro (revisar y corregir):** en `frontend/app/signin/page.tsx` (~línea
  137), tras crear la cuenta con sesión se hace `router.push(isStandalone() ? "/" :
  "/instalar")`. En Android eso viola la regla: no debe ir a `/instalar`. Ajustar el
  flujo Android post-cadastro para que la invitación a instalar sea directa (por
  ejemplo: ir al home y mostrar la invitación de instalar cuando el prompt esté listo,
  sin contar contra el límite de 1×/día en este caso — proponer la mejor variante).
  En iPhone el post-cadastro sigue yendo a `/instalar` como hasta ahora.
- Aplicar la regla a TODOS los puntos de entrada de instalación en Android, no solo al
  popup.
- En iPhone el popup sigue exactamente como está (no depende de `beforeinstallprompt`).

**No romper:** el flujo iPhone (popup 1×/día, /instalar con video Safari), la detección
de app ya instalada (`isAppInstalled`), ni el LCP del home (el popup se monta diferido
justamente para no afectar la carga — mantener eso).

---

## Cierre (obligatorio)
1. `npm run build` sin errores y sin degradar rutas estáticas/ISR.
2. Probar en un Android real o emulador: (a) la loja del vendedor se ve igual que en
   iPhone; (b) el popup de instalar y todo botón "Instalar App" instalan directo.
3. Commit con mensaje claro y actualizar MEMORY.md del proyecto.
4. Explicar al dueño en lenguaje simple qué se corrigió (sin detalles técnicos).
