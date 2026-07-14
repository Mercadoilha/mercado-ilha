"use client";

import { useState } from "react";
import Link from "next/link";
import MaresWidget from "./MaresWidget";
import BarcosWidget from "./BarcosWidget";
import InstallSigninStrip from "./InstallSigninStrip";

// Pantalla /informacao (Reforma 6): presentación + marés + barcos + franja de instalar.
// Rediseño: fondo blanco, sin cajas azules (la info va directo con tipografía más grande).
// El botón "O que é o Mercado Ilha?" abre una presentación breve en una hoja modal —
// solo texto, render condicional local (no pesa nada en la carga de la ruta).
export default function InformacaoClient({ adminWa }: { adminWa: string }) {
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <div className="page-body" style={{ background: "#fff" }}>
      {/* ── Header azul ── */}
      <header className="page-header">
        <Link href="/" style={{ color: "#fff", textDecoration: "none", fontSize: "1.2rem" }}>←</Link>
        <h1>Informação útil</h1>
      </header>

      <section style={{ padding: "1rem" }}>
        {/* Breve bienvenida antes del botón de presentación */}
        <p
          style={{
            margin: "0 0 12px",
            fontSize: 15,
            lineHeight: 1.5,
            color: "#334155",
          }}
        >
          Bem-vindo ao <strong>Mercado Ilha</strong> 🏝 — o marketplace da nossa ilha.
          Aqui você encontra tudo o que se vende e se oferece por aqui, num só lugar.
        </p>

        {/* Botón de presentación de la app — fondo azul, letra blanca */}
        <button
          type="button"
          onClick={() => setAboutOpen(true)}
          className="btn btn-primary btn-block"
          style={{ fontSize: "0.95rem", padding: "0.75rem 1rem" }}
        >
          🏝 O que é o Mercado Ilha?
        </button>

        {/* Misma línea divisoria que separa las secciones */}
        <div style={{ borderTop: "1px solid var(--border)", margin: "16px 0 0" }} />

        <MaresWidget />
        <BarcosWidget />
      </section>

      <InstallSigninStrip />

      {/* Presentación breve — hoja modal */}
      {aboutOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setAboutOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(15,23,42,0.55)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          <div
            className="share-sheet-rise"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "var(--max-width)",
              background: "#fff",
              borderRadius: "16px 16px 0 0",
              padding: "1.25rem 1.25rem calc(1.25rem + env(safe-area-inset-bottom))",
              maxHeight: "85vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--blue-main)" }}>
                🏝 Mercado Ilha
              </h2>
              <button
                type="button"
                onClick={() => setAboutOpen(false)}
                aria-label="Fechar"
                style={{
                  background: "#f1f5f9",
                  border: "none",
                  borderRadius: 999,
                  width: 30,
                  height: 30,
                  fontSize: "0.9rem",
                  cursor: "pointer",
                  color: "#475569",
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: "0.95rem", lineHeight: 1.5, color: "#334155", marginBottom: "0.75rem" }}>
              O marketplace da ilha de Tinharé: tudo o que se vende e se oferece em
              Morro de São Paulo, Gamboa e região, num só lugar — sem se perder nos
              grupos de WhatsApp.
            </p>

            <p style={{ fontSize: "0.95rem", lineHeight: 1.5, color: "#334155", marginBottom: "0.75rem" }}>
              <strong>Como funciona:</strong> encontre o que procura e fale direto com
              o vendedor pelo WhatsApp, com um toque.
            </p>

            <p style={{ fontSize: "0.95rem", fontWeight: 700, color: "#334155", marginBottom: "0.35rem" }}>
              O que você pode fazer:
            </p>
            <ul style={{ margin: "0 0 1rem", paddingLeft: "1.25rem", fontSize: "0.92rem", lineHeight: 1.7, color: "#334155" }}>
              <li>Buscar por categoria ou pelo buscador</li>
              <li>Publicar seus anúncios grátis</li>
              <li>Salvar seus favoritos ❤️</li>
              <li>Ter sua própria lojinha com todos os seus anúncios</li>
              <li>Instalar o app na tela inicial do celular</li>
            </ul>

            <p style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--green-dark)", textAlign: "center", marginBottom: "1rem" }}>
              100% gratuito, feito para a ilha. 🌊
            </p>

            <button
              type="button"
              onClick={() => setAboutOpen(false)}
              className="btn btn-primary btn-block"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
