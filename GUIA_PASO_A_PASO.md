# Guía paso a paso — Mercado Ilha

Esta guía te acompaña en TODO lo que tenés que hacer vos, desde cero, asumiendo
que nunca programaste. Hacela en orden, sin saltarte pasos. Cada vez que termines
un paso, marcá la casilla.

> Consejo: hacé todo desde una computadora (no el celular), te va a resultar mucho
> más fácil. Vas a probar la app en el celular después.

---

## PARTE 0 — Antes de empezar: entender las piezas

Tu app va a usar 4 herramientas. Las 4 tienen plan gratuito. Te explico qué hace
cada una con una analogía simple:

- **GitHub** = el archivador donde se guarda el código de la app. Es como Google
  Drive pero para programas.
- **Supabase** = la base de datos + el sistema de usuarios + el guardado de fotos.
  Es "la trastienda" donde vive toda la información (anuncios, usuarios, categorías).
- **Vercel** = el lugar que publica tu app en internet para que la gente entre con
  una dirección web. Es "la vidriera".
- **Claude Code** = el programador. Vos le pegás el prompt y él escribe la app.

El orden de trabajo será: crear las cuentas → instalar Claude Code → pegarle el
prompt → conectar Supabase y Vercel → probar → publicar.

---

## PARTE 1 — Crear las cuentas (30-45 min)

Creá estas cuentas con el MISMO email para no confundirte. Anotá usuario y
contraseña de cada una en un papel o gestor de contraseñas.

### [ ] 1.1 — Cuenta de GitHub
1. Entrá a https://github.com
2. Clic en "Sign up".
3. Poné tu email, una contraseña y un nombre de usuario (ej: `joao-morro`).
4. Confirmá el email que te llega.

### [ ] 1.2 — Cuenta de Supabase
1. Entrá a https://supabase.com
2. Clic en "Start your project".
3. Elegí "Continue with GitHub" (usa la cuenta que recién creaste). Esto te
   ahorra otra contraseña.
4. Listo, ya estás dentro.

### [ ] 1.3 — Cuenta de Vercel
1. Entrá a https://vercel.com
2. Clic en "Sign Up".
3. Elegí "Continue with GitHub".
4. Listo.

### [ ] 1.4 — Cuenta para usar Claude Code
Claude Code se usa con una suscripción a Claude (plan Pro o Max) o con créditos de
la API de Anthropic. Si todavía no la tenés:
1. Entrá a https://claude.com
2. Creá tu cuenta y revisá los planes disponibles.
3. Más adelante (Parte 3) te explico cómo instalar Claude Code.

---

## PARTE 2 — Crear el proyecto en Supabase (20 min)

Esto prepara "la trastienda" antes de que el programador escriba la app.

### [ ] 2.1 — Crear el proyecto
1. En Supabase, clic en "New project".
2. Nombre del proyecto: `mercado-ilha`.
3. "Database Password": generá una contraseña fuerte y GUARDALA bien (la vas a
   necesitar). Podés usar el botón de generar que trae.
4. Region: elegí la más cercana a Brasil (ej: "South America (São Paulo)").
5. Clic en "Create new project". Esperá 1-2 minutos a que se prepare.

### [ ] 2.2 — Anotar las 3 llaves que vas a necesitar
Cuando el proyecto esté listo:
1. En el menú de la izquierda, andá a "Project Settings" (el engranaje) →
   "API" (o "Data API").
