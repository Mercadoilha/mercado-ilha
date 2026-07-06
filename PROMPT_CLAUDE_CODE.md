# PROMPT_CLAUDE_CODE.md — Registro histórico (build inicial)

> ⚠️ **DOCUMENTO HISTÓRICO — NO es fuente de verdad.**
> Este es el prompt original con el que se construyó la app (Fases 1-8, ya completadas y en
> producción). Se conserva solo como referencia del arranque.
>
> **Los datos de aquí abajo son del build inicial y NO reflejan el estado actual.** En
> particular, la lista de categorías (10 categorías con nombres como *Gastronomia, Translados,
> Envios, Beleza e bem-estar*) fue reemplazada: hoy hay **31 categorías** distintas. Para todo
> lo vigente —categorías, geografía, rutas, diseño, decisiones técnicas, optimizaciones—
> **usar siempre `MEMORY.md`**, nunca este archivo.
>
> El resto del documento queda tal como se escribió, únicamente por valor histórico.

---

## (Contenido histórico original — no editar)

Este archivo tiene dos partes:
1. **Notas para vos** (el dueño del proyecto) — cómo usar el prompt.
2. **PROMPT PARA PEGAR** — lo que copiás y pegás en Claude Code.

---

## NOTAS PARA VOS (no se pegan)

- El prompt está escrito en español para que vos lo entiendas, pero le pide a
  Claude Code que **la interfaz de la app esté 100% en portugués brasileño**.
- Le pide construir **solo las Fases 1 a 3 primero**. Las demás fases están
  listadas para que se las pidas después, una por una.
- Cuando Claude Code te pida las llaves de Supabase, pegáselas (las guardaste en
  `llaves-supabase.txt`).
- Si en algún momento Claude Code propone algo que no entendés, pedile que te lo
  explique en palabras simples antes de aceptar.

---

## PROMPT PARA PEGAR

