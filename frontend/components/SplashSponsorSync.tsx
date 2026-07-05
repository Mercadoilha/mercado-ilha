"use client";

import { useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

/**
 * SplashSponsorSync — sincroniza el patrocinador del splash EN SEGUNDO PLANO.
 *
 * El splash (SplashScreen) pinta el patrocinador al instante desde
 * localStorage, sin tocar la red. Este componente corre tras la hidratación,
 * busca el banner de posición 'splash' vigente y actualiza la caché para la
 * PRÓXIMA apertura. Guarda el logo como data-URL para que el splash no
 * dependa de ninguna request.
 *
 * No bloquea nada visible: si no hay patrocinador, limpia la caché.
 */

const CACHE_KEY = "mi_splash_sponsor";

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return null;
    const blob = await res.blob();
    // Evitar cachear archivos grandes en localStorage (~límite 5MB).
    if (blob.size > 400_000) return url; // usa la URL directa como fallback
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export default function SplashSponsorSync() {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("banners")
        .select("id,title,image_url,link_url,valid_from,valid_until")
        .eq("position", "splash")
        .eq("active", true)
        .order("sort_order")
        .limit(10);

      if (cancelled) return;

      // Filtra por vigencia de fechas (si están definidas).
      const vigente = (data ?? []).find((b: any) => {
        const fromOk = !b.valid_from || b.valid_from <= today;
        const untilOk = !b.valid_until || b.valid_until >= today;
        return fromOk && untilOk;
      });

      if (!vigente) {
        localStorage.removeItem(CACHE_KEY);
        return;
      }

      const img = vigente.image_url ? await toDataUrl(vigente.image_url) : null;
      if (cancelled) return;

      const payload = JSON.stringify({
        id: vigente.id,
        name: vigente.title ?? null,
        img: img ?? vigente.image_url ?? null,
        link: vigente.link_url ?? null,
      });

      try {
        localStorage.setItem(CACHE_KEY, payload);
      } catch {
        /* localStorage lleno o bloqueado — ignorar */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
