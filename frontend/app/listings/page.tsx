"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import ListingCard from "../../components/ListingCard";

const SLUG_ICON_FALLBACK: Record<string, string> = {
  "produtos": "📦", "servicos-do-lar": "🏠", "construcao": "🔨",
  "beleza-e-bem-estar": "💅", "translados": "🚗", "envios": "📫",
  "gastronomia": "🍽️", "terrenos": "🌍", "casas": "🏡", "alugueis": "🔑",
};

export default function ListingsPage() {
  return (
    <Suspense fallback={<div className="page-body" style={{ display: "flex", justifyContent: "center", paddingTop: "4rem" }}><div className="spinner" /></div>}>
      <ListingsContent />
    </Suspense>
  );
}

function ListingsContent() {
  const searchParams = useSearchParams();
  const categorySlug = searchParams.get("category") ?? "";
  const searchQuery = searchParams.get("q") ?? "";

  const [listings, setListings] = useState<any[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<number[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [categoryLabel, setCategoryLabel] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [conditionFilter, setConditionFilter] = useState("");

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data?.session ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => {
      if (mounted) setSession(s ?? null);
    });
    return () => {
      mounted = false;
      listener?.subscription.unsubscribe();
    };
  }, []);

  // Resolve category slug → id
  useEffect(() => {
    if (!categorySlug) { setCategoryId(null); setCategoryLabel(""); setConditionFilter(""); return; }
    if (categorySlug !== "produtos") setConditionFilter("");
    supabase
      .from("categories")
      .select("id,name,icon")
      .eq("slug", categorySlug)
      .single()
      .then(({ data }) => {
        setCategoryId(data?.id ?? null);
        const icon = data?.icon || SLUG_ICON_FALLBACK[categorySlug] || "📌";
        setCategoryLabel(data?.name ? `${icon} ${data.name}` : categorySlug);
      });
  }, [categorySlug]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    async function load() {
      let query = supabase
        .from("listings")
        .select("*, listing_photos(photo_url, sort_order)")
        .eq("status", "active")
        .limit(60);

      if (categoryId) query = query.eq("category_id", categoryId);
      if (searchQuery) query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      if (conditionFilter) query = query.eq("condition", conditionFilter);

      if (sortBy === "price_asc") query = query.order("price", { ascending: true, nullsFirst: false });
      else if (sortBy === "price_desc") query = query.order("price", { ascending: false, nullsFirst: false });
      else query = query.order("created_at", { ascending: false });

      const [listingsResult, favResult] = await Promise.all([
        query,
        session
          ? supabase.from("favorites").select("listing_id").eq("profile_id", session.user.id)
          : Promise.resolve({ data: [], error: null }),
      ] as const);

      if (!mounted) return;

      if (listingsResult.error) {
        setError(listingsResult.error.message);
        setListings([]);
      } else {
        setListings(listingsResult.data ?? []);
      }

      if (favResult?.data) {
        setFavoriteIds((favResult.data as any[]).map((f) => f.listing_id));
      }

      setLoading(false);
    }

    // Wait for category resolution if slug is given
    if (categorySlug && categoryId === null && categorySlug !== "") return;
    load();

    return () => { mounted = false; };
  }, [session, categoryId, categorySlug, searchQuery, sortBy, conditionFilter]);

  const toggleFavorite = async (listingId: number) => {
    if (!session) { setError("Entre para guardar favoritos."); return; }
    const isFav = favoriteIds.includes(listingId);
    setBusyIds((c) => [...c, listingId]);
    setError(null);
    if (isFav) {
      const { error: e } = await supabase
        .from("favorites")
        .delete()
        .eq("listing_id", listingId)
        .eq("profile_id", session.user.id);
      if (e) setError(e.message);
      else setFavoriteIds((c) => c.filter((id) => id !== listingId));
    } else {
      const { error: e } = await supabase
        .from("favorites")
        .insert({ listing_id: listingId, profile_id: session.user.id });
      if (e) setError(e.message);
      else setFavoriteIds((c) => [...c, listingId]);
    }
    setBusyIds((c) => c.filter((id) => id !== listingId));
  };

  const pageTitle = categorySlug
    ? categoryLabel || "Anúncios"
    : searchQuery
    ? `"${searchQuery}"`
    : "Todos os anúncios";

  return (
    <div className="page-body">
      {/* Header */}
      <header className="page-header">
        <Link href="/" style={{ color: "#fff", textDecoration: "none", fontSize: "1.2rem" }}>
          ←
        </Link>
        <h1>{pageTitle}</h1>
      </header>

      {/* Filtros activos */}
      {(categorySlug || searchQuery) && (
        <div style={{ padding: "0.75rem 1rem 0", display: "flex", gap: 8, flexWrap: "wrap" }}>
          {categorySlug && (
            <Link
              href="/listings"
              className="badge badge-blue"
              style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
            >
              {categoryLabel || categorySlug} ✕
            </Link>
          )}
          {searchQuery && (
            <Link
              href="/listings"
              className="badge badge-sand"
              style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
            >
              🔍 {searchQuery} ✕
            </Link>
          )}
        </div>
      )}

      {/* Sort & Filtros */}
      <div style={{ borderBottom: "1px solid var(--border)", background: "#fff" }}>
        {/* Ordenar */}
        <div style={{ display: "flex", gap: 6, padding: "0.5rem 1rem 0", overflowX: "auto" }}>
          {[
            { key: "recent", label: "🕐 Recentes" },
            { key: "price_asc", label: "💲 Menor preço" },
            { key: "price_desc", label: "💰 Maior preço" },
          ].map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setSortBy(opt.key)}
              style={{
                flexShrink: 0,
                padding: "0.3rem 0.75rem",
                borderRadius: 999,
                border: sortBy === opt.key ? "none" : "1px solid var(--border)",
                background: sortBy === opt.key ? "var(--blue-main)" : "#fff",
                color: sortBy === opt.key ? "#fff" : "var(--text-muted)",
                fontWeight: 600,
                fontSize: "0.75rem",
                cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {/* Condição — solo para Produtos */}
        {categorySlug === "produtos" && (
          <div style={{ display: "flex", gap: 6, padding: "0.4rem 1rem 0.5rem", overflowX: "auto" }}>
            {[
              { key: "", label: "Todos" },
              { key: "Novo", label: "✨ Novo" },
              { key: "Seminovo", label: "👍 Seminovo" },
              { key: "Usado", label: "♻️ Usado" },
            ].map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setConditionFilter(opt.key)}
                style={{
                  flexShrink: 0,
                  padding: "0.28rem 0.7rem",
                  borderRadius: 999,
                  border: conditionFilter === opt.key ? "none" : "1px solid var(--border)",
                  background: conditionFilter === opt.key ? "var(--sand)" : "#fff",
                  color: conditionFilter === opt.key ? "#fff" : "var(--text-muted)",
                  fontWeight: 600,
                  fontSize: "0.72rem",
                  cursor: "pointer",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Contenido */}
      <div style={{ padding: "0.75rem 1rem" }}>
        {error && <p className="text-error" style={{ marginBottom: 8 }}>{error}</p>}

        {loading && (
          <div style={{ textAlign: "center", padding: "3rem 0" }}>
            <div className="spinner" />
          </div>
        )}

        {!loading && listings.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "3rem 1rem",
              background: "#fff",
              borderRadius: 12,
              color: "var(--text-muted)",
            }}
          >
            <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🔦</div>
            <p style={{ fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>
              Nenhum anúncio encontrado
            </p>
            <p style={{ fontSize: "0.875rem" }}>
              {searchQuery ? "Tente buscar por outro termo." : "Seja o primeiro a publicar nessa categoria!"}
            </p>
            <Link
              href="/publish"
              className="btn btn-primary"
              style={{ marginTop: 16, display: "inline-flex" }}
            >
              + Publicar anúncio
            </Link>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          {listings.map((l) => (
            <ListingCard
              key={l.id}
              listing={l}
              sessionExists={!!session}
              isFavorite={favoriteIds.includes(l.id)}
              busy={busyIds.includes(l.id)}
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
