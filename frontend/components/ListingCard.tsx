"use client";

import Link from 'next/link';

type ListingCardProps = {
  listing: any;
  isFavorite: boolean;
  onToggleFavorite: (listingId: number) => Promise<void>;
  sessionExists: boolean;
  busy: boolean;
};

export default function ListingCard({ listing, isFavorite, onToggleFavorite, sessionExists, busy }: ListingCardProps) {
  return (
    <article style={{ border: '1px solid #e6eef6', padding: 12, borderRadius: 8, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div>
        <h3 style={{ margin: '0 0 8px' }}>{listing.title}</h3>
        <p style={{ margin: 0, color: '#475569' }}>{listing.description}</p>
        {listing.price != null && <p style={{ marginTop: 8, fontWeight: 700 }}>R$ {listing.price}</p>}
      </div>

      <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
        <button
          type="button"
          onClick={() => onToggleFavorite(listing.id)}
          disabled={busy}
          style={{
            padding: '0.5rem 0.75rem',
            backgroundColor: isFavorite ? '#f97316' : '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: busy ? 'not-allowed' : 'pointer',
          }}
        >
          {busy ? 'Procesando...' : sessionExists ? (isFavorite ? 'Quitar favorito' : 'Agregar favorito') : 'Inicia sesión para favoritos'}
        </button>
        <Link href={`/listings/${listing.id}`} style={{ textAlign: 'center', padding: '0.5rem 0.75rem', backgroundColor: '#e2e8f0', borderRadius: 8, textDecoration: 'none', color: '#111' }}>
          Ver detalle
        </Link>
      </div>
    </article>
  );
}