2. Vas a ver y tenés que copiar y guardar en un archivo de texto:
   - **Project URL** (una dirección que empieza con https://...supabase.co)
   - **anon public key** (una clave larga)
   - **service_role key** (otra clave larga — esta es SECRETA, no la compartas)
3. Guardá las tres en un archivo de texto que llamarás `llaves-supabase.txt`.
   Las vas a pegar cuando Claude Code te las pida.

> NO compartas la `service_role key` con nadie ni la publiques. Es la llave maestra.

---

## PARTE 3 — Instalar Claude Code (20 min)

Claude Code es un programa que se usa escribiendo comandos. No te asustes: vas a
copiar y pegar, nada más.

### [ ] 3.1 — Instalar Node.js (lo que hace funcionar a Claude Code)
1. Entrá a https://nodejs.org
2. Descargá la versión "LTS" (la recomendada, botón grande).
3. Instalala (siguiente, siguiente, finalizar).

### [ ] 3.2 — Abrir la terminal
- En **Windows**: buscá "PowerShell" en el menú inicio y abrilo.
- En **Mac**: buscá "Terminal" (Cmd+Espacio, escribí "Terminal").

La terminal es una ventana negra/blanca donde escribís comandos. Cada vez que te
diga "escribí X", lo pegás y apretás Enter.

### [ ] 3.3 — Instalar Claude Code
En la terminal, pegá esto y apretá Enter:
```
npm install -g @anthropic-ai/claude-code
```
Esperá a que termine (puede tardar un par de minutos).

### [ ] 3.4 — Crear la carpeta de tu proyecto
Pegá estos comandos uno por uno (Enter después de cada uno):
```
cd Desktop
mkdir mercado-ilha
cd mercado-ilha
```
Esto crea una carpeta "mercado-ilha" en tu Escritorio y entra en ella.

### [ ] 3.5 — Iniciar Claude Code
Pegá:
```
claude
```
La primera vez te va a pedir que inicies sesión con tu cuenta de Claude. Seguí las
instrucciones en pantalla (te abre el navegador para confirmar). Cuando termine,
vas a ver que Claude Code quedó esperando tus instrucciones dentro de esa carpeta.

---

## PARTE 4 — Construir la app por fases (lo principal)

Acá es donde usás el PROMPT (el otro archivo que te entregué). La idea es ir por
fases: primero las fases 1-3 (lo básico funcionando), después las siguientes.

### [ ] 4.1 — Pegar el prompt de la Fase inicial
1. Abrí el archivo `PROMPT_CLAUDE_CODE.md`.
2. Copiá TODO el contenido de la sección "PROMPT PARA PEGAR".
3. Pegalo en Claude Code (en la terminal donde quedó esperando) y apretá Enter.
4. Claude Code va a empezar a trabajar. Te va a hacer preguntas y a pedirte cosas
   (como las llaves de Supabase). Respondele con calma.

### [ ] 4.2 — Cuando Claude Code te pida las llaves de Supabase
Pegale las que guardaste en `llaves-supabase.txt` (Project URL, anon key, y la
service_role key cuando corresponda). Él te va a indicar dónde van.

### [ ] 4.3 — Cuando Claude Code cree las tablas de la base de datos
Es probable que Claude Code te genere un texto largo (un "script SQL") y te pida
que lo ejecutes en Supabase. Para hacerlo:
1. Andá a Supabase → menú izquierdo → "SQL Editor".
2. Clic en "New query".
3. Pegá el texto que te dio Claude Code.
4. Clic en "Run" (o Ctrl+Enter).
5. Si dice "Success", volvé a Claude Code y avisale que ya lo ejecutaste.

### [ ] 4.4 — Probar la app en tu computadora
Cuando Claude Code termine la primera fase, te va a decir cómo verla. Generalmente
es un comando como:
```
npm run dev
```
y luego abrir en el navegador la dirección `http://localhost:3000`.
Probá: registrate, publicá un anuncio de prueba, miralo en la lista. Si algo no
funciona, contale a Claude Code QUÉ esperabas y QUÉ pasó, y lo corrige.

### [ ] 4.5 — Pedir las fases siguientes
Cuando las fases 1-3 estén bien, le pedís a Claude Code la Fase 4, después la 5, y
así. En el prompt están listadas todas las fases con el detalle. Le decís por
ejemplo: "Avancemos con la Fase 4: búsqueda y filtros".

---

## PARTE 5 — Guardar el código en GitHub (15 min)

Esto es para no perder el trabajo y poder publicarlo. Claude Code te puede ayudar
a hacerlo, pero acá está el resumen de lo que vas a hacer:

### [ ] 5.1 — Crear el repositorio
1. Pedile a Claude Code: "Ayudame a subir el proyecto a GitHub". Él te va a guiar
   con los comandos exactos.
2. Si te pide crear el repositorio a mano: entrá a https://github.com → botón "+"
   arriba a la derecha → "New repository" → nombre `mercado-ilha` → "Private" →
   "Create repository".
3. Seguí los comandos que te dé Claude Code para conectar y subir.

---

## PARTE 6 — Publicar la app en internet con Vercel (20 min)

Ahora la "vidriera": que cualquiera pueda entrar desde una dirección web.

### [ ] 6.1 — Conectar Vercel con GitHub
1. Entrá a https://vercel.com → "Add New..." → "Project".
2. Vercel te muestra tus repositorios de GitHub. Elegí `mercado-ilha` → "Import".

### [ ] 6.2 — Cargar las llaves de Supabase en Vercel
Antes de publicar, Vercel te pide las "Environment Variables" (las llaves). Esto es
para que la app publicada se conecte a la base de datos.
1. En la pantalla de configuración del proyecto, buscá "Environment Variables".
2. Agregá las mismas llaves de Supabase (Claude Code te dirá los nombres exactos
   que usó, normalmente algo como `NEXT_PUBLIC_SUPABASE_URL`, etc.). Pegá cada
   nombre con su valor.

### [ ] 6.3 — Publicar
1. Clic en "Deploy".
2. Esperá 1-2 minutos. Cuando termine, Vercel te da una dirección web (algo como
   `mercado-ilha.vercel.app`). ¡Esa es tu app online!

### [ ] 6.4 — (Opcional) Poner tu propio dominio
Si después querés una dirección propia (ej: `mercadoilha.com.br`):
1. Comprá el dominio en un registrador (ej: registro.br para dominios .br).
2. En Vercel → tu proyecto → "Settings" → "Domains" → agregá tu dominio y seguí
   las instrucciones. (Esto sí tiene un costo anual del dominio, no de Vercel).

---

## PARTE 7 — Cargar el contenido inicial real (1-2 horas)

Antes de invitar gente, cargá la información de verdad desde tu panel de admin.

### [ ] 7.1 — Crear tu usuario administrador
Claude Code te va a explicar cómo marcarte como admin (normalmente: te registrás
normal y luego se cambia tu rol a "admin" desde Supabase, en la tabla de usuarios).

### [ ] 7.2 — Cargar la geografía
Entrá a tu panel de admin → sección de zonas y cargá:
- Isla: **Tinharé**
- Localidades: Morro de São Paulo, Gamboa, Zimbo, Galeão
- Sub-zonas de Morro: Vila Centro, Lagoa, Primeira Praia, Segunda Praia, Terceira
  Praia, Quarta Praia, Mangaba, Buraco, Outros
- Sub-zonas de Gamboa: Nova Gamboa, Vila, Outros
- (Zimbo y Galeão: dejalas con "Outros" por ahora)

### [ ] 7.3 — Revisar/ajustar categorías y subcategorías
Las categorías iniciales ya vienen cargadas por el prompt. Revisá que estén bien y
agregá/quitá subcategorías según tu conocimiento local.

### [ ] 7.4 — Configurar mensajes y expiración por categoría
Para cada categoría, revisá: mensaje de WhatsApp y días de expiración (ej:
Produtos 20 días, Serviços/Gastronomia sin expiración). Ajustá a tu gusto.

---

## PARTE 8 — Probar todo y lanzar (1 hora)

### [ ] 8.1 — Probar en varios celulares
Abrí la dirección de Vercel en tu celular y en el de un par de amigos. Probá:
buscar, publicar, contactar por WhatsApp, marcar como vendido, instalar como PWA
(el navegador ofrece "Agregar a pantalla de inicio").

### [ ] 8.2 — Cargar algunos anuncios de ejemplo
Pedile a 3-4 personas de confianza que publiquen anuncios reales, para que cuando
llegue el resto de la gente no esté vacío.

### [ ] 8.3 — Anunciar en el grupo de WhatsApp
Compartí la dirección en el grupo con un mensaje simple explicando qué es y cómo
publicar. Ej: "Galera, criei o Mercado Ilha pra organizar as vendas. Entrem em
[dirección], é grátis, publiquem seus anúncios!"

---

## Qué hacer cuando algo falla

- **No entiendo un error:** copiá el mensaje de error y pegáselo a Claude Code
  diciendo "me apareció esto, ¿qué hago?".
- **Algo no se ve como esperaba:** describile a Claude Code qué esperabas y qué
  viste. Es la forma de que lo corrija.
- **Tengo miedo de romper algo:** no podés romper nada grave. El código está en
  GitHub (se puede volver atrás) y la base en Supabase. Probá con tranquilidad.

---

## Resumen del orden

1. Crear cuentas (GitHub, Supabase, Vercel, Claude).
2. Crear proyecto en Supabase y guardar las 3 llaves.
3. Instalar Node.js y Claude Code.
4. Pegar el prompt y construir fases 1-3, después las demás.
5. Subir a GitHub.
6. Publicar en Vercel con las llaves.
7. Cargar contenido real desde el panel admin.
8. Probar y lanzar en el grupo de WhatsApp.
