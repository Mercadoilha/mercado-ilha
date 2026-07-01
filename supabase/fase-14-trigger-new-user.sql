-- FASE 14 — Trigger para crear perfil automáticamente al registrar usuario
-- Ejecutar en Supabase SQL Editor.
--
-- Problema resuelto: cuando Supabase exige confirmación de email, el frontend
-- no tiene sesión activa al hacer signUp(), por lo que el RLS bloquea cualquier
-- INSERT en public.profiles. El perfil nunca se creaba y el fallback del frontend
-- usaba el email como nombre.
--
-- Solución: trigger AFTER INSERT ON auth.users que crea el perfil server-side
-- con SECURITY DEFINER (bypasea RLS). Es síncrono y no afecta performance.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, whatsapp, role, is_active)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
      'Usuário'
    ),
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'whatsapp'), ''), ''),
    'user',
    true
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
