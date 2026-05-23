# MEMORY.md — Proyecto Mercado Ilha
# Usar este archivo al inicio de cada conversación nueva con Claude para retomar
# el contexto sin repetir todo desde cero.

---

## QUÉ ES EL PROYECTO

Marketplace web para la isla de Tinharé (Morro de São Paulo, Brasil). Resuelve que
todo el comercio local se hace por grupos de WhatsApp donde las publicaciones se
pierden. La app permite publicar anuncios permanentes, buscables y categorizados.
El contacto comprador-vendedor es por WhatsApp (botón directo con mensaje
pre-armado). Servicio gratuito al inicio. Nombre: **Mercado Ilha**.

---

## DECISIONES TÉCNICAS

- **Stack:** Next.js (App Router) + TypeScript + Tailwind CSS + Supabase (DB,
  auth, storage) + Vercel (hosting). Todo gratuito al inicio.
- **Plataforma:** Web responsive para celular + PWA instalable.
- **Idioma de la interfaz:** Portugués brasileño.
- **Autenticación:** Registro mínimo (nombre, WhatsApp, email, contraseña) para
  publicar. Navegar y contactar es libre sin registro.
- **Contacto:** Botón WhatsApp con mensaje pre-armado por categoría. Sin chat
  interno.
- **Moderación:** Publicación instantánea. Admin puede ocultar/bloquear/eliminar.
  Usuarios pueden denunciar.
- **Fotos:** Hasta 6 por anuncio. Compresión automática en el navegador antes de
  subir (el usuario no hace nada manual).
- **Expiración:** Configurable por categoría (días o sin expiración). Anuncios
  vencidos quedan en el panel del vendedor para republicar con un clic. Vendedor
  puede marcar como "vendido" manualmente.
- **Perfil-tienda:** Cada vendedor tiene página pública con todos sus anuncios
  (estilo Nuvemshop).

---

## ESTRUCTURA GEOGRÁFICA (3 niveles, todo administrable)

- **Isla:** Tinharé (expandible a otras islas de Brasil en el futuro)
- **Localidades:** Morro de São Paulo, Gamboa, Zimbo, Galeão
- **Sub-zonas:**
  - Morro de São Paulo: Vila Centro, Lagoa, Primeira Praia, Segunda Praia,
    Terceira Praia, Quarta Praia, Mangaba, Buraco, Outros
  - Gamboa: Nova Gamboa, Vila, Outros
  - Zimbo: Outros (sin sub-zonas definidas aún)
  - Galeão: Outros (sin sub-zonas definidas aún)
- **"Outros":** El usuario escribe referencia en texto libre (no crea sub-zona
  oficial). El admin ve las referencias repetidas y crea sub-zonas cuando quiera.

---

## CATEGORÍAS (10, todas administrables)

Cada categoría tiene: nombre, ícono, orden, días de expiración (o sin expiración),
mensaje WhatsApp propio, texto del botón de contacto, tipo de ubicación
(fija/zonas de atención/sin ubicación), campos especiales si aplica.

| # | Categoría | Ubicación | Botón | Expiración |
|---|-----------|-----------|-------|------------|
| 1 | Produtos | Fija | Contatar vendedor | 20 días |
| 2 | Serviços do lar | Zonas de atención | Contatar | Sin expiración |
| 3 | Construção | Zonas de atención | Pedir orçamento | Sin expiración |
| 4 | Beleza e bem-estar | Zonas de atención | Contatar | Sin expiración |
| 5 | Translados | Zonas de atención | Contatar | Sin expiración |
| 6 | Envios | Zonas de atención | Contatar | Sin expiración |
| 7 | Gastronomia | Fija + delivery | Fazer pedido | Sin expiración |
| 8 | Terrenos | Fija | Contatar vendedor | 60 días |
| 9 | Casas | Fija | Contatar vendedor | 60 días |
| 10 | Aluguéis | Fija | Contatar | 60 días |

**Tipos de ubicación:**
- FIJA: selector de una sub-zona. Filtro por sub-zona.
- ZONAS DE ATENCIÓN: el prestador marca varias sub-zonas donde trabaja + opción
  "Atendo em toda a ilha". El comprador filtra por quién atiende en su zona.

**Campos especiales de Gastronomia:**
- ¿Hace delivery? (sí/no)
- Tabla de valor de delivery por sub-zona (sub-zona + precio)

**Subcategorías iniciales:**
- Produtos: eletrônicos, móveis, eletrodomésticos, roupas, esportes, alimentos, outros
- Serviços do lar: eletricista, encanador, pintura, jardinagem, limpeza,
  ar-condicionado/refrigeração, marcenaria/reparos, outros
