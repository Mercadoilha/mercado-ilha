"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import ListingCard from "../../components/ListingCard";
import { useSession } from "../../contexts/SessionContext";

const SORT_OPTIONS = [
  { key: "recent", label: "🕐 Recentes" },
  { key: "price_asc", label: "💲 Menor preço" },
  { key: "price_desc", label: "💰 Maior preço" },
] as const;

const CONDITION_OPTIONS = [
  { key: "", label: "Todos" },
  { key: "Novo", label: "✨ Novo" },
  { key: "Seminovo", label: "👍 Seminovo" },
  { key: "Usado", label: "♻️ Usado" },
] as const;

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
  const subcategoryIdParam = searchParams.get("subcategory_id") ?? "";

  const { session } = useSession();
  const [listings, setListings] = useState<any[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<number[]>([]);
  const [categoryLabel, setCategoryLabel] = useState("");
  const [subcategoryLabel, setSubcategoryLabel] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [conditionFilter, setConditionFilter] = useState("");
  const [localities, setLocalities] = useState<{ id: number; name: string }[]>([]);
  const [zoneFilter, setZoneFilter] = useState<number | null>(null);

  // Reset filters when category/search changes
  useEffect(() => { setZoneFilter(null); }, [categorySlug, searchQuery]);
  useEffect(() => {
    if (!categorySlug) { setCategoryLabel(""); setConditionFilter(""); return; }
    if (categorySlug !== "produtos") setConditionFilter("");
  }, [categorySlug]);

  // Resolve subcategory id → label
  useEffect(() => {
    if (!subcategoryIdParam) { setSubcategoryLabel(""); return; }
    supabase.from("subcategories").select("name").eq("id", Number(subcategoryIdParam)).single()
      .then(({ data }) => setSubcategoryLabel(data?.name ?? ""));
  }, [subcategoryIdParam]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    async function load() {
      const selectBase = "id, title, price, price_text, condition, locality_id, subzone_id, category_id, subcategory_id, created_at, listing_photos(photo_url, sort_order), localities(name), subzones(id, name)";

      // Resolver categoría por slug (id + etiqueta del encabezado).
      let catId: number | null = null;
      if (categorySlug) {
        const { data: cat } = await supabase.from("categories").select("id, name, icon").eq("slug", categorySlug).maybeSingle();
        if (mounted && cat) {
          catId = (cat as any).id;
          const icon = (cat as any).icon || SLUG_ICON_FALLBACK[categorySlug] || "📌";
          setCategoryLabel(`${icon} ${(cat as any).name}`);
        }
        // Slug inválido: sin categoría → no mostrar nada.
        if (!cat) {
          if (mounted) { setListings([]); setLoading(false); }
          return;
        }
      }

      // Anuncios que tienen esta categoría (y subcategoría) como SECUNDARIA.
      let extraIds: number[] = [];
      if (catId) {
        let ex = supabase.from("listing_extra_categories").select("listing_id").eq("category_id", catId);
        if (subcategoryIdParam) ex = ex.eq("subcategory_id", Number(subcategoryIdParam));
        const { data: exRows } = await ex;
        extraIds = Array.from(new Set((exRows ?? []).map((r: any) => r.listing_id)));
      }

      let query = supabase
        .from("listings")
        .select(selectBase)
        .eq("status", "active")
        .limit(60);

      // Incluir: categoría PRINCIPAL coincidente O anuncios con esta categoría SECUNDARIA.
      if (catId) {
        const primary = subcategoryIdParam
          ? `and(category_id.eq.${catId},subcategory_id.eq.${Number(subcategoryIdParam)})`
          : `category_id.eq.${catId}`;
        const ors = [primary];
        if (extraIds.length) ors.push(`id.in.(${extraIds.join(",")})`);
        query = query.or(ors.join(","));
      }
      if (searchQuery) query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      if (conditionFilter) query = query.eq("condition", conditionFilter);
      if (zoneFilter) {
        // Incluye: base en la localidad, "toda a ilha", o que atienda alguna sub-zona de la localidad
        const { data: zoneRows } = await supabase
          .from("listing_service_zones")
          .select("listing_id, subzones!inner(locality_id)")
          .eq("subzones.locality_id", zoneFilter);
        const ids = Array.from(new Set((zoneRows ?? []).map((r: any) => r.listing_id)));
        const ors = [`locality_id.eq.${zoneFilter}`, "covers_all_island.eq.true"];
        if (ids.length) ors.push(`id.in.(${ids.join(",")})`);
        query = query.or(ors.join(","));
      }

      if (sortBy === "price_asc") query = query.order("price", { ascending: true, nullsFirst: false });
      else if (sortBy === "price_desc") query = query.order("price", { ascending: false, nullsFirst: false });
      else query = query.order("created_at", { ascending: false });

      const [listingsResult, favResult, localitiesResult] = await Promise.all([
        query,
        session
          ? supabase.from("favorites").select("listing_id").eq("profile_id", session.user.id)
          : Promise.resolve({ data: [], error: null }),
        localities.length === 0
          ? supabase.from("localities").select("id, name").eq("is_active", true).order("sort_order")
          : Promise.resolve({ data: null, error: null }),
      ] as const);

      if (!mounted) return;

      if (localitiesResult.data) setLocalities(localitiesResult.data as { id: number; name: string }[]);

      if (listingsResult.error) {
        setError(listingsResult.error.message);
        setListings([]);
      } else {
        setListings(listingsResult.data ?? []);
      }

      if (favResult?.data) {
        setFavoriteIds(new Set((favResult.data as any[]).map((f) => f.listing_id)));
      }

      setLoading(false);
    }

    load();

    return () => { mounted = false; };
  }, [session, categorySlug, subcategoryIdParam, searchQuery, sortBy, conditionFilter, zoneFilter]);

  const toggleFavorite = useCallback(async (listingId: number) => {
    if (!session) { setError("Entre para guardar favoritos."); return; }
    const isFav = favoriteIds.has(listingId);
    setBusyIds((c) => [...c, listingId]);
    setError(null);
    if (isFav) {
      const { error: e } = await supabase
        .from("favorites")
        .delete()
        .eq("listing_id", listingId)
        .eq("profile_id", session.user.id);
      if (e) setError(e.message);
      else setFavoriteIds((c) => { const next = new Set(c); next.delete(listingId); return next; });
    } else {
      const { error: e } = await supabase
        .from("favorites")
        .insert({ listing_id: listingId, profile_id: session.user.id });
      if (e) setError(e.message);
      else setFavoriteIds((c) => new Set([...c, listingId]));
    }
    setBusyIds((c) => c.filter((id) => id !== listingId));
  }, [session, favoriteIds]);

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
          {subcategoryIdParam && subcategoryLabel && (
            <Link
              href={`/listings?category=${categorySlug}`}
              className="badge badge-blue"
              style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
            >
              {subcategoryLabel} ✕
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
          {SORT_OPTIONS.map((opt) => (
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
          <div style={{ display: "flex", gap: 6, padding: "0.4rem 1rem 0", overflowX: "auto" }}>
            {CONDITION_OPTIONS.map((opt) => (
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
        {/* Zona */}
        {localities.length > 0 && (
          <div style={{ display: "flex", gap: 6, padding: "0.4rem 1rem 0.5rem", overflowX: "auto" }}>
            <button
              type="button"
              onClick={() => setZoneFilter(null)}
              style={{
                flexShrink: 0,
                padding: "0.28rem 0.7rem",
                borderRadius: 999,
                border: zoneFilter === null ? "none" : "1px solid var(--border)",
                background: zoneFilter === null ? "var(--blue-main)" : "#fff",
                color: zoneFilter === null ? "#fff" : "var(--text-muted)",
                fontWeight: 600,
                fontSize: "0.72rem",
                cursor: "pointer",
              }}
            >
              📍 Todas as zonas
            </button>
            {localities.map((loc) => (
              <button
                key={loc.id}
                type="button"
                onClick={() => setZoneFilter(loc.id)}
                style={{
                  flexShrink: 0,
                  padding: "0.28rem 0.7rem",
                  borderRadius: 999,
                  border: zoneFilter === loc.id ? "none" : "1px solid var(--border)",
                  background: zoneFilter === loc.id ? "var(--blue-main)" : "#fff",
                  color: zoneFilter === loc.id ? "#fff" : "var(--text-muted)",
                  fontWeight: 600,
                  fontSize: "0.72rem",
                  cursor: "pointer",
                }}
              >
                {loc.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Contenido */}
      <div style={{ padding: "0.75rem 0" }}>
        {error && <p className="text-error" style={{ margin: "0 1rem 8px" }}>{error}</p>}

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
              margin: "0 1rem",
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

        <div style={{ display: "flex", flexDirection: "column" }}>
          {listings.map((l) => (
            <ListingCard
              key={l.id}
              listing={l}
              sessionExists={!!session}
              isFavorite={favoriteIds.has(l.id)}
              busy={busyIds.includes(l.id)}
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
