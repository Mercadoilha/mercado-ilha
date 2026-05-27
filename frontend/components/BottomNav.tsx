"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type CustomNav = { icon: string; label: string; category_slug: string };

export default function BottomNav() {
  const pathname = usePathname();
  const [hasSession, setHasSession] = useState(false);
  const [customNav, setCustomNav] = useState<CustomNav>({ icon: "🍽️", label: "Comida", category_slug: "gastronomia" });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data?.session));
    const { data: l } = supabase.auth.onAuthStateChange((_e, s) => setHasSession(!!s));
    supabase.from("admin_settings").select("value").eq("key", "nav_custom_1").single()
      .then(({ data }) => { if (data?.value) setCustomNav(data.value); });
    return () => l?.subscription.unsubscribe();
  }, []);

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

  const customHref = `/listings?category=${customNav.category_slug}`;

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
        alignItems: "center",
        justifyContent: "space-around",
        zIndex: 100,
      }}
    >
      <Link href="/" style={link("/")}>
        <span style={{ fontSize: "1.3rem" }}>🏠</span>
        Início
      </Link>

      <Link href="/listings" style={link("/listings")}>
        <span style={{ fontSize: "1.3rem" }}>🔍</span>
        Anúncios
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

      {hasSession ? (
        <Link href="/favorites" style={link("/favorites")}>
          <span style={{ fontSize: "1.3rem" }}>❤️</span>
          Favoritos
        </Link>
      ) : (
        <Link href={customHref} style={link(customHref)}>
          <span style={{ fontSize: "1.3rem" }}>{customNav.icon}</span>
          {customNav.label}
        </Link>
      )}

      {hasSession ? (
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
