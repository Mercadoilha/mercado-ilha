"use client";

import Link from "next/link";

type ListingCardProps = {
  listing: any;
  isFavorite: boolean;
  onToggleFavorite: (listingId: number) => Promise<void>;
  sessionExists: boolean;
  busy: boolean;
};

export default function ListingCard({
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

  const firstPhoto = listing.listing_photos?.[0]?.photo_url ?? null;

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
            width: 80,
            height: 80,
            borderRadius: 10,
            background: "var(--blue-xlight)",
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
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
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
          <div
            style={{
              fontSize: "0.78rem",
              color: "var(--text-muted)",
              marginTop: 2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {listing.description}
          </div>
          <div style={{ fontSize: "1rem", fontWeight: 800, color: "var(--blue-main)", marginTop: 4 }}>
            {price}
          </div>
          {listing.condition && (
            <span className="badge badge-blue" style={{ marginTop: 4, display: "inline-block" }}>
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
}
