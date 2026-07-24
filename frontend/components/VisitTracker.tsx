"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackAppVisit } from "../lib/tracking";

/**
 * Métrica de audiencia: registra cada pantalla abierta (carga inicial y
 * también las navegaciones internas, que no disparan una carga nueva).
 *
 * Reglas de rendimiento (pilar de velocidad):
 *   - Usa SOLO usePathname. useSearchParams obligaría a envolver esto en
 *     <Suspense> y sacaría del render estático a las rutas que hoy son ISR.
 *   - El envío se difiere a requestIdleCallback: nunca compite con la
 *     pintura de la pantalla ni con la transición entre rutas.
 *   - Es fire-and-forget (la RPC ignora errores): si el tracking falla,
 *     el usuario no se entera de nada.
 */

/** '/listings/482' → '/listings/:id'. Mantiene los slugs (categoría). */
function normalizePath(path: string): string {
  return path
    .split("/")
    .map((seg) =>
      /^\d+$/.test(seg) ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg)
        ? ":id"
        : seg
    )
    .join("/");
}

export default function VisitTracker() {
  const pathname = usePathname();
  // Evita el doble registro del StrictMode en desarrollo y cualquier
  // re-render que repita el mismo pathname.
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    // El panel de administración no es tráfico real del marketplace.
    if (pathname.startsWith("/admin")) return;

    const path = normalizePath(pathname);
    if (lastSent.current === path) return;
    lastSent.current = path;

    const send = () => trackAppVisit(path);
    const idle = (window as any).requestIdleCallback;
    if (typeof idle === "function") {
      const handle = idle(send, { timeout: 2000 });
      return () => (window as any).cancelIdleCallback?.(handle);
    }
    const t = setTimeout(send, 300);
    return () => clearTimeout(t);
  }, [pathname]);

  return null;
}
