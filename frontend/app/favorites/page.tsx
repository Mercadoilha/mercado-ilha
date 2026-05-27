"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function FavoritesPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data?.session ?? null);
    });
    const { data: l } = supabase.auth.onAuthStateChange((_e, s) => {
      if (mounted) setSession(s ?? null);
    });
    return () => { mounted = false; l?.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (session === null && !loading) { router.push("/signin?msg=favorites"); return; }
    if (!session) return;

    let mounted = true;
    setLoading(true);

    supabase
      .from("favorites")
      .select("id, listing_id, listings(id, title, price, price_text, condition, status, locality_id, subzone_id, localities(name), listing_photos(photo_url, sort_order))")
      .eq("profile_id", session.user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!mounted) return;
        setFavorites(data ?? []);
        setLoading(false);
      });

    return () => { mounted = false; };
  }, [session, loading, router]);

  const removeFavorite = async (favId: number, listingId: number) => {
    setRemovingId(listingId);
    await supabase.from("favorites").delete().eq("id", favId);
    setFavorites((prev) => prev.filter((f) => f.id !== favId));
    setRemovingId(null);
  };

  const formatPrice = (l: any) =>
    l.price != null
      ? `R$ ${Number(l.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
      : l.price_text ?? "Consulte";

  if (loading) return (
    <div className="page-body" style={{ display: "flex", justifyContent: "center", paddingTop: "4rem" }}>
      <div className="spinner" />
    </div>
  );

  return (
    <div className="page-body">
      <header className="page-header">
        <Link href="/" style={{ color: "#fff", textDecoration: "none", fontSize: "1.2rem" }}>←</Link>
        <h1>Meus favoritos</h1>
      </header>

      <div style={{ padding: "0.75rem 1rem" }}>
        {favorites.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "3rem 1rem",
              background: "#fff",
              borderRadius: 12,
              color: "var(--text-muted)",
            }}
          >
            <div style={{ fontSize: "3rem", marginBottom: 12 }}>🤍</div>
            <p style={{ fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>Nenhum favorito ainda</p>
            <p style={{ fontSize: "0.875rem", marginBottom: 20 }}>
              Toque no ❤️ nos anúncios para salvá-los aqui.
            </p>
            <Link href="/listings" className="btn btn-primary" style={{ display: "inline-flex" }}>
              Ver anúncios
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
            {favorites.map((fav) => {
              const l = fav.listings as any;
              if (!l) return null;

              const sortedPhotos = [...(l.listing_photos ?? [])].sort(
                (a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
              );
              const firstPhoto: string | null = sortedPhotos[0]?.photo_url ?? null;
              const locationText: string | null = (l.localities as any)?.name ?? null;
              const isInactive = l.status !== "active";

              return (
                <div
                  key={fav.id}
                  style={{
                    display: "flex",
                    gap: "0.75rem",
                    background: "#fff",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    padding: "0.625rem",
                    alignItems: "center",
                    opacity: isInactive ? 0.6 : 1,
                  }}
                >
                  {/* Thumbnail */}
                  <Link href={`/listings/${l.id}`} style={{ flexShrink: 0, textDecoration: "none" }}>
                    <div
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: 8,
                        background: "var(--blue-xlight)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "1.75rem",
                        overflow: "hidden",
                        flexShrink: 0,
                      }}
                    >
                      {firstPhoto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={firstPhoto} alt={l.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : "🛍️"}
                    </div>
                  </Link>

                  {/* Info */}
                  <Link href={`/listings/${l.id}`} style={{ flex: 1, minWidth: 0, textDecoration: "none", color: "inherit" }}>
                    <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {l.title}
                    </div>
                    <div style={{ fontSize: "1rem", fontWeight: 800, color: "var(--blue-main)", marginTop: 2 }}>
                      {formatPrice(l)}
                    </div>
                    {locationText && (
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        📍 {locationText}
                      </div>
                    )}
                    {l.condition && (
                      <span style={{ display: "inline-block", marginTop: 3, fontSize: "0.65rem", fontWeight: 700, background: "#f1f5f9", color: "#64748b", borderRadius: 999, padding: "1px 7px" }}>
                        {l.condition}
                      </span>
                    )}
                    {isInactive && (
                      <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: 2 }}>
                        Anúncio indisponível
                      </div>
                    )}
                  </Link>

                  {/* Remove */}
                  <button
                    type="button"
                    onClick={() => removeFavorite(fav.id, l.id)}
                    disabled={removingId === l.id}
                    title="Remover dos favoritos"
                    style={{
                      background: "none",
                      border: "none",
                      fontSize: "1.3rem",
                      cursor: "pointer",
                      flexShrink: 0,
                      opacity: removingId === l.id ? 0.4 : 1,
                      padding: "0 4px",
                    }}
                  >
                    ❤️
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
