"use client";

import { memo } from "react";
import Link from "next/link";
import Image from "next/image";

type ListingCardProps = {
  listing: any;
  isFavorite?: boolean;
  onToggleFavorite?: (listingId: number) => Promise<void>;
  sessionExists?: boolean;
  busy?: boolean;
};

export default memo(function ListingCard({
  listing,
  isFavorite,
  onToggleFavorite,
  sessionExists,
  busy,
}: ListingCardProps) {
  const price =
    listing.price != null
      ? `R$ ${Number(listing.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
      : listing.price_text ?? "Consulte";

  const sortedPhotos = [...(listing.listing_photos ?? [])].sort(
    (a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );
  const firstPhoto: string | null = sortedPhotos[0]?.photo_url ?? null;

  const locationText: string | null =
    (listing.subzones as any)?.name ??
    (listing.localities as any)?.name ??
    null;

  return (
    <article
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        background: "#fff",
        border: "1px solid var(--border)",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <Link
        href={`/listings/${listing.id}`}
        style={{
          display: "flex",
          flexDirection: "column",
          textDecoration: "none",
          color: "inherit",
        }}
      >
        {/* Imagem grande no topo (full-bleed) */}
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "1 / 1",
            background: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {firstPhoto ? (
            <Image
              src={firstPhoto}
              alt={listing.title}
              fill
              sizes="(max-width: 520px) 50vw, 240px"
              style={{ objectFit: "contain" }}
            />
          ) : (
            <span style={{ fontSize: "2.5rem" }}>🛍️</span>
          )}
        </div>

        {/* Conteúdo */}
        <div style={{ padding: "0.4rem 0.55rem 0.55rem" }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: "0.8rem",
              color: "#334155",
              lineHeight: 1.25,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {listing.title}
          </div>
          <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--blue-main)", marginTop: 3, letterSpacing: "-0.01em" }}>
            {price}
          </div>
          {locationText && (
            <div
              style={{
                fontSize: "0.7rem",
                color: "var(--text-muted)",
                marginTop: 1,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              📍 {locationText}
            </div>
          )}
          {listing.condition && (
            <span style={{ display: "inline-block", marginTop: 4, fontSize: "0.62rem", fontWeight: 600, background: "#f1f5f9", color: "#64748b", borderRadius: 999, padding: "1px 7px" }}>
              {listing.condition}
            </span>
          )}
        </div>
      </Link>

      {/* Favorito (opcional) — overlay no canto da imagem */}
      {onToggleFavorite && (
        <button
          type="button"
          onClick={() => onToggleFavorite(listing.id)}
          disabled={busy}
          className="fav-btn"
          title={sessionExists ? (isFavorite ? "Remover favorito" : "Favoritar") : "Entre para favoritar"}
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            background: "rgba(255,255,255,0.9)",
            borderRadius: 999,
            width: 34,
            height: 34,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
          }}
        >
          {busy ? "⏳" : isFavorite ? "❤️" : "🤍"}
        </button>
      )}
    </article>
  );
});
