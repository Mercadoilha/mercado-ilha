"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import { buildWaUrl, openWhatsApp } from "../../../lib/whatsappUrl";
import { compartilhar } from "../../../lib/share";

export default function StorePage() {
  const params = useParams();
  const router = useRouter();
  const sellerId = params?.id as string;

  const [seller, setSeller] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data?.session ?? null));
    const { data: l } = supabase.auth.onAuthStateChange((_e, s) => setSession(s ?? null));
    return () => l?.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sellerId) { setError("Vendedor não encontrado."); setLoading(false); return; }
    let mounted = true;

    async function load() {
      const [sellerRes, listingsRes] = await Promise.all([
        supabase.from("profiles").select("id,full_name,whatsapp,avatar_url,created_at").eq("id", sellerId).single(),
        supabase
          .from("listings")
          .select("id,title,price,price_text,condition,created_at,category_id,listing_photos(photo_url,sort_order)")
          .eq("user_id", sellerId)
          .eq("status", "active")
          .order("created_at", { ascending: false }),
      ]);

      if (!mounted) return;

      if (sellerRes.error || !sellerRes.data) {
        setError("Vendedor não encontrado.");
        setLoading(false);
        return;
      }
      setSeller(sellerRes.data);
      setListings(listingsRes.data ?? []);
      setLoading(false);
    }

    load();
    return () => { mounted = false; };
  }, [sellerId]);

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

  const listingPrice = (l: any) =>
    l.price != null
      ? `R$ ${Number(l.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
      : l.price_text ?? "Consulte";

  const firstPhoto = (l: any) =>
    (l.listing_photos ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order)[0]?.photo_url ?? null;

  return (
    <div className="page-body">
      {/* Header */}
      <header className="page-header">
        <Link href="/listings" style={{ color: "#fff", textDecoration: "none", fontSize: "1.2rem" }}>←</Link>
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
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "2rem",
            margin: "0 auto 0.75rem",
            overflow: "hidden",
            border: "2px solid rgba(255,255,255,0.5)",
          }}
        >
          {seller.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={seller.avatar_url} alt={seller.full_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : "👤"}
        </div>
        <div style={{ fontWeight: 800, fontSize: "1.2rem", marginBottom: 4 }}>{seller.full_name}</div>
        <div style={{ fontSize: "0.8rem", opacity: 0.85 }}>
          Membro desde {memberSince} · {listings.length} anúncio{listings.length !== 1 ? "s" : ""} ativo{listings.length !== 1 ? "s" : ""}
        </div>

        {seller.whatsapp && (
          <button
            type="button"
            onClick={() => {
              if (!session) { router.push("/signin?msg=contact"); return; }
              openWhatsApp(buildWaUrl(seller.whatsapp, `Olá ${seller.full_name}! Vi sua loja no Mercado Ilha.`));
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginTop: 12,
              background: "#25d366",
              color: "#fff",
              padding: "0.5rem 1.25rem",
              borderRadius: 999,
              fontWeight: 700,
              fontSize: "0.875rem",
              border: "none",
              cursor: "pointer",
            }}
          >
            💬 Falar com o vendedor
          </button>
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
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginTop: 8,
            background: "transparent",
            color: "#fff",
            padding: "0.5rem 1.25rem",
            borderRadius: 999,
            fontWeight: 700,
            fontSize: "0.875rem",
            border: "2px solid rgba(255,255,255,0.7)",
            cursor: "pointer",
          }}
        >
          📤 Compartilhar loja
        </button>
      </div>

      {/* Anúncios */}
      <div style={{ padding: "1rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.75rem" }}>
          Anúncios ativos
        </h2>

        {listings.length === 0 ? (
          <div className="card" style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
            <div style={{ fontSize: "2rem", marginBottom: 8 }}>🛍️</div>
            <p style={{ fontSize: "0.875rem" }}>Este vendedor não tem anúncios ativos no momento.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
            {listings.map((l) => {
              const photo = firstPhoto(l);
              return (
                <Link
                  key={l.id}
                  href={`/listings/${l.id}`}
                  style={{
                    display: "flex",
                    gap: "0.75rem",
                    background: "#fff",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    padding: "0.625rem",
                    textDecoration: "none",
                    color: "inherit",
                    alignItems: "center",
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
                      overflow: "hidden",
                      fontSize: "1.75rem",
                    }}
                  >
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt={l.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : "🛍️"}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {l.title}
                    </div>
                    <div style={{ fontSize: "1rem", fontWeight: 800, color: "var(--blue-main)", marginTop: 2 }}>
                      {listingPrice(l)}
                    </div>
                    {l.condition && (
                      <span className="badge badge-sand" style={{ marginTop: 4, display: "inline-block" }}>
                        {l.condition}
                      </span>
                    )}
                  </div>

                  <span style={{ color: "#cbd5e1", flexShrink: 0 }}>›</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
