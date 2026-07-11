"use client";

import { useEffect } from "react";
import Image from "next/image";

/**
 * Hoja de compartir el app (se abre al tocar "Compartilhar" en el header del home).
 * Arriba: botón para compartir por mensaje (share nativo del celular / fallback WhatsApp).
 * Abajo: código QR con leyenda, para pasar el app en persona sin tener que enviar nada.
 * Se monta solo cuando se abre (lazy vía next/dynamic desde el home), así no pesa en la
 * carga inicial. Cerrar: tocar afuera, la X, o Escape.
 */
const SHARE_TEXT =
  "Compra e vende na ilha de Tinharé! Veja anúncios de produtos, serviços, gastronomia e muito mais no Mercado Ilha 🏝️";

export default function ShareAppModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleShareMessage = async () => {
    const url = window.location.origin + "/";
    const waUrl = `https://wa.me/?text=${encodeURIComponent(`${SHARE_TEXT} ${url}`)}`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Mercado Ilha", text: SHARE_TEXT, url });
        onClose();
      } catch {
        // Cancelado o falló: caemos a WhatsApp.
        window.open(waUrl, "_blank", "noopener,noreferrer");
      }
      return;
    }

    window.open(waUrl, "_blank", "noopener,noreferrer");
  };

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
        aria-label="Compartilhar Mercado Ilha"
        className="share-sheet-rise"
        style={{
          position: "relative",
          background: "#fff",
          borderRadius: "22px 22px 0 0",
          padding: "10px 20px calc(env(safe-area-inset-bottom) + 22px)",
          maxWidth: 440,
          width: "100%",
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
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: "1.12rem", fontWeight: 800, letterSpacing: "-0.01em", color: "var(--blue-main)" }}>
            Compartilhe Mercado Ilha
          </div>
          <p style={{ fontSize: "0.88rem", color: "var(--text-muted)", margin: "3px 0 0" }}>
            Compartilhe com facilidade 🏝️
          </p>
        </div>

        {/* Botão: compartilhar por mensagem */}
        <button
          type="button"
          onClick={handleShareMessage}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 9,
            width: "100%",
            border: "none",
            cursor: "pointer",
            background: "var(--blue-main)",
            color: "#fff",
            borderRadius: 13,
            padding: 15,
            fontSize: "0.98rem",
            fontWeight: 700,
            fontFamily: "inherit",
          }}
        >
          <svg
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
          Compartilhar por mensagem
        </button>

        {/* Divisor */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            color: "var(--text-muted)",
            fontSize: "0.76rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            margin: "18px 0 16px",
          }}
        >
          <span style={{ flex: 1, height: 1, background: "rgba(24,95,165,0.12)" }} />
          ou
          <span style={{ flex: 1, height: 1, background: "rgba(24,95,165,0.12)" }} />
        </div>

        {/* QR */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div
            style={{
              background: "#fff",
              padding: 12,
              borderRadius: 18,
              border: "1px solid rgba(24,95,165,0.12)",
              boxShadow: "0 6px 18px rgba(24,95,165,0.10)",
            }}
          >
            <Image
              src="/qr-mercadoilha.png"
              alt="Código QR do Mercado Ilha"
              width={178}
              height={178}
              style={{ display: "block", width: 178, height: 178 }}
            />
          </div>
          <p style={{ margin: "12px 0 0", fontSize: "0.86rem", fontWeight: 600, color: "#0f172a", textAlign: "center" }}>
            Aponte a câmera para o código
          </p>
          <p style={{ margin: "3px 0 0", fontSize: "0.78rem", color: "var(--text-muted)", textAlign: "center" }}>
            Abre o Mercado Ilha na hora, sem digitar nada
          </p>
        </div>
      </div>
    </div>
  );
}
