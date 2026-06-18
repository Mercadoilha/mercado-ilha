import { createClient } from '@supabase/supabase-js';

/**
 * @param opts.revalidate  Si se pasa, los reads se cachean con ISR por esos
 *   segundos (permite que la página sea pre-renderizada desde el edge en vez
 *   de SSR en cada request → elimina cold start en el camino crítico).
 *   Por defecto (sin opts) se mantiene `no-store`: datos siempre frescos,
 *   correcto para API routes y panel admin.
 */
export function getSupabaseAdmin(opts?: { revalidate?: number }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL in environment variables.');
  }

  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in environment variables.');
  }

  const cacheFetch: typeof fetch =
    opts?.revalidate != null
      ? (url, options) => fetch(url, { ...options, next: { revalidate: opts.revalidate } })
      : (url, options) => fetch(url, { ...options, cache: "no-store" });

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
    global: {
      fetch: cacheFetch,
    },
  });
}
