"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "../../../lib/supabaseClient";
import { buildWaUrl } from "../../../lib/whatsappUrl";
import { trackWhatsappClick } from "../../../lib/tracking";
import { compartilhar } from "../../../lib/share";
import ShareIcon from "../../../components/ShareIcon";
import ListingCard from "../../../components/ListingCard";

export default function StorePage() {
  const params = useParams();
  const router = useRouter();
  const sellerId = params?.id as string;

  const [seller, setSeller] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<any>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [busyIds, setBusyIds] = useState<number[]>([]);
  const [sellerPhone, setSellerPhone] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data?.session ?? null));
    const { data: l } = supabase.auth.onAuthStateChange((_e, s) => setSession(s ?? null));
    return () => l?.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sellerId) { setError("Vendedor não encontrado."); setLoading(false); return; }
    let mounted = true;

    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const activeSession = sessionData?.session ?? null;

      const [sellerRes, listingsRes, favRes] = await Promise.all([
        supabase.from("profiles_public").select("id,full_name,avatar_url,created_at").eq("id", sellerId).single(),
        supabase
          .from("listings")
          .select("id,title,price,price_text,condition,created_at,category_id,listing_photos(photo_url,sort_order),localities(name)")
          .order("sort_order", { referencedTable: "listing_photos" })
          .limit(1, { referencedTable: "listing_photos" })
          .eq("user_id", sellerId)
          .eq("status", "active")
          .order("created_at", { ascending: false }),
        activeSession
          ? supabase.from("favorites").select("listing_id").eq("profile_id", activeSession.user.id)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (!mounted) return;

      if (sellerRes.error || !sellerRes.data) {
        console.error("[StorePage] sellerRes error:", sellerRes.error);
        setError("Vendedor não encontrado.");
        setLoading(false);
        return;
      }
      setSeller(sellerRes.data);
      setListings(listingsRes.data ?? []);
      if (favRes?.data) {
        setFavoriteIds(new Set((favRes.data as any[]).map((f) => f.listing_id)));
      }
      setLoading(false);
    }

    load();
    return () => { mounted = false; };
  }, [sellerId]);

  // Pre-fetch seller phone so the contact button is fully synchronous (avoids mobile popup blocker)
  useEffect(() => {
    if (!session || !seller?.id) { setSellerPhone(null); return; }
    supabase.rpc("get_seller_whatsapp", { seller_id: seller.id })
      .then(({ data }) => setSellerPhone(data ?? null));
  }, [session, seller?.id]);

  const toggleFavorite = useCallback(async (listingId: number) => {
    if (!session) { router.push("/signin?msg=contact"); return; }
    const isFav = favoriteIds.has(listingId);
    setBusyIds((c) => [...c, listingId]);
    if (isFav) {
      const { error: e } = await supabase.from("favorites").delete().eq("listing_id", listingId).eq("profile_id", session.user.id);
      if (!e) setFavoriteIds((c) => { const next = new Set(c); next.delete(listingId); return next; });
    } else {
      const { error: e } = await supabase.from("favorites").insert({ listing_id: listingId, profile_id: session.user.id });
      if (!e) setFavoriteIds((c) => new Set([...c, listingId]));
    }
    setBusyIds((c) => c.filter((id) => id !== listingId));
  }, [session, favoriteIds, router]);

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
            <Image src={seller.avatar_url} alt={seller.full_name} width={72} height={72} sizes="72px" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : "👤"}
        </div>
        <div style={{ fontWeight: 800, fontSize: "1.2rem", marginBottom: 4 }}>{seller.full_name}</div>
        <div style={{ fontSize: "0.8rem", opacity: 0.85 }}>
          Membro desde {memberSince} · {listings.length} anúncio{listings.length !== 1 ? "s" : ""} ativo{listings.length !== 1 ? "s" : ""}
        </div>

        {seller && (
          sellerPhone ? (
            <a
              href={buildWaUrl(sellerPhone, `Olá ${seller.full_name}! Vi sua loja no Mercado Ilha.`)}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackWhatsappClick(null, "store")}
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
          <ShareIcon /> Compartilhar loja
        </button>
      </div>

      {/* Anúncios */}
      <div style={{ padding: "1rem 0" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#1e293b", margin: "0 1rem 0.75rem" }}>
          Anúncios ativos
        </h2>

        {listings.length === 0 ? (
          <div className="card" style={{ margin: "0 1rem", padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
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
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
