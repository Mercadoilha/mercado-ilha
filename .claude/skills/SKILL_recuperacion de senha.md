# Skill: Recuperação de Senha — Mercado Ilha

## Problema resuelto
El flujo de recuperación de contraseña en Supabase con código OTP falló por dos razones:
1. `resetPasswordForEmail` con `redirectTo` fue rechazado porque la URL no estaba en la lista de redirects permitidos de Supabase.
2. El token que genera `resetPasswordForEmail` tiene **8 dígitos**, no 6 — el setting "OTP length" del dashboard de Supabase solo afecta a `signInWithOtp`, no a este flujo.

## Solución correcta

### Frontend — [frontend/app/forgot-password/page.tsx](frontend/app/forgot-password/page.tsx)

**Envío del código** — sin `redirectTo`:
```typescript
const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim());
```

**Verificación** — acepta 8 dígitos:
```typescript
if (code.length !== 8) { setError("O código deve ter 8 dígitos."); return; }
const { error: err } = await supabase.auth.verifyOtp({
  email: email.trim(),
  token: code.trim(),
  type: "recovery",
});
```

**Input del código**:
```tsx
<input
  type="text"
  inputMode="numeric"
  pattern="[0-9]{8}"
  maxLength={8}
  placeholder="00000000"
  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
/>
```

**Nueva contraseña** (después de verificar):
```typescript
const { error: err } = await supabase.auth.updateUser({ password: newPassword });
```

### Supabase Dashboard — configuración necesaria
- **Authentication → Emails → Reset Password → Body**: debe contener `{{ .Token }}` para que el código aparezca en el email:
```html
<p style="font-size:2.5rem;font-weight:bold;letter-spacing:0.5rem;text-align:center;color:#185FA5;margin:0 0 16px;">{{ .Token }}</p>
<h2 style="margin:0 0 8px;">Recuperação de senha — Mercado Ilha</h2>
<p>Use o código acima para criar uma nova senha. Ele expira em 1 hora.</p>
<p style="color:#666;font-size:0.875rem;">Se você não solicitou, ignore este e-mail.</p>
```

## Flujo completo
1. Usuario ingresa email → `resetPasswordForEmail(email)` sin redirectTo
2. Supabase envía email con código de 8 dígitos (`{{ .Token }}`)
3. Usuario ingresa el código → `verifyOtp({ email, token, type: "recovery" })`
4. Si válido → usuario ingresa nueva contraseña → `updateUser({ password })`
5. Redirect a `/signin`

## Notas clave
- **No usar `redirectTo`** en `resetPasswordForEmail` salvo que la URL esté en Supabase → Authentication → URL Configuration → Redirect URLs.
- El setting "OTP length" en Supabase solo afecta `signInWithOtp`. Para recovery, el token siempre es de 8 dígitos.
- `verifyOtp` con `type: "recovery"` establece una sesión autenticada que permite llamar `updateUser`.
