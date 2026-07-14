"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import ShareIcon from "./ShareIcon";
import BuscaAutocomplete from "./BuscaAutocomplete";

// Modal de compartir: se carga solo al tocar "Compartilhar" (no pesa en el LCP).
const ShareAppModal = dynamic(() => import("./ShareAppModal"), { ssr: false });

// Banner azul con logo + "Compartilhar" + barra de búsqueda. Compartido por el inicio y
// la pantalla de Categorias para que ambos se vean idénticos (mismas opciones).
export default function SearchHeader() {
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <header
      style={{
        background: "linear-gradient(135deg, var(--blue-main) 0%, var(--blue-mid) 100%)",
        padding: "1rem",
        color: "#fff",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="Mercado Ilha" style={{ height: "40px", width: "auto", display: "block" }} />

        <button
          type="button"
          onClick={() => setShareOpen(true)}
          title="Compartilhar Mercado Ilha"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(255,255,255,0.18)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.35)",
            borderRadius: 999,
            padding: "0.55rem 0.85rem",
            fontSize: "0.85rem",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          <ShareIcon />
          Compartilhar
        </button>
      </div>

      {/* ── Barra de búsqueda ── */}
      <BuscaAutocomplete />

      {shareOpen && <ShareAppModal onClose={() => setShareOpen(false)} />}
    </header>
  );
}