```
Quiero que construyas una aplicación web marketplace llamada "Mercado Ilha".
Trabajá de forma autónoma y ordenada. Hablame en español, pero TODA la interfaz
de la aplicación (textos, botones, mensajes al usuario) debe estar en PORTUGUÉS
DE BRASIL. A continuación te doy el contexto completo del proyecto, y al final te
indico exactamente qué construir ahora (Fases 1 a 3).

=== CONTEXTO DEL PROYECTO ===

PROBLEMA QUE RESUELVE:
En la isla de Tinharé (Morro de São Paulo, Brasil) todo el comercio de productos,
servicios, terrenos, etc. ocurre en grupos de WhatsApp, donde las publicaciones se
pierden en el flujo del chat. Mercado Ilha es un marketplace donde la gente publica
anuncios permanentes, buscables y categorizados, y los compradores contactan a los
vendedores por WhatsApp.

USUARIOS Y REGLAS GENERALES:
- Para PUBLICAR hay que registrarse (registro mínimo: nombre, WhatsApp, email,
  contraseña). Para NAVEGAR y CONTACTAR vendedores NO hace falta registro.
- El contacto comprador-vendedor es por WhatsApp: un botón abre WhatsApp del
  vendedor con un mensaje pre-armado. NO hay chat interno.
- Moderación: las publicaciones se ven al instante. El administrador puede ocultar,
  bloquear o eliminar cualquier anuncio. Los usuarios pueden denunciar anuncios.
- Cada vendedor tiene un PERFIL-TIENDA público (estilo Nuvemshop) con todos sus
  anuncios activos agrupados.
- El servicio es gratuito para compradores y vendedores.

PLATAFORMA Y STACK:
- Aplicación web responsive optimizada para celular, que también funcione como PWA
  instalable en la pantalla de inicio.
- Stack: Next.js (App Router) + TypeScript + Tailwind CSS en el frontend.
- Backend, base de datos, autenticación y almacenamiento de imágenes: Supabase.
- Pensada para desplegarse en Vercel.
- Usá variables de entorno para las llaves de Supabase y guiame para configurarlas.

ESTRUCTURA GEOGRÁFICA (3 niveles, TODO administrable desde el panel admin):
- Nivel 1 ISLA: Tinharé. (Debe poder agregarse más islas en el futuro.)
- Nivel 2 LOCALIDAD: Morro de São Paulo, Gamboa, Zimbo, Galeão.
- Nivel 3 SUB-ZONA:
    Morro de São Paulo: Vila Centro, Lagoa, Primeira Praia, Segunda Praia,
      Terceira Praia, Quarta Praia, Mangaba, Buraco, Outros.
    Gamboa: Nova Gamboa, Vila, Outros.
    Zimbo: (solo "Outros" por ahora).
    Galeão: (solo "Outros" por ahora).
- Toda localidad debe tener siempre la opción "Outros". Si el usuario elige
  "Outros", puede escribir una referencia de ubicación en texto libre, que se
  muestra en el anuncio pero NO crea una sub-zona oficial. El admin puede ver esas
  referencias y crear sub-zonas oficiales cuando quiera.

CATEGORÍAS (TODAS administrables: el admin crea, edita, renombra, reordena, oculta
categorías y subcategorías). Cada categoría tiene estos atributos configurables:
  - nombre, ícono, orden
  - días de expiración del anuncio (un número, o "sin expiración")
  - mensaje de WhatsApp pre-armado propio
  - texto del botón de contacto (ej: "Contatar vendedor" o "Pedir orçamento")
  - tipo de ubicación: "fija" (sub-zona única) | "zonas de atención" (varias
    sub-zonas + opción "toda a ilha") | "sin ubicación"
  - si tiene campos especiales (ej: delivery)

Categorías iniciales a precargar (en este orden):
1. Produtos — ubicación FIJA. Botón "Contatar vendedor". Expira 20 días.
   Subcategorías: eletrônicos, móveis, eletrodomésticos, roupas, esportes,
   alimentos, outros.
2. Serviços do lar — ubicación ZONAS DE ATENCIÓN. Botón "Contatar". Sin expiración.
   Subcategorías: eletricista, encanador, pintura, jardinagem, limpeza,
   ar-condicionado/refrigeração, marcenaria/reparos, outros.
3. Construção — ubicación ZONAS DE ATENCIÓN. Botón "Pedir orçamento". Sin
   expiración. Mensaje WhatsApp tipo "Olá! Vi seu anúncio de construção: [título].
   Gostaria de pedir um orçamento." Subcategorías: pedreiro, mestre de obras,
   empreiteiro, gesso/drywall, telhado, outros.
4. Beleza e bem-estar — ubicación ZONAS DE ATENCIÓN. Botón "Contatar". Sin
   expiración. Subcategorías: cabeleireiro, manicure/pedicure, massagem, estética,
   depilação, terapias, outros.
5. Translados — ubicación ZONAS DE ATENCIÓN (transporte de PERSONAS). Botón
   "Contatar". Sin expiración. Subcategorías: aeroporto/lancha, passeios,
   buggy/quadriciclo, táxi, outros.
6. Envios — ubicación ZONAS DE ATENCIÓN (transporte de COSAS/encomiendas). Botón
   "Contatar". Sin expiración. Subcategorías: motoboy, frete/carga, entregas,
   outros.
7. Gastronomia — ubicación FIJA + CAMPOS ESPECIALES de delivery. Botón "Fazer
   pedido". Sin expiración. Campos especiales: "¿hace delivery? sí/no" y una tabla
   de valor de delivery por sub-zona (sub-zona + precio). Subcategorías:
   restaurante, lanches, doces/sobremesas, bebidas, caseiro/marmita, outros.
8. Terrenos — ubicación FIJA. Botón "Contatar vendedor". Expira 60 días.
   Subcategorías: à venda, outros.
9. Casas — ubicación FIJA. Botón "Contatar vendedor". Expira 60 días.
   Subcategorías: à venda, outros.
10. Aluguéis — ubicación FIJA. Botón "Contatar". Expira 60 días. Subcategorías:
    temporada/turismo, longa duração, comercial, outros.

NOTA SOBRE UBICACIÓN:
- Categorías con ubicación FIJA: el formulario pide UNA sub-zona (donde está el
  producto/inmueble). El comprador filtra por sub-zona.
- Categorías con ZONAS DE ATENCIÓN: el formulario permite marcar VARIAS sub-zonas
  donde el prestador atiende, más una opción "Atendo em toda a ilha". El comprador
  filtra por "quién atiende en mi zona".

PUBLICACIONES (anuncios):
- Campos: título, descripción, precio (opcional; si no hay, se muestra "A
  combinar"), condición (novo/usado, solo cuando aplique), categoría, subcategoría,
  ubicación según el tipo de la categoría, hasta 6 fotos.
- Las fotos se deben COMPRIMIR Y REDIMENSIONAR EN EL NAVEGADOR del usuario antes de
  subirlas a Supabase Storage (para ahorrar espacio y datos; el usuario no hace
  nada manual). Mostrar miniaturas y permitir reordenar/eliminar fotos.
- Estados del anuncio: activo, pausado, vendido, expirado, oculto (por admin).
- Expiración: según los días configurados en su categoría. Anuncios sin expiración
  no vencen. El vendedor puede marcar como VENDIDO (sale de la lista) y puede
  REPUBLICAR un anuncio vencido con un clic.

DISEÑO Y MARCA:
- Nombre: "Mercado Ilha".
- Paleta de mar: color principal azul mar (#185FA5), con tonos de apoyo azul claro
  (#B5D4F4, #E6F1FB) y un acento cálido arena/amarillo (#EF9F27 / #FAC775) para
  botones de acción importantes (como "publicar") y detalles. Verde-mar (#9FE1CB,
  #0F6E56) como apoyo. Estilo limpio, moderno, con identidad de isla.
- Logo: una bolsa de compras que contiene un montículo de arena con un faro encima
  (faro blanco con franjas rojas y luz). Generá el logo como SVG y usalo en el
  encabezado y como ícono de la PWA. Te doy libertad para pulirlo manteniendo ese
  concepto.
- LAYOUT DE LISTA para los anuncios: cada anuncio es una fila con la miniatura
  cuadrada completa a la izquierda y al lado el título, precio, ubicación y una
  etiqueta (condición/categoría). NO usar grilla de 2 columnas para los anuncios.
- HOME: encabezado azul con logo + selector de ubicación + acceso a cuenta; barra
  de búsqueda; un BANNER PUBLICITARIO grande y visible debajo de la búsqueda (con
  soporte para varios banners ROTATIVOS y etiqueta "Publicidade"); debajo del
  banner una leyenda discreta "Quer anunciar aqui? Fale conosco"; fila de íconos de
  categorías; lista de anuncios recientes; un bloque "Fale conosco" para enviar
  SUGESTÕES (solo sugerencias, no reclamos) que abre tu WhatsApp; barra de
  navegación inferior con un botón central destacado (color arena) para publicar.
- DETALLE DEL ANUNCIO: galería de fotos con contador, precio grande, etiqueta de
  condición, descripción, ubicación, datos del vendedor con link a su perfil-tienda,
  botón grande de WhatsApp (texto según la categoría), y opción discreta
  "Denunciar anúncio".

PUBLICIDAD (banners):
- El admin gestiona banners: imagen, link opcional, posición (home/listado), orden,
  vigencia (fechas), activo/inactivo. Si hay varios activos en una posición, rotan.
- Si no hay banner activo, mostrar la invitación "Quer anunciar aqui? Fale conosco".

CONTACTO CON EL ADMINISTRADOR:
- "Fale conosco" (sugerencias): abre el WhatsApp del administrador con un mensaje
  pre-armado de sugerencia.
- La invitación de publicidad ("Quer anunciar aqui?") abre el WhatsApp del admin
  con un mensaje pre-armado distinto, sobre contratar publicidad.
- El número de WhatsApp del admin debe ser configurable (variable o tabla de
  ajustes), no estar fijo en el código.

PANEL DE ADMINISTRADOR (ruta protegida, solo usuarios con rol "admin"):
- Gestión de islas, localidades y sub-zonas (crear/editar/borrar/reordenar).
- Gestión de categorías y subcategorías, incluyendo todos los atributos
  configurables descritos arriba (días de expiración, mensaje WhatsApp, texto del
  botón, tipo de ubicación, campos especiales).
- Gestión de banners publicitarios.
- Lista de todos los anuncios, con poder de ocultar/bloquear/eliminar.
- Lista de denuncias.
- Lista de usuarios y posibilidad de marcar/quitar rol admin.
- Ajustes generales (incluido el número de WhatsApp del admin).

ESCALABILIDAD:
- Diseñá el modelo de datos para soportar varias islas desde el inicio, aunque al
  lanzar solo esté Tinharé.

=== QUÉ CONSTRUIR AHORA: FASES 1 A 3 ===

Construí SOLO esto ahora. No avances a las fases siguientes hasta que yo lo pida.

FASE 1 — Base de datos (Supabase):
- Diseñá y creá todas las tablas y relaciones para todo lo descrito (islas,
  localidades, subzonas, categorías, subcategorías con sus atributos, usuarios,
  anuncios, fotos de anuncios, zonas de atención por anuncio, banners, denuncias,
  ajustes, y lo necesario para Gastronomia/delivery).
- Configurá las políticas de seguridad (RLS) correctas: lectura pública de anuncios
  activos; escritura solo del dueño; acceso total para admin.
- Entregame el script SQL para ejecutar en el SQL Editor de Supabase y explicame
  paso a paso cómo correrlo.
- Precargá los datos iniciales: isla Tinharé, sus localidades y sub-zonas, y las 10
  categorías con sus subcategorías y atributos.

FASE 2 — Autenticación:
- Registro (nombre, WhatsApp, email, contraseña) y login con Supabase Auth.
- Navegación y contacto libres sin login; publicar requiere login.
- Explicame cómo convertir mi usuario en admin.

FASE 3 — Publicar y ver anuncios:
- Formulario de publicación paso a paso, adaptándose a la categoría elegida (campos
  de ubicación según tipo, campos de delivery para Gastronomia, condición cuando
  aplique), con carga de hasta 6 fotos CON COMPRESIÓN EN EL NAVEGADOR.
- Home con el diseño descrito (encabezado, búsqueda, banner, categorías, lista de
  anuncios, fale conosco, navegación inferior).
- Listado de anuncios en formato LISTA.
- Detalle del anuncio con botón de WhatsApp (mensaje y texto según categoría) y
  opción de denunciar.
- Lógica de expiración según la categoría, marcar como vendido y republicar.
- Aplicá la paleta de mar, el logo y el estilo descritos.

FORMA DE TRABAJAR:
- Antes de escribir código, mostrame un plan breve de cómo vas a estructurar el
  proyecto y la base de datos, y esperá mi OK.
- Trabajá de forma incremental y andá explicándome en español qué vas haciendo.
- Cuando necesites las llaves de Supabase u otra acción de mi parte, pedímelo con
  instrucciones claras y simples (asumí que no tengo experiencia técnica).
- Al terminar las Fases 1-3, decime exactamente cómo probar la app en mi
  computadora y dame una lista de qué revisar.

=== FASES SIGUIENTES (NO LAS HAGAS TODAVÍA, son para pedirte después) ===

FASE 4 — Búsqueda y filtros: buscador por texto y filtros por categoría,
subcategoría, ubicación/zona de atención, rango de precio y condición.

FASE 5 — Cuenta y perfil-tienda: panel "Minha conta" con mis anuncios
(activo/vendido/expirado) y acciones editar/pausar/marcar vendido/republicar/borrar;
página pública de tienda del vendedor con todos sus anuncios.

FASE 6 — Panel de administrador completo: gestión de islas, localidades, sub-zonas,
categorías, subcategorías (con todos los atributos), banners, anuncios (ocultar/
bloquear/eliminar), denuncias, usuarios y ajustes generales.

FASE 7 — Banners publicitarios + PWA: mostrar banners rotativos en home/listado;
convertir la web en PWA instalable con el logo como ícono.

FASE 8 — Pulido y preparación de lanzamiento: revisión de textos en portugués,
rendimiento, pruebas en celular, y ayuda para subir a GitHub y desplegar en Vercel.

Empecemos por la Fase 1. Mostrame primero tu plan y esperá mi OK.
```

---

## CÓMO PEDIR LAS FASES SIGUIENTES (para vos)

Cuando las Fases 1-3 estén probadas y funcionando, le escribís a Claude Code, una
fase por vez, por ejemplo:

- "Avancemos con la Fase 4 (búsqueda y filtros) tal como está descrita en el
  contexto que te di."
- Luego: "Ahora la Fase 5 (cuenta y perfil-tienda)."
- Y así hasta la Fase 8.

Si Claude Code perdió el contexto en una sesión nueva, volvé a pegarle la sección
"CONTEXTO DEL PROYECTO" antes de pedir la fase.
