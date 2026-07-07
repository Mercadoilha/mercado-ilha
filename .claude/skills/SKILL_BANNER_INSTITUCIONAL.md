# SKILL — Banner Institucional
## Nombre del comando: /banner-institucional
## Proyecto: Mercado Ilha (Next.js 14 + TypeScript)

---

## MISIÓN
Generar una imagen institucional o promocional para el banner rotativo de la app,
subirla a `frontend/public/banners/`, hacer push a GitHub y retornar la URL de Vercel
lista para usar en el panel admin.

---

## CUÁNDO USAR ESTA SKILL
- El usuario pide crear, generar o actualizar un banner para la app.
- El usuario pide una imagen para el banner rotativo del home.
- El usuario quiere una imagen de lanzamiento, promocional o institucional.

---

## IDENTIDAD VISUAL (contexto obligatorio para el prompt de imagen)

```
App:          Mercado Ilha
Tagline:      O mercado da sua ilha
Paleta:
  Azul:       #185FA5  (primario)
  Naranja:    #EF9F27  (acento)
  Azul claro: #B5D4F4 / #E6F1FB
  Verde mar:  #9FE1CB / #0F6E56
Logo:         Bolsa de compras azul con personas sobre montículo de arena y sol.
              Archivo: frontend/public/banners/ (icon-512.png en public/)
Idioma UI:    Portugués brasileño
Estilo:       Tropical, costero, moderno, vibrante, profesional
```

---

## FLUJO DE EJECUCIÓN (paso a paso)

### Paso 1 — Subir el logo como referencia a Higgsfield
```
Herramienta: mcp__claude_ai_Higgsfield__media_upload
  filename: "icon-512.png"
  content_type: "image/png"

→ Ejecutar el curl devuelto por media_upload para hacer el PUT del archivo:
  Ruta local: /Users/leo.cufone/Desktop/IA/Mercado Ilha/frontend/public/icon-512.png

Herramienta: mcp__claude_ai_Higgsfield__media_confirm
  media_id: <id devuelto>
  type: "image"
```

### Paso 2 — Generar la imagen con Higgsfield
```
Herramienta: mcp__claude_ai_Higgsfield__generate_image
  model: "marketing_studio_image"
  aspect_ratio: "21:9"   ← ratio más ancho disponible, ideal para banner
  medias: [{ value: <media_id>, role: "image" }]
  prompt: (construir según el objetivo del banner — ver sección PROMPTS)
```

### Paso 3 — Esperar el resultado
```
Herramienta: mcp__claude_ai_Higgsfield__job_status
  jobId: <id devuelto por generate_image>
  sync: true   ← esperar hasta completado

→ Extraer rawUrl del resultado
```

### Paso 4 — Descargar y guardar en el proyecto
```bash
mkdir -p "frontend/public/banners"
curl -s -o "frontend/public/banners/<nombre-archivo>.png" "<rawUrl>"
```
Nombrar el archivo descriptivamente, ej: `banner-institucional.png`, `banner-promo-verano.png`.

### Paso 5 — Commit y push a GitHub
```bash
# Aumentar buffer para archivos grandes (PNG ~2MB)
git config http.postBuffer 524288000

git add frontend/public/banners/<nombre>.png
git commit -m "feat: add banner image <descripcion>"
git push origin main
```

### Paso 6 — Retornar la URL al usuario
```
URL pública en Vercel:
https://mercadoilha.vercel.app/banners/<nombre-archivo>.png

Indicar al usuario:
- La URL para pegar en el panel admin → campo "URL da imagem"
- Que Vercel tarda ~1-2 minutos en redesplegar
```

---

## PROMPTS DE REFERENCIA

### Banner institucional / lanzamiento
```
Wide institutional banner for 'Mercado Ilha' app launch. Use the provided logo
(blue shopping bag with people on a sand island with sun) as the central brand element.
Place the logo prominently on the left. Bold text 'Mercado Ilha' next to it.
Tagline 'O mercado da sua ilha' below. Tropical beach background with turquoise sea,
golden sunlight, white sand. Color palette: deep ocean blue #185FA5, warm amber orange
#EF9F27, sea green accents. Clean modern layout, professional, vibrant.
Wide banner format for mobile app.
```

### Banner promocional (adaptar según la oferta)
```
Wide promotional banner for 'Mercado Ilha' local marketplace app. Tropical beach
mood. Featured product/service: [DESCRIPCION]. Bright colors: ocean blue and warm amber.
Logo (blue shopping bag with island inside) top-left. Clean text layout.
Professional and inviting. Wide format 21:9.
```

### Banner de categoría (adaptar por categoría)
```
Wide banner for [CATEGORIA] section of Mercado Ilha marketplace app. Island of
Tinharé, Brazil setting. Tropical, local, authentic feel. Deep blue and amber palette.
Logo top-left. Category name bold. Wide cinematic format.
```

---

## ARCHIVOS CLAVE
- Logo PNG:    `frontend/public/icon-512.png`
- Logo SVG:    `frontend/public/mercado-ilha-logo.svg`
- Destino:     `frontend/public/banners/`
- URL base:    `https://mercadoilha.vercel.app/banners/`
- Panel admin: sección "Banners" → campo "URL da imagem"

---

## NOTAS TÉCNICAS
- El banner en la app se muestra a **130px de alto × ancho completo** con `objectFit: cover`.
- Dimensión generada: 1584 × 672 px (21:9). Se recorta verticalmente → diseñar con
  el contenido importante centrado verticalmente.
- Formato aceptado: JPG, PNG, WebP. PNG recomendado para calidad.
- **Tamaño máximo recomendado: 300 KB.** Si el PNG generado pesa más (suele pasar
  con fondos fotográficos ~2MB+), redimensionar el ancho hasta bajar de ese límite
  (ej. `sips -Z 600 archivo.png --out archivo.png` suele bastar) antes de subirlo —
  el banner del home se ve a 130px de alto, no necesita más resolución. El slot del
  splash pide la imagen redimensionada vía `/_next/image` (ver `SplashSponsorSync.tsx`),
  pero el peso del archivo fuente igual importa para el repo y para el fallback.
- git push puede fallar con archivos >1MB sin el buffer aumentado. Siempre ejecutar
  `git config http.postBuffer 524288000` antes del push.
- La URL de Higgsfield (cloudfront) es temporal. Siempre descargar y hostear en Vercel.
