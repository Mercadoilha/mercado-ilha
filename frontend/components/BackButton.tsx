"use client";

import { useRouter } from "next/navigation";
import { safeBack } from "../lib/safeBack";

// Flecha de volver para páginas que se renderizan en el servidor (ej. la lista de
// subcategorías): vuelve a la pantalla desde la que se entró — el inicio si se llegó
// por el buscador, /categorias si se llegó desde ahí — y solo cae en `fallbackHref`
// cuando no hay pantalla anterior (link directo, atajo del PWA).
export default function BackButton({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => safeBack(router, fallbackHref)}
      aria-label="Voltar"
      style={{
        background: "none",
        border: "none",
        color: "#fff",
        fontSize: "1.2rem",
        cursor: "pointer",
        padding: 0,
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      ←
    </button>
  );
}
