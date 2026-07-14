"use client";

import { useEffect } from "react";

/**
 * Cáscara de hoja que sube desde abajo (bottom sheet). Mismo patrón visual y de
 * animación que ShareAppModal: overlay oscuro, hoja blanca con grabber, `.share-sheet-rise`
 * de globals.css, cierre por tap afuera / X / Escape. La usan las hojas Ordenar y Filtrar
 * del feed de anuncios. Se monta solo al abrir (lazy vía next/dynamic) → no pesa en la
 * carga inicial de la página.
 */
export default function BottomSheet({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10,28,48,0.55)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: 0,
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
        className="share-sheet-rise"
        style={{
          position: "relative",
          background: "#fff",
          borderRadius: "22px 22px 0 0",
          padding: "10px 20px calc(env(safe-area-inset-bottom) + 22px)",
          maxWidth: 440,
          width: "100%",
          maxHeight: "82vh",
          overflowY: "auto",
          boxShadow: "0 -10px 40px rgba(8,28,50,0.22)",
        }}
      >
        {/* Grabber */}
        <div
          style={{
            width: 42,
            height: 4,
            borderRadius: 999,
            background: "rgba(24,95,165,0.15)",
            margin: "4px auto 12px",
          }}
        />

        {/* Cerrar */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            width: 32,
            height: 32,
            borderRadius: 999,
            border: "none",
            background: "var(--blue-xlight)",
            color: "var(--blue-main)",
            fontSize: 18,
            lineHeight: 1,
            cursor: "pointer",
          }}
        >
          ✕
        </button>

        {/* Cabeçalho */}
        <div style={{ marginBottom: 14, paddingRight: 36 }}>
          <div style={{ fontSize: "1.05rem", fontWeight: 800, letterSpacing: "-0.01em", color: "var(--blue-main)" }}>
            {title}
          </div>
          {subtitle && (
            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: "3px 0 0" }}>{subtitle}</p>
          )}
        </div>

        {children}
      </div>
    </div>
  );
}
