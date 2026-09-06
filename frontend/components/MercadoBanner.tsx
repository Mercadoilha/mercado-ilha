"use client";

import Link from "next/link";

// Acesso ao Mercado Agroecológico, no Início: entre a linha de Lojas/Favoritos e o
// começo dos anúncios. É um banner pequeno, não um botão a mais: fundo verde-mar
// (a única coisa verde numa tela toda azul) e o nome tratado como logotipo, em
// serifada, para que se leia como "outro lugar" e não como mais uma categoria.
//
// A serifada é do próprio sistema (Georgia e equivalentes): diferencia de verdade
// e não custa nem um byte de fonte baixada — a tela não atrasa por causa dele.

type Props = {
  title: string;
  subtitle: string | null;
  badge: string | null;
};

export default function MercadoBanner({ title, subtitle, badge }: Props) {
  return (
    <Link
      href="/mercado"
      prefetch
      aria-label={title}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 12,
        overflow: "hidden",
        padding: "0.85rem 1rem",
        minHeight: 92,
        textDecoration: "none",
        background: "linear-gradient(135deg, #0F6E56 0%, #14805F 55%, #18946D 100%)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* Folhagem decorativa: fica atrás do texto, sem roubar leitura */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute", right: -8, bottom: -18, fontSize: "5.5rem",
          opacity: 0.16, lineHeight: 1, pointerEvents: "none",
        }}
      >
        🌿
      </span>

      <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "Georgia, 'Iowan Old Style', 'Times New Roman', serif",
            fontSize: "1.6rem", fontWeight: 700, color: "#fff", lineHeight: 1.12,
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: "0.74rem", color: "rgba(255,255,255,0.9)", marginTop: 5, lineHeight: 1.3 }}>
            {subtitle}
          </div>
        )}
      </div>

      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
        {badge && (
          <span
            style={{
              background: "var(--sand)", color: "#fff", fontSize: "0.62rem", fontWeight: 800,
              padding: "2px 8px", borderRadius: 999, textTransform: "uppercase", letterSpacing: "0.06em",
            }}
          >
            {badge}
          </span>
        )}
        <span
          aria-hidden="true"
          style={{
            width: 42, height: 42, borderRadius: "50%", background: "rgba(255,255,255,0.24)",
            color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.4rem", fontWeight: 700, lineHeight: 1,
          }}
        >
          →
        </span>
      </div>
    </Link>
  );
}
