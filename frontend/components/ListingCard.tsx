"use client";

import { memo } from "react";
import Link from "next/link";

type ListingCardProps = {
  listing: any;
  isFavorite: boolean;
  onToggleFavorite: (listingId: number) => Promise<void>;
  sessionExists: boolean;
  busy: boolean;
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

  const locationText: string | null = (listing.localities as any)?.name ?? null;

  return (
    <article
      style={{
        display: "flex",
        gap: "0.75rem",
        background: "#fff",
        borderRadius: 12,
        border: "1px solid var(--border)",
        overflow: "hidden",
        alignItems: "center",
        padding: "0.625rem",
        position: "relative",
      }}
    >
      {/* Miniatura */}
      <Link
        href={`/listings/${listing.id}`}
        style={{ flexShrink: 0, textDecoration: "none" }}
      >
        <div
          style={{
            width: 100,
            height: 100,
            borderRadius: 10,
            background: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {firstPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={firstPhoto}
              alt={listing.title}
              loading="lazy"
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          ) : (
            <span style={{ fontSize: "2rem" }}>🛍️</span>
          )}
        </div>
      </Link>

      {/* Contenido */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <Link
          href={`/listings/${listing.id}`}
          style={{ textDecoration: "none", color: "inherit" }}
        >
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
          <div style={{ fontSize: "1rem", fontWeight: 800, color: "var(--blue-main)", marginTop: 3 }}>
            {price}
          </div>
          {locationText && (
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                marginTop: 2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              📍 {locationText}
            </div>
          )}
          {listing.condition && (
            <span style={{ display: "inline-block", marginTop: 3, fontSize: "0.65rem", fontWeight: 700, background: "#f1f5f9", color: "#64748b", borderRadius: 999, padding: "1px 7px" }}>
              {listing.condition}
            </span>
          )}
        </Link>
      </div>

      {/* Favorito */}
      <button
        type="button"
        onClick={() => onToggleFavorite(listing.id)}
        disabled={busy}
        className="fav-btn"
        title={sessionExists ? (isFavorite ? "Remover favorito" : "Favoritar") : "Entre para favoritar"}
        style={{ flexShrink: 0, alignSelf: "flex-start", paddingTop: 2 }}
      >
        {busy ? "⏳" : isFavorite ? "❤️" : "🤍"}
      </button>
    </article>
  );
});
