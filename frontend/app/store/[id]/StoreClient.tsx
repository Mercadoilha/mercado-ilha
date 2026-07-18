"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "../../../lib/supabaseClient";
import { buildWaUrl } from "../../../lib/whatsappUrl";
import { trackWhatsappClick } from "../../../lib/tracking";
import { compartilhar } from "../../../lib/share";
import { useSession } from "../../../contexts/SessionContext";
import ShareIcon from "../../../components/ShareIcon";
import ListingCard from "../../../components/ListingCard";
import { getCachedFavorites, loadFavorites, addFavorite, removeFavorite } from "../../../lib/favoritesCache";
import { getFeaturedIdsSync, loadFeaturedIds } from "../../../lib/featuredCache";
import { cursorFromLast, applyKeysetCursor } from "../../../lib/listingsApi";

// Tamaño de página de la tienda (T5 del plan V3). Menor que /listings (60) porque
// acá no hay 2 columnas de filtros previos: la lista es más corta en general.
const STORE_PAGE_SIZE = 30;

// `description` viaja acá igual que en LISTINGS_SELECT: las cards de la loja son
// ListingCard y siembran el preview optimista, así el detalle pinta la descripción al
// instante sin esperar la query cliente del detalle.
const STORE_SELECT =
  "id,title,description,price,price_text,condition,created_at,category_id,listing_photos(photo_url,sort_order),localities(name)";

