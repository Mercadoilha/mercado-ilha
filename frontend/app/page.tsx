"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import BannerRotativo from "../components/BannerRotativo";
import { getAdminSettings, whatsappUrl } from "../lib/adminSettings";

// Fallback icons por slug cuando la DB no tiene icon configurado
const SLUG_ICON: Record<string, string> = {
  "produtos": "📦", "servicos-do-lar": "🏠", "construcao": "🔨",
  "beleza-e-bem-estar": "💅", "translados": "🚗", "envios": "📫",
  "gastronomia": "🍽️", "terrenos": "🌍", "casas": "🏡", "alugueis": "🔑",
};

export default function Home() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [listings, setListings] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [adminWa, setAdminWa] = useState("5571999999999");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data?.session ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => listener?.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    Promise.all([
      supabase.from("listings").select("id, title, price, price_text, locality_id, subzone_id, category_id, created_at").eq("status", "active").order("created_at", { ascending: false }).limit(10),
      supabase.from("categories").select("id,name,slug,icon").eq("is_active", true).order("sort_order"),
      getAdminSettings(),
    ]).then(([{ data: listData }, { data: catData }, settings]) => {
      setListings(listData ?? []);
      setCategories(catData ?? []);
      setAdminWa(settings.whatsapp);
      setLoading(false);
    });
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) router.push(`/listings?q=${encodeURIComponent(search.trim())}`);
  };

  return (
    <div className="page-body">
      {/* ── Header azul ── */}
      <header
        style={{
          background: "linear-gradient(135deg, var(--blue-main) 0%, var(--blue-mid) 100%)",
          padding: "1rem",
          color: "#fff",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mercado-ilha-icone.svg" alt="Mercado Ilha" style={{ height: "40px", width: "40px", display: "block" }} />

          {/* Auth */}
          {session ? (
            <Link
              href="/profile"
              style={{
                background: "rgba(255,255,255,0.2)",
                color: "#fff",
                borderRadius: 999,
                padding: "0.4rem 0.9rem",
                fontSize: "0.8rem",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              👤 Perfil
            </Link>
          ) : (
            <Link
              href="/signin"
              style={{
                background: "rgba(255,255,255,0.2)",
                color: "#fff",
                borderRadius: 999,
                padding: "0.4rem 0.9rem",
                fontSize: "0.8rem",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Entrar
            </Link>
          )}
        </div>

        {/* ── Barra de búsqueda ── */}
        <form onSubmit={handleSearch} style={{ marginTop: "0.875rem" }}>
          <div style={{ position: "relative" }}>
            <span
              style={{
                position: "absolute",
                left: "0.875rem",
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: "1rem",
                pointerEvents: "none",
              }}
            >
              🔍
            </span>
            <input
              type="text"
              placeholder="O que você procura?"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "0.7rem 0.875rem 0.7rem 2.5rem",
                borderRadius: 12,
                border: "none",
                fontSize: "0.95rem",
                background: "rgba(255,255,255,0.95)",
                color: "#0f172a",
                outline: "none",
              }}
            />
          </div>
        </form>
      </header>

      {/* ── Banner publicitário ── */}
      <BannerRotativo position="home" />

      {/* ── Categorías ── */}
      <section style={{ padding: "0 1rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.75rem", color: "#1e293b" }}>
          Categorias
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "0.625rem",
          }}
        >
          {categories.map((cat) => (
            <Link
              key={cat.slug}
              href={`/listings?category=${cat.slug}`}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                padding: "0.75rem 0.5rem",
                background: "#fff",
                borderRadius: 12,
                border: "1px solid var(--border)",
                textDecoration: "none",
                color: "#1e293b",
                transition: "box-shadow 0.15s",
              }}
            >
              <span style={{ fontSize: "1.6rem", lineHeight: 1 }}>{cat.icon || SLUG_ICON[cat.slug] || "📌"}</span>
              <span style={{ fontSize: "0.72rem", fontWeight: 600, textAlign: "center", lineHeight: 1.2 }}>
                {cat.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Anúncios recentes ── */}
      <section style={{ padding: "1.25rem 1rem 0.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#1e293b" }}>Anúncios recentes</h2>
          <Link href="/listings" style={{ fontSize: "0.8rem", color: "var(--blue-main)", fontWeight: 700, textDecoration: "none" }}>
            Ver todos →
          </Link>
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "2rem 0" }}>
            <div className="spinner" />
          </div>
        )}

        {!loading && listings.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "2rem 1rem",
              background: "#fff",
              borderRadius: 12,
              color: "var(--text-muted)",
            }}
          >
            <div style={{ fontSize: "2rem", marginBottom: 8 }}>🛍️</div>
            <p style={{ fontSize: "0.9rem" }}>Ainda não há anúncios.</p>
            <p style={{ fontSize: "0.8rem", marginTop: 4 }}>Seja o primeiro a publicar!</p>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          {listings.map((l) => (
            <RecentListingRow key={l.id} listing={l} />
          ))}
        </div>
      </section>

      {/* ── Fale conosco ── */}
      <section style={{ margin: "1.5rem 1rem 1rem" }}>
        <div
          style={{
            background: "#fff",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "1rem",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
            Sugestões ou problemas? Fala com a gente!
          </p>
          <a
            href={whatsappUrl(adminWa, "Tenho uma sugestão para o Mercado Ilha")}
            target="_blank"
            rel="noreferrer"
            className="btn btn-whatsapp"
            style={{ width: "100%", display: "flex", justifyContent: "center" }}
          >
            💬 Fale conosco pelo WhatsApp
          </a>
        </div>
      </section>
    </div>
  );
}

function RecentListingRow({ listing }: { listing: any }) {
  const price = listing.price != null
    ? `R$ ${Number(listing.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
    : listing.price_text ?? "Consulte";

  return (
    <Link
      href={`/listings/${listing.id}`}
      style={{
        display: "flex",
        gap: "0.75rem",
        background: "#fff",
        borderRadius: 12,
        border: "1px solid var(--border)",
        overflow: "hidden",
        textDecoration: "none",
        color: "inherit",
        alignItems: "center",
        padding: "0.625rem",
      }}
    >
      {/* Miniatura */}
      <div
        style={{
          width: 72,
          height: 72,
          minWidth: 72,
          borderRadius: 8,
          background: "var(--blue-xlight)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.75rem",
        }}
      >
        🛍️
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: "0.9rem",
            color: "#1e293b",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {listing.title}
        </div>
        <div style={{ fontSize: "1rem", fontWeight: 800, color: "var(--blue-main)", marginTop: 2 }}>
          {price}
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
          📍 Tinharé
        </div>
      </div>

      <span style={{ fontSize: "1rem", color: "#cbd5e1", flexShrink: 0 }}>›</span>
    </Link>
  );
}
