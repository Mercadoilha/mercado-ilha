"use client";

export default function ListingCard({ listing }: { listing: any }) {
  return (
    <article style={{ border: '1px solid #e6eef6', padding: 12, borderRadius: 8 }}>
      <h3 style={{ margin: '0 0 8px' }}>{listing.title}</h3>
      <p style={{ margin: 0, color: '#475569' }}>{listing.description}</p>
      {listing.price != null && <p style={{ marginTop: 8, fontWeight: 700 }}>R$ {listing.price}</p>}
    </article>
  );
}