export default function StorePage() {
  const params = useParams();
  const router = useRouter();
  const sellerId = params?.id as string;
  const { session } = useSession();

  const [seller, setSeller] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [busyIds, setBusyIds] = useState<number[]>([]);
  // Destacados (contorno dorado): mismo conjunto que el inicio, del caché de sesión.
  // No bloquea el render — el dorado aparece cuando resuelve (igual que favoritos).
  const [featuredIds, setFeaturedIds] = useState<Set<number> | null>(() => getFeaturedIdsSync());
  const [sellerPhone, setSellerPhone] = useState<string | null>(null);
  const [avatarOpen, setAvatarOpen] = useState(false);
  // T5: paginación "Ver mais anúncios" (keyset por created_at, id). totalCount es el
  // conteo exacto de activos del vendedor (para el encabezado "X anúncios ativos"),
  // independiente de cuántos haya cargados en pantalla.
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // T8: refs para que toggleFavorite tenga deps estables ([]) y no se recree
  // (ni re-renderice todas las ListingCard) en cada toggle. Mismo patrón que
  // app/listings/ListingsClient.tsx.
  const favoriteIdsRef = useRef(favoriteIds);
  favoriteIdsRef.current = favoriteIds;
  const sessionRef = useRef(session);
  sessionRef.current = session;

  // Vendedor + anúncios não dependem da sessão: disparam de imediato, em
  // uma única tanda concorrente (sem esperar getSession()).
  useEffect(() => {
    if (!sellerId) { setError("Vendedor não encontrado."); setLoading(false); return; }
    let mounted = true;

    async function load() {
      const [sellerRes, listingsRes] = await Promise.all([
        supabase.from("profiles_public").select("id,full_name,avatar_url,created_at").eq("id", sellerId).single(),
        supabase
          .from("listings")
          .select(STORE_SELECT, { count: "exact" })
          .order("sort_order", { referencedTable: "listing_photos" })
          .limit(1, { referencedTable: "listing_photos" })
          .eq("user_id", sellerId)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .order("id", { ascending: false }) // desempate estable para el keyset
          .limit(STORE_PAGE_SIZE),
      ]);

      if (!mounted) return;

      if (sellerRes.error || !sellerRes.data) {
        console.error("[StorePage] sellerRes error:", sellerRes.error);
        setError("Vendedor não encontrado.");
        setLoading(false);
        return;
      }
      const rows = listingsRes.data ?? [];
      setSeller(sellerRes.data);
      setListings(rows);
      setTotalCount(listingsRes.count ?? rows.length);
      setHasMore(rows.length >= STORE_PAGE_SIZE);
      setLoading(false);
    }

    load();
    return () => { mounted = false; };
  }, [sellerId]);

  // T5: trae la siguiente página por cursor keyset. Sin extras/fusión (a diferencia
  // de /listings): 1 sola query, todo lo del vendedor ya viene filtrado por user_id.
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    const cursor = cursorFromLast(listings);
    if (!cursor) return;
    setLoadingMore(true);
    let q = supabase
      .from("listings")
      .select(STORE_SELECT)
      .order("sort_order", { referencedTable: "listing_photos" })
      .limit(1, { referencedTable: "listing_photos" })
      .eq("user_id", sellerId)
      .eq("status", "active");
    q = applyKeysetCursor(q, cursor);
    const { data, error: e } = await q
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(STORE_PAGE_SIZE);
    if (e) { setError(e.message); setLoadingMore(false); return; }
    const rows = data ?? [];
    setListings((prev) => [...prev, ...rows]);
    setHasMore(rows.length >= STORE_PAGE_SIZE);
    setLoadingMore(false);
  }, [loadingMore, hasMore, listings, sellerId]);

  // Favoritos desde o caché de sessão (T8): resolve em efeito próprio quando
  // há sessão, sem bloquear o load de vendedor+anúncios acima.
  useEffect(() => {
    if (!session) { setFavoriteIds(new Set()); return; }
    const uid = session.user.id;
    const cached = getCachedFavorites(uid);
    if (cached) { setFavoriteIds(new Set(cached)); return; }
    let mounted = true;
    loadFavorites(uid).then((ids) => { if (mounted) setFavoriteIds(new Set(ids)); });
    return () => { mounted = false; };
  }, [session]);

  // Destacados: carga del caché de sesión si aún no está (no bloquea el render).
  useEffect(() => {
    if (getFeaturedIdsSync()) return;
    let mounted = true;
    loadFeaturedIds().then((s) => { if (mounted) setFeaturedIds(s); });
    return () => { mounted = false; };
  }, []);

  // Pre-fetch seller phone so the contact button is fully synchronous (avoids mobile popup blocker)
  useEffect(() => {
    if (!session || !seller?.id) { setSellerPhone(null); return; }
    supabase.rpc("get_seller_whatsapp", { seller_id: seller.id })
      .then(({ data }) => setSellerPhone(data ?? null));
  }, [session, seller?.id]);

  const toggleFavorite = useCallback(async (listingId: number) => {
    const session = sessionRef.current;
    if (!session) { router.push("/signin?msg=contact"); return; }
    const isFav = favoriteIdsRef.current.has(listingId);
    setBusyIds((c) => [...c, listingId]);
    if (isFav) {
      const { error: e } = await supabase.from("favorites").delete().eq("listing_id", listingId).eq("profile_id", session.user.id);
      if (!e) { removeFavorite(session.user.id, listingId); setFavoriteIds((c) => { const next = new Set(c); next.delete(listingId); return next; }); }
    } else {
      const { error: e } = await supabase.from("favorites").insert({ listing_id: listingId, profile_id: session.user.id });
      if (!e) { addFavorite(session.user.id, listingId); setFavoriteIds((c) => new Set([...c, listingId])); }
    }
    setBusyIds((c) => c.filter((id) => id !== listingId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  if (loading) return (
    <div className="page-body" style={{ display: "flex", justifyContent: "center", paddingTop: "4rem" }}>
      <div className="spinner" />
    </div>
  );

  if (error || !seller) return (
    <div className="page-body">
      <header className="page-header">
        <Link href="/" style={{ color: "#fff", textDecoration: "none", fontSize: "1.2rem" }}>←</Link>
        <h1>Loja</h1>
      </header>
      <div style={{ padding: "2rem 1rem", textAlign: "center" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>😕</div>
        <p style={{ fontWeight: 700, color: "#1e293b" }}>Vendedor não encontrado</p>
        <Link href="/listings" className="btn btn-primary" style={{ marginTop: 16, display: "inline-flex" }}>
          Ver anúncios
        </Link>
      </div>
    </div>
  );

  const memberSince = new Date(seller.created_at).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="page-body">
      {/* Header */}
      <header className="page-header">
        <button
          type="button"
          onClick={() => router.back()}
          style={{ color: "#fff", background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", padding: 0 }}
        >←</button>
        <h1 style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          Loja de {seller.full_name}
        </h1>
      </header>

      {/* Banner da loja */}
      <div
        style={{
          background: "linear-gradient(135deg, var(--blue-main) 0%, var(--blue-mid) 100%)",
          padding: "1.5rem 1rem",
          textAlign: "center",
          color: "#fff",
        }}
      >
        <div
          onClick={() => { if (seller.avatar_url) setAvatarOpen(true); }}
          style={{
            width: 84,
            height: 84,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "2.2rem",
            margin: "0 auto 0.75rem",
            overflow: "hidden",
            border: "2px solid rgba(255,255,255,0.5)",
            cursor: seller.avatar_url ? "zoom-in" : "default",
          }}
        >
          {seller.avatar_url ? (
            <Image src={seller.avatar_url} alt={seller.full_name} width={84} height={84} sizes="84px" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : "👤"}
        </div>
        <div style={{ fontWeight: 800, fontSize: "1.2rem", marginBottom: 4 }}>{seller.full_name}</div>
        <div style={{ fontSize: "0.8rem", opacity: 0.85 }}>
          Membro desde {memberSince} · {totalCount} anúncio{totalCount !== 1 ? "s" : ""} ativo{totalCount !== 1 ? "s" : ""}
        </div>

        {/* Lado a lado (fila): dos botones de igual ancho (flex:1) y misma altura
            (alignItems stretch). El texto puede acomodarse en dos líneas si el
            sistema usa una fuente más ancha (Roboto en Android vs SF en iPhone),
            manteniéndose parejo en ambos. */}
        <div style={{ display: "flex", flexDirection: "row", gap: 8, marginTop: 12, maxWidth: 380, marginLeft: "auto", marginRight: "auto", alignItems: "stretch" }}>
          {seller && (
            sellerPhone ? (
              <a
                href={buildWaUrl(sellerPhone, `Olá ${seller.full_name}! Vi sua loja no Mercado Ilha.`)}
                target="_blank"
                rel="noreferrer"
                onClick={() => trackWhatsappClick(null, "store")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  lineHeight: 1.15,
                  flex: "1 1 0",
                  minWidth: 0,
                  gap: 6,
                  background: "#25d366",
                  color: "#fff",
                  padding: "0.55rem 0.6rem",
                  borderRadius: 999,
                  fontWeight: 700,
                  fontSize: "0.8rem",
                  border: "none",
                  cursor: "pointer",
                  textDecoration: "none",
                }}
              >
                💬 Falar com o vendedor
              </a>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (!session) { router.push("/signin?msg=contact"); return; }
                  alert("Este vendedor ainda não cadastrou o número de WhatsApp.");
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  lineHeight: 1.15,
                  flex: "1 1 0",
                  minWidth: 0,
                  gap: 6,
                  background: "#25d366",
                  color: "#fff",
                  padding: "0.55rem 0.6rem",
                  borderRadius: 999,
                  fontWeight: 700,
                  fontSize: "0.8rem",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                💬 Falar com o vendedor
              </button>
            )
          )}

          <button
            type="button"
            onClick={() =>
              compartilhar({
                title: "Loja de " + seller.full_name + " — Mercado Ilha",
                text: "Confira a loja de " + seller.full_name + " no Mercado Ilha!",
                url: window.location.href,
              })
            }
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              lineHeight: 1.15,
              flex: "1 1 0",
              minWidth: 0,
              gap: 6,
              background: "transparent",
              color: "#fff",
              padding: "0.55rem 0.6rem",
              borderRadius: 999,
              fontWeight: 700,
              fontSize: "0.8rem",
              border: "2px solid rgba(255,255,255,0.7)",
              cursor: "pointer",
            }}
          >
            <ShareIcon /> Compartilhar loja
          </button>
        </div>
      </div>

      {/* Anúncios — pequeno espaço acima do banner azul (metade do espaço original de 0.5rem). */}
      <div style={{ padding: "0.25rem 0 1rem" }}>
        {listings.length === 0 ? (
          <div className="card" style={{ margin: "0.25rem 1rem 0", padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
            <div style={{ fontSize: "2rem", marginBottom: 8 }}>🛍️</div>
            <p style={{ fontSize: "0.875rem" }}>Este vendedor não tem anúncios ativos no momento.</p>
          </div>
        ) : (
          <div className="listing-grid">
            {listings.map((l) => (
              <ListingCard
                key={l.id}
                listing={l}
                sessionExists={!!session}
                isFavorite={favoriteIds.has(l.id)}
                busy={busyIds.includes(l.id)}
                onToggleFavorite={toggleFavorite}
                featured={featuredIds?.has(l.id)}
              />
            ))}
          </div>
        )}

        {hasMore && (
          <div style={{ textAlign: "center", padding: "1.25rem 1rem 0.5rem" }}>
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              style={{
                width: "100%",
                maxWidth: 320,
                padding: "0.7rem 1rem",
                borderRadius: 10,
                border: "1px solid var(--blue-main)",
                background: "#fff",
                color: "var(--blue-main)",
                fontWeight: 700,
                fontSize: "0.9rem",
                cursor: loadingMore ? "default" : "pointer",
                opacity: loadingMore ? 0.6 : 1,
              }}
            >
              {loadingMore ? "Carregando…" : "Ver mais anúncios"}
            </button>
          </div>
        )}
      </div>

      {/* Visor da foto do vendedor ampliada */}
      {avatarOpen && seller.avatar_url && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setAvatarOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.92)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <button
            type="button"
            onClick={() => setAvatarOpen(false)}
            style={{ position: "absolute", top: 12, right: 16, background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: "50%", width: 36, height: 36, fontSize: "1.1rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}
          >
            ✕
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={seller.avatar_url}
            alt={seller.full_name}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "90vw", maxHeight: "85vh", width: "auto", height: "auto", borderRadius: 12, objectFit: "contain" }}
          />
        </div>
      )}
    </div>
  );
}
