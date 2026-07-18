"use client";

import { memo } from "react";
import Link from "next/link";
import Image from "next/image";
import { setListingPreview } from "../lib/listingPreview";
import { prefetchListingDetail } from "../lib/listingDetailPrefetch";

type ListingCardProps = {
  listing: any;
  isFavorite?: boolean;
  onToggleFavorite?: (listingId: number) => Promise<void>;
  sessionExists?: boolean;
  busy?: boolean;
  priority?: boolean;
  // Reforma 4: contorno dorado de los anuncios destacados del inicio. El contorno se
  // dibuja SIN mover el layout (outline con offset negativo + un brillo interior sutil),
  // así no rompe las líneas divisorias del grid ni desalinea las filas.
  featured?: boolean;
};

export default memo(function ListingCard({
  listing,
  isFavorite,
  onToggleFavorite,
  sessionExists,
  busy,
  priority,
  featured,
}: ListingCardProps) {
  const hasNumericPrice = listing.price != null;
  const priceMain = hasNumericPrice
    ? `R$ ${Number(listing.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
    : (listing.price_text?.trim() || "Consulte");
  // Quando há preço fixo, o texto de preço vira uma nota curta exibida abaixo do valor.
  const priceNote = hasNumericPrice ? (listing.price_text?.trim() || null) : null;

  const sortedPhotos = [...(listing.listing_photos ?? [])].sort(
    (a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );
  const firstPhoto: string | null = sortedPhotos[0]?.photo_url ?? null;

  const locationText: string | null = (listing.localities as any)?.name ?? null;

  return (
    <article
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        background: "#fff",
        minWidth: 0,
        overflow: "hidden",
        borderRadius: 0,
      }}
    >
      {/* Contorno que enmarca la card por encima de la imagen (la imagen ya no lo tapa),
          sin empujar el layout. Destacados del inicio → dorado con un brillo sutil; el resto
          → el mismo marco pero en gris. pointer-events:none → no interfiere con los toques. */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          border: featured ? "1.5px solid #C9A227" : "1.5px solid #a9b4c1",
          boxShadow: featured ? "inset 0 0 11px rgba(201,162,39,0.16)" : "none",
          pointerEvents: "none",
          zIndex: 2,
        }}
      />
      <Link
        href={`/listings/${listing.id}`}
        // Se dispara en pointerdown (apenas se apoya el dedo/mouse), que ocurre unas
        // fracciones de segundo ANTES del click/navegación → la query del detalle arranca
        // con esa ventaja y la descripción llega antes a la vista. onClick queda como
        // respaldo (teclado/enter); prefetchListingDetail deduplica y setListingPreview
        // es idempotente, así que dispararlo dos veces no cuesta nada.
        onPointerDown={() => {
          setListingPreview({
            id: listing.id,
            title: listing.title,
            price: listing.price ?? null,
            price_text: listing.price_text ?? null,
            condition: listing.condition ?? null,
            firstPhoto,
            localityName: locationText,
            description: listing.description ?? null,
          });
          // Dispara la query completa del detalle en paralelo con la navegación (barato,
          // async) → la descripción y las demás fotos llegan al toque.
          prefetchListingDetail(listing.id);
        }}
        onClick={() => {
          setListingPreview({
            id: listing.id,
            title: listing.title,
            price: listing.price ?? null,
            price_text: listing.price_text ?? null,
            condition: listing.condition ?? null,
            firstPhoto,
            localityName: locationText,
            description: listing.description ?? null,
          });
          prefetchListingDetail(listing.id);
        }}
        style={{
          display: "flex",
          flexDirection: "column",
          textDecoration: "none",
          color: "inherit",
        }}
      >
        {/* Imagem grande no topo (moldura estilo Mercado Livre) */}
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "1 / 1",
            background: "#fafbfc",
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
              priority={priority}
              style={{ objectFit: "contain" }}
            />
          ) : (
            <span style={{ fontSize: "2.5rem" }}>🛍️</span>
          )}
        </div>

        {/* Conteúdo */}
        <div style={{ padding: "0.4rem 0.55rem 0.55rem", textAlign: "center" }}>
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
          <div
            style={{
              fontSize: hasNumericPrice ? "0.95rem" : "0.85rem",
              fontWeight: 700,
              color: "var(--blue-main)",
              marginTop: 3,
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {priceMain}
          </div>
          {priceNote && (
            <div
              style={{
                fontSize: "0.68rem",
                color: "var(--text-muted)",
                marginTop: 1,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {priceNote}
            </div>
          )}
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
              {locationText}
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
            zIndex: 3,
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