- Construção: pedreiro, mestre de obras, empreiteiro, gesso/drywall, telhado, outros
- Beleza e bem-estar: cabeleireiro, manicure/pedicure, massagem, estética,
  depilação, terapias, outros
- Translados: aeroporto/lancha, passeios, buggy/quadriciclo, táxi, outros
- Envios: motoboy, frete/carga, entregas, outros
- Gastronomia: restaurante, lanches, doces/sobremesas, bebidas, caseiro/marmita, outros
- Terrenos: à venda, outros
- Casas: à venda, outros
- Aluguéis: temporada/turismo, longa duração, comercial, outros

---

## DISEÑO Y MARCA

- **Paleta:** Azul mar principal (#185FA5), azules claros (#B5D4F4, #E6F1FB),
  acento arena/amarillo (#EF9F27, #FAC775), verde-mar apoyo (#9FE1CB, #0F6E56).
- **Estilo:** Moderno y limpio con identidad de isla (Estilo C).
- **Logo:** Bolsa de compras (grande) que contiene un montículo de arena con un
  faro encima (faro blanco con franjas rojas y luz/rayos). SVG.
- **Layout de anuncios:** LISTA horizontal (miniatura cuadrada a la izquierda +
  título, precio, ubicación, etiqueta al lado). NO grilla de 2 columnas.
- **Home (de arriba a abajo):**
  1. Encabezado azul: logo + selector de ubicación + acceso cuenta
  2. Barra de búsqueda
  3. Banner publicitario grande y visible (rotativo, etiqueta "Publicidade")
  4. Leyenda discreta debajo del banner: "Quer anunciar aqui? Fale conosco"
  5. Íconos de categorías (3 por fila)
  6. Lista de anuncios recientes
  7. Bloque "Fale conosco" solo para sugerencias (abre WhatsApp del admin)
  8. Barra navegación inferior con botón central arena para publicar (+)
- **Detalle del anuncio:** galería con contador, precio grande, condición,
  descripción, ubicación, vendedor + link a su tienda, botón WhatsApp grande,
  "Denunciar anúncio" discreto abajo.

---

## PUBLICIDAD (BANNERS)

- El admin gestiona banners: imagen, link, posición (home/listado), orden,
  vigencia, activo/inactivo.
- Varios activos en misma posición = rotan automáticamente.
- Sin banner activo = muestra invitación "Quer anunciar aqui? Fale conosco".
- La invitación de publicidad y el "Fale conosco" abren WhatsApp del admin con
  mensajes pre-armados distintos.
- Número de WhatsApp del admin configurable (no fijo en código).

---

## PANEL DE ADMINISTRADOR

Ruta protegida (rol admin). Gestiona:
- Islas, localidades, sub-zonas
- Categorías y subcategorías (todos sus atributos)
- Banners publicitarios
- Todos los anuncios (ocultar/bloquear/eliminar)
- Denuncias
- Usuarios (asignar/quitar rol admin)
- Ajustes generales (número WhatsApp del admin, etc.)

---

## PLAN DE CONSTRUCCIÓN POR FASES

| Fase | Qué incluye | Estado |
|------|-------------|--------|
| 1 | Base de datos Supabase (tablas, RLS, datos iniciales) | Pendiente |
| 2 | Autenticación (registro, login, roles) | Pendiente |
| 3 | Publicar y ver anuncios (formulario, home, listado, detalle) | Pendiente |
| 4 | Búsqueda y filtros | Pendiente |
| 5 | Cuenta y perfil-tienda del vendedor | Pendiente |
| 6 | Panel de administrador completo | Pendiente |
| 7 | Banners rotativos + PWA instalable | Pendiente |
| 8 | Pulido, GitHub, Vercel, lanzamiento | Pendiente |

---

## ARCHIVOS DEL PROYECTO

- `GUIA_PASO_A_PASO.md` — Guía completa paso a paso para el dueño (no técnico)
- `PROMPT_CLAUDE_CODE.md` — Prompt completo para pegar en Claude Code
- `MEMORY.md` — Este archivo

---

## CÓMO USAR ESTE ARCHIVO EN UNA CONVERSACIÓN NUEVA

Al inicio del mensaje, escribí algo como:
"Tengo un proyecto en curso. Te adjunto el contexto completo:"
y pegá el contenido de este archivo. Así Claude retoma desde donde estaban
sin necesidad de re-explicar todo.
