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
 *     Por eso el marcador `?de=` se lee con window.location.search DENTRO
 *     del efecto (ya en el cliente), nunca con useSearchParams.
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

/**
 * Marcador de origen del link (`?de=grupo`). Solo la primera pantalla de
 * la visita lo lleva: después el parámetro ya no está en la URL y una
 * misma entrada no se cuenta dos veces.
 */
function readSource(): string | null {
  const raw = new URLSearchParams(window.location.search).get("de");
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  return /^[a-z0-9_-]{1,24}$/.test(s) ? s : null;
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
    const first = lastSent.current === null;
    lastSent.current = path;

    // El origen solo tiene sentido en la pantalla de entrada.
    const source = first ? readSource() : null;

    const send = () => trackAppVisit(path, source);
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
