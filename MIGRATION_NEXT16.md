# Plan de migración a Next.js 16

Objetivo: preparar una migración controlada desde Next.js 14 a Next.js 16 para resolver vulnerabilidades detectadas sin romper la aplicación en `main`.

Rama de trabajo: `upgrade/next-16-plan`

Checklist

1. Crear rama de trabajo desde `main`:
   - `git checkout -b upgrade/next-16-plan`

2. Actualizar dependencias en la rama (no en `main`):
   - `npm install next@^16.2.6`
   - `npm install` (actualiza `package-lock.json`)

3. Ejecutar build y tests localmente:
   - `npm run build`
   - `npm run dev` y pruebas manuales en http://localhost:3000

4. Revisar breaking changes y ajustar código (lista no exhaustiva):
   - Revisar cambios en la Image Optimizer y la configuración `remotePatterns`.
   - Revisar migraciones relacionadas con React Server Components y `app/` router.
   - Evaluar cambios en Middleware y rewrites.
   - Verificar configuración de CSP si usas nonces.
   - Actualizar cualquier uso de APIs obsoletas en Next.js.

5. Ejecutar `npm audit` y validar que vulnerabilidades se resuelven.

6. Si la build pasa y la app funciona localmente, abrir PR hacia `main` para revisión.

7. Monitorear en entorno de staging / Vercel antes de mergear en `main`.

Notas

- Esta migración es un cambio mayor; ejecutar en una rama hecha para pruebas y QA.
- Puedo automatizar los pasos 1-3 y abrir el PR si quieres.
- Si prefieres que aplique `npm audit fix --force` en la rama en vez de actualizar manualmente, también lo puedo ejecutar (no recomendado sin pruebas).

Comandos útiles

```bash
# crear rama y subirla
git checkout -b upgrade/next-16-plan
git push -u origin upgrade/next-16-plan

# actualizar next
npm install next@^16.2.6
npm install
npm run build
```
