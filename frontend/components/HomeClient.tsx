"use client";

import { memo } from "react";
import Link from "next/link";
import BannerRotativo from "./BannerRotativo";
import { whatsappUrl } from "../lib/adminSettings";
import { openWhatsApp } from "../lib/whatsappUrl";
import { trackWhatsappClick } from "../lib/tracking";
import { useSession } from "../contexts/SessionContext";
import ShareIcon from "./ShareIcon";
import BuscaAutocomplete from "./BuscaAutocomplete";
import MaresWidget from "./MaresWidget";

const SLUG_ICON: Record<string, string> = {
  "produtos": "📦", "servicos-do-lar": "🏠", "construcao": "🔨",
  "beleza-e-bem-estar": "💅", "translados": "🚗", "envios": "📫",
  "gastronomia": "🍽️", "terrenos": "🌍", "casas": "🏡", "alugueis": "🔑",
};

type Banner = {
  id: number;
  title: string | null;
  image_url: string;
  link_url: string | null;
};

type Props = {
  listings: any[];
  categories: any[];
  adminWa: string;
  banners: Banner[];
  bannerInterval: number;
};

export default function HomeClient({ listings, categories, adminWa, banners, bannerInterval }: Props) {
  const { session } = useSession();

  const shareText = "Compra e vende na ilha de Tinharé! Veja anúncios de produtos, serviços, gastronomia e muito mais no Mercado Ilha 🏝️";

  const handleShare = async () => {
    const shareData = {
      title: "Mercado Ilha",
      text: shareText,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        // Usuário pode ter cancelado. No fallback, abrimos WhatsApp.
        const waUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${window.location.href}`)}`;
        window.open(waUrl, "_blank", "noopener,noreferrer");
      }
      return;
    }

    const waUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${window.location.href}`)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Mercado Ilha" style={{ height: "40px", width: "auto", display: "block" }} />

          <button
            type="button"
            onClick={handleShare}
            title="Compartilhar Mercado Ilha"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(255,255,255,0.18)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.35)",
              borderRadius: 999,
              padding: "0.55rem 0.85rem",
              fontSize: "0.85rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <ShareIcon />
            Compartilhar
          </button>
        </div>

        {/* ── Barra de búsqueda ── */}
        <BuscaAutocomplete />
      </header>

      {/* ── Banner publicitário ── */}
      <BannerRotativo position="home" banners={banners} adminWa={adminWa} bannerInterval={bannerInterval} />

      {/* ── Categorias ── */}
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
              href={`/category/${cat.slug}`}
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
              {cat.description && (
                <span style={{ fontSize: "0.62rem", color: "var(--text-muted)", textAlign: "center", lineHeight: 1.2, marginTop: -2 }}>
                  {cat.description}
                </span>
              )}
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

        {listings.length === 0 && (
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

      {/* ── Marés do dia ── */}
      <MaresWidget />

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
          <button
            type="button"
            onClick={() => { trackWhatsappClick(null, "suggestion"); openWhatsApp(whatsappUrl(adminWa, "Tenho uma sugestão para o Mercado Ilha")); }}
            className="btn btn-whatsapp"
            style={{ width: "100%", display: "flex", justifyContent: "center", cursor: "pointer" }}
          >
            💬 Fale conosco pelo WhatsApp
          </button>
        </div>
      </section>
    </div>
  );
}

const RecentListingRow = memo(function RecentListingRow({ listing }: { listing: any }) {
  const price = listing.price != null
    ? `R$ ${Number(listing.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
    : listing.price_text ?? "Consulte";

  const sortedPhotos = [...(listing.listing_photos ?? [])].sort(
    (a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );
  const firstPhoto: string | null = sortedPhotos[0]?.photo_url ?? null;
  const locationText: string | null = (listing.localities as any)?.name ?? null;

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
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {firstPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={firstPhoto}
            alt={listing.title}
            loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          "🛍️"
        )}
      </div>

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
        {locationText && (
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            📍 {locationText}
          </div>
        )}
        {listing.condition && (
          <span style={{ display: "inline-block", marginTop: 3, fontSize: "0.65rem", fontWeight: 700, background: "#f1f5f9", color: "#64748b", borderRadius: 999, padding: "1px 7px" }}>
            {listing.condition}
          </span>
        )}
      </div>

      <span style={{ fontSize: "1rem", color: "#cbd5e1", flexShrink: 0 }}>›</span>
    </Link>
  );
});

