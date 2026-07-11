# PROMPT — Rework completo del flujo "Instalar App" (PWA)

> Prompt para Claude Opus. Proyecto: **Mercado Ilha** (leer `CLAUDE.md` y `MEMORY.md`
> antes de empezar; respetar el pilar de velocidad de navegación). Código y UI en
> portugués brasileño. Antes de implementar, mostrar plan breve y esperar OK.

## Objetivo de negocio
Maximizar la cantidad de usuarios que **instalan la PWA** en su celular. Hoy los
llamados a instalar son tímidos (sobre todo en iPhone) y no hay un momento dedicado a
la instalación. Este trabajo crea un flujo de instalación prominente, con el branding
de Mercado Ilha, sin degradar la velocidad de navegación.

## Estado actual (verificado en el código)
- `frontend/lib/platform.ts` — `detectPlatform()` (android/ios/other), `isStandalone()`,
  tipo `BeforeInstallPromptEvent`. **No detecta navegador** (Chrome vs Safari en iOS).
- `frontend/components/InstallInstructions.tsx` — componente compartido:
  - Android: botón "Instalar agora" (fondo `var(--sand)`) que dispara el prompt nativo.
  - iOS: texto explicativo + video `/public/videos/instalar-safari.mp4` + nota para
    iPhones antiguos + link de ayuda por WhatsApp del admin.
- `frontend/components/InstallAppCard.tsx` — card colapsable "📲 Instale o Mercado Ilha
  no seu celular". Usada en el home (`HomeClient.tsx:333`) y en el perfil
  (`app/profile/page.tsx:405`).
- `frontend/components/InstallAppBanner.tsx` — banner con dismiss (TTL 7 días,
  localStorage `install_banner_dismissed_at`). Usado solo en `app/signin/page.tsx`.
- Registro (cadastro): ocurre en `app/signin/page.tsx` (toggle login/registro). Tras
  `signUp` exitoso: si requiere confirmación de email muestra mensaje de éxito; si ya
  hay sesión hace `router.push("/")` (~línea 134).
- No existe ninguna ruta dedicada a instalación.

---

## TAREAS

### T1 — Nueva pantalla dedicada de instalación: ruta `/instalar`
Crear una pantalla nueva, a pantalla completa, dedicada exclusivamente a instalar la
app, con el **branding de Mercado Ilha** (logo, paleta `#185FA5` / `#EF9F27`, fondos
`#E6F1FB`/`#B5D4F4`; ver `globals.css` y `MEMORY.md` §diseño). Diseño cuidado y
vendedor: esta pantalla es el momento clave de conversión.

Contenido según plataforma (reutilizar `detectPlatform()` y la lógica existente de
`InstallInstructions`, refactorizando lo necesario):
- **Android**: título/beneficio breve + botón grande **"Instalar App"** que dispara el
  prompt nativo (`beforeinstallprompt`). Instalación automática como hoy.
- **iPhone**: la información actual de instalación + el video
  `/videos/instalar-safari.mp4` (incluida la nota de iPhones antiguos y el link de
  ayuda por WhatsApp). Ver T6 para el caso Chrome-en-iOS.
- **Desktop/otros**: mostrar ambas variantes como hace hoy `InstallAppCard` (caso raro,
  no invertir diseño extra).
- Si la app ya está instalada (`isStandalone()`): redirigir a `/`.

**Salida de la pantalla**: debe existir una única forma clara de salir (una ✕ o link
"Agora não"). Al tocarla, mostrar una confirmación en el idioma de la UI (pt-BR), tipo:
"Tem certeza que deseja sair sem instalar o app?" con dos opciones (seguir en la
pantalla / salir). Si confirma salir → navegar a `/` (home). Usar un modal propio con
el branding (no `window.confirm`).

**Integración post-cadastro**: después de que el registro termina OK en
`app/signin/page.tsx`, redirigir a `/instalar` en lugar de `/` (tanto en el caso con
sesión inmediata como, si aplica, tras el mensaje de éxito — analizar el flujo real y
proponer dónde encaja mejor cuando hay confirmación de email pendiente). Si el registro
ocurre desde la app ya instalada (standalone), saltar directo a `/`.

**Performance**: la ruta debe ser estática (`○ Static` en `npm run build`); el video
solo se carga en iOS; nada de esta pantalla debe agregar peso al resto de la app.

### T2 — Mantener los puntos de instalación existentes
No eliminar los botones/cards actuales (home, perfil, signin): quedan como respaldo
por si el usuario se saltea la pantalla de `/instalar`. Sí se les aplican las mejoras
de estética y texto de T5, y pueden simplificarse para reutilizar componentes, pero el
acceso a instalar debe seguir existiendo en esos lugares.

### T3 — Botón de instalación en la pantalla "Entrar" (signin)
En `app/signin/page.tsx` (donde se pone usuario y contraseña) debe haber un **botón
visible "Instalar App"**. Hoy existe `InstallAppBanner` arriba de la pantalla:
evaluar si conviene reemplazarlo o rediseñarlo, pero el resultado debe ser un botón
claro y prominente (no un banner apagado ni colapsado). Evitar duplicar dos llamados a
instalar en la misma pantalla. Comportamiento del botón según T5/T6 (Android: prompt
nativo; iOS: llevar a `/instalar` o a Safari según navegador).

### T4 — Espaciado del botón de instalación en el perfil
En `app/profile/page.tsx`, la card de instalación (`InstallAppCard`) tiene demasiado
espacio por encima y por debajo. Ajustar márgenes/padding para que quede compacta y
bien integrada al resto de la pantalla de perfil.

