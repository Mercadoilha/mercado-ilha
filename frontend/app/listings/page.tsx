"use client";

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import ListingCard from '../../components/ListingCard';

export default function ListingsPage() {
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(100);
      if (!mounted) return;
      if (error) {
        setError(error.message);
        setListings([]);
      } else {
        setListings(data ?? []);
      }
      setLoading(false);
    }
    load();
    return () => { mounted = false; };
  }, []);

  return (
    <main className="page-container">
      <h1>Listados</h1>
      {loading && <p>Cargando anuncios...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!loading && listings.length === 0 && <p>No hay anuncios activos.</p>}
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', marginTop: 16 }}>
        {listings.map((l) => (
          <ListingCard key={l.id} listing={l} />
        ))}
      </div>
    </main>
  );
}
