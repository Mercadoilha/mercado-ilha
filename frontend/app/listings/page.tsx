"use client";

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import ListingCard from '../../components/ListingCard';

export default function ListingsPage() {
  const [listings, setListings] = useState<any[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<number[]>([]);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data?.session ?? null);
    }

    loadSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setSession(session ?? null);
      }
    });

    return () => {
      mounted = false;
      if (listener?.subscription) listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setLoading(true);
      setError(null);

      const [listingsResult, favoritesResult] = await Promise.all([
        supabase
          .from('listings')
          .select('*')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(100),
        session
          ? supabase
              .from('favorites')
              .select('listing_id')
              .eq('profile_id', session.user.id)
          : Promise.resolve({ data: [], error: null }),
      ] as const);

      if (!mounted) return;

      if (listingsResult.error) {
        setError(listingsResult.error.message);
        setListings([]);
      } else {
        setListings(listingsResult.data ?? []);
      }

      if (session && favoritesResult?.error) {
        setError(favoritesResult.error.message);
        setFavoriteIds([]);
      } else if (favoritesResult?.data) {
        setFavoriteIds(favoritesResult.data.map((fav: any) => fav.listing_id));
      }

      setLoading(false);
    }

    loadData();

    return () => { mounted = false; };
  }, [session]);

  const toggleFavorite = async (listingId: number) => {
    if (!session) {
      setError('Inicia sesión para gestionar favoritos.');
      return;
    }

    const isFavorite = favoriteIds.includes(listingId);
    setBusyIds((current) => [...current, listingId]);
    setError(null);

    if (isFavorite) {
      const { error: deleteError } = await supabase
        .from('favorites')
        .delete()
        .eq('listing_id', listingId)
        .eq('profile_id', session.user.id);

      if (deleteError) {
        setError(deleteError.message);
      } else {
        setFavoriteIds((current) => current.filter((id) => id !== listingId));
      }
    } else {
      const { error: insertError } = await supabase
        .from('favorites')
        .insert({ listing_id: listingId, profile_id: session.user.id });

      if (insertError) {
        setError(insertError.message);
      } else {
        setFavoriteIds((current) => [...current, listingId]);
      }
    }

    setBusyIds((current) => current.filter((id) => id !== listingId));
  };

  return (
    <main className="page-container">
      <h1>Listados</h1>
      {loading && <p>Cargando anuncios...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!loading && listings.length === 0 && <p>No hay anuncios activos.</p>}
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', marginTop: 16 }}>
        {listings.map((l) => (
          <ListingCard
            key={l.id}
            listing={l}
            sessionExists={!!session}
            isFavorite={favoriteIds.includes(l.id)}
            busy={busyIds.includes(l.id)}
            onToggleFavorite={toggleFavorite}
          />
        ))}
      </div>
    </main>
  );
}
