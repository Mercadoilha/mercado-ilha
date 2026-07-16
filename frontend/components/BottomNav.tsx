"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "../contexts/SessionContext";

export default function BottomNav() {
  const pathname = usePathname();
  const { session } = useSession();

  const active = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const link = (href: string): React.CSSProperties => ({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
    textDecoration: "none",
    fontSize: "0.62rem",
    fontWeight: 600,
    color: active(href) ? "var(--blue-main)" : "#94a3b8",
    minWidth: 48,
  });

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: "var(--nav-height)",
        background: "#fff",
        borderTop: "1px solid var(--border)",
        display: "flex",
        // Levanta os itens do bordo inferior do telefone: a área útil fica acima do padding.
        paddingBottom: 8,
        alignItems: "center",
        justifyContent: "space-around",
        zIndex: 100,
      }}
    >
      <Link href="/" style={link("/")}>
        <span style={{ fontSize: "1.3rem" }}>🏠</span>
        Início
      </Link>

      <Link href="/categorias" style={link("/categorias")}>
        <span style={{ fontSize: "1.3rem" }}>🗂️</span>
        Categorias
      </Link>

      {/* Botón central publicar */}
      <Link
        href="/publish"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: active("/publish") ? "#c47d0a" : "var(--sand)",
          color: "#fff",
          fontSize: "1.7rem",
          textDecoration: "none",
          boxShadow: "0 4px 14px rgba(239,159,39,0.5)",
          marginBottom: 10,
          flexShrink: 0,
        }}
        aria-label="Publicar anúncio"
      >
        +
      </Link>

      <Link href="/informacao" style={link("/informacao")}>
        <span style={{ fontSize: "1.3rem" }}>ℹ️</span>
        Informação
      </Link>

      {session ? (
        <Link href="/profile" style={link("/profile")}>
          <span style={{ fontSize: "1.3rem" }}>👤</span>
          Perfil
        </Link>
      ) : (
        <Link href="/signin" style={link("/signin")}>
          <span style={{ fontSize: "1.3rem" }}>🔑</span>
          Entrar
        </Link>
      )}
    </nav>
  );
}