### T5 — Estética y texto de TODOS los botones de instalación
- El texto del botón de acción es siempre **"Instalar App"** — simple y entendible.
  Reemplazar "Instalar agora", "Ver como instalar" y cualquier otra variante.
- Si el botón tiene un texto encima (como el caso Android con su explicación), ese
  texto puede quedar, pero el CTA es "Instalar App".
- **En iPhone los botones actuales son muy apagados**: rediseñarlos para que NO pasen
  desapercibidos. Usar el acento `#EF9F27` (u otra decisión de diseño fuerte dentro de
  la paleta), buen tamaño, peso tipográfico, quizás ícono 📲. El objetivo explícito es
  que la persona instale: el botón debe llamar la atención en todas sus apariciones
  (home, perfil, signin, popup, `/instalar`).
- Aplicar el mismo criterio de prominencia en Android para mantener consistencia.

### T6 — Solo iPhone: detectar Chrome y derivar a Safari
- Agregar a `lib/platform.ts` detección del navegador en iOS (Chrome = `CriOS` en el
  user agent; considerar también otros no-Safari como `FxiOS`, `EdgiOS` → tratarlos
  como "no Safari").
- Reconocer el navegador **desde que se abre la app**.
- Comportamiento de TODOS los botones "Instalar App" en iOS:
  - **Safari** → navegar a `/instalar` (pantalla del video, T1).
  - **Chrome (u otro no-Safari)** → abrir automáticamente **Safari** en la página
    `/instalar` del sitio de producción. Técnica sugerida: URL scheme
    `x-safari-https://<dominio>/instalar` (Chrome iOS lo abre en Safari). **Verificar
    su compatibilidad real**. Si el salto automático no funciona (o no se puede
    detectar que funcionó), el fallback NUNCA es un mensaje de error: mostrar una
    pantalla/bloque amigable que diga que hay que abrir la página en Safari y que
    **facilite la URL para copiarla**: la dirección `https://<dominio>/instalar`
    visible + un botón **"Copiar link"** (usando el portapapeles, con confirmación
    visual tipo "Link copiado! Cole no Safari") e instrucción simple en pt-BR de
    pegarla en Safari. Siempre debe haber un camino visible para instalar.
  - Si el usuario cierra/sale de esa pantalla, la ruta lo lleva a `/` (ya cubierto por
    la confirmación de salida de T1).

### T7 — Popup de invitación a instalar al abrir la app
Cuando se abre la app en el navegador **sin estar instalada** (`!isStandalone()`),
mostrar un popup/modal con branding invitando a instalar:
- **Cerrar el popup** → se queda en la pantalla principal (solo se descarta el modal).
- **Botón "Instalar App"**:
  - Android → dispara el prompt nativo directamente (instala automático). **No
    superponer llamados**: mientras el popup esté visible no debe competir con otra
    card/banner de instalar en la misma vista.
  - iPhone desde Chrome → abre Safari en `/instalar` (mecánica de T6).
  - iPhone desde Safari → navega a `/instalar`.
- No mostrarlo en la ruta `/instalar` ni encima del flujo post-cadastro (para no
  duplicar llamados), ni cuando la app está instalada.
- Frecuencia: no molestar en cada apertura. Default propuesto: recordar el cierre en
  localStorage y volver a mostrarlo pasadas 24 h (ajustable; unificar criterio con el
  TTL de 7 días que hoy usa `InstallAppBanner` — proponer un único criterio y
  aplicarlo).
- **Performance**: el popup se monta después del render principal del home (client,
  diferido); no puede bloquear ni retrasar la carga inicial ni el LCP.

---

## Criterios de aceptación
1. Tras cadastrarse en un celular, el usuario cae en `/instalar` con la pantalla
   brandeada; en Android instala con un toque, en iPhone ve el video; si intenta salir
   se le pregunta si está seguro y, si confirma, va al home.
2. Todos los CTAs de instalación dicen **"Instalar App"** y son visualmente
   prominentes, especialmente en iPhone.
3. En la pantalla de Entrar hay un botón de instalar claro.
4. La card de instalar del perfil ya no tiene exceso de espacio vertical.
5. En iPhone+Chrome, cualquier botón de instalar termina abriendo Safari en
   `/instalar`; si el salto automático no es posible, aparece el bloque con la URL y
   el botón "Copiar link" para pegarla en Safari (nunca un mensaje de error).
6. Al abrir la app no instalada aparece el popup de invitación con la lógica por
   plataforma/navegador, sin llamados duplicados en pantalla y sin afectar la carga.
7. `npm run build` pasa; el home y `/instalar` siguen estáticos; la navegación se
   siente igual de rápida que antes (probar en local).

## Notas de implementación
- Reutilizar y refactorizar `InstallInstructions` / `InstallAppCard` /
  `InstallAppBanner` en vez de duplicar lógica; centralizar en `lib/platform.ts` la
  detección plataforma+navegador y en un solo lugar la decisión "qué hace el botón
  Instalar App según contexto".
- El dominio de producción para el scheme de Safari: obtenerlo de la config/env del
  proyecto, no hardcodear si ya existe una constante.
- Textos de UI en pt-BR; mantener el link de ayuda por WhatsApp del admin donde ya
  existe.
- Al terminar: listar qué probar y cómo (localhost y producción), en lenguaje simple.
