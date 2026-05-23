"use client";

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

type Profile = {
  id: string;
  full_name: string;
  whatsapp: string;
  role: string;
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
};

export default function ProfilePage() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data?.session ?? null);
    }

    loadSession();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setSession(session ?? null);
    });

    return () => {
      mounted = false;
      if (sub?.subscription) sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    let mounted = true;

    async function loadProfileData() {
      setLoading(true);
      setError(null);

      const userId = session.user.id;
      const userEmail = session.user.email ?? 'Usuario';

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      let profileRow = profileData;

      if (!profileRow && profileError) {
        if (profileError.code !== 'PGRST116') {
          setError(profileError.message);
          setLoading(false);
          return;
        }
      }

      if (!profileRow) {
        const { data: insertedProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            full_name: userEmail,
            whatsapp: '',
            role: 'user',
          })
          .select('*')
          .single();

        if (insertError) {
          setError(insertError.message);
          setLoading(false);
          return;
        }

        profileRow = insertedProfile;
      }

      const [favoritesResult, conversationsResult] = await Promise.all([
        supabase
          .from('favorites')
          .select('id,created_at,listing_id,listings(id,title,price,status)')
          .eq('profile_id', userId)
          .order('created_at', { ascending: false }),
        supabase
          .from('conversations')
          .select('id,listing_id,status,last_message_at,listing(title)')
          .or(`buyer_profile_id.eq.${userId},seller_profile_id.eq.${userId}`)
          .order('updated_at', { ascending: false }),
      ]);

      if (favoritesResult.error) {
        setError(favoritesResult.error.message);
        setLoading(false);
        return;
      }

      if (conversationsResult.error) {
        setError(conversationsResult.error.message);
        setLoading(false);
        return;
      }

      if (!mounted) return;
      setProfile(profileRow);
      setFavorites(favoritesResult.data ?? []);
      setConversations(conversationsResult.data ?? []);
      setLoading(false);
    }

    loadProfileData();

    return () => {
      mounted = false;
    };
  }, [session]);

  if (!session) return (
    <main className="page-container">
      <h1>Perfil</h1>
      <p>No estás autenticado. <a href="/signin">Inicia sesión</a>.</p>
    </main>
  );

  if (loading) return (
    <main className="page-container">
      <h1>Mi perfil</h1>
      <p>Cargando datos...</p>
    </main>
  );

  if (error) return (
    <main className="page-container">
      <h1>Mi perfil</h1>
      <p style={{ color: 'red' }}>Error: {error}</p>
    </main>
  );

  return (
    <main className="page-container">
      <h1>Mi perfil</h1>
      <div style={{ marginBottom: 24 }}>
        <p><strong>Nombre:</strong> {profile?.full_name}</p>
        <p><strong>Email:</strong> {session.user.email}</p>
        <p><strong>WhatsApp:</strong> {profile?.whatsapp || 'No configurado'}</p>
        <p><strong>Rol:</strong> {profile?.role}</p>
      </div>

      <section style={{ marginBottom: 24 }}>
        <h2>Favoritos ({favorites.length})</h2>
        {favorites.length === 0 ? (
          <p>No tienes favoritos todavía.</p>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {favorites.map((fav) => (
              <div key={fav.id} style={{ border: '1px solid #e6eef6', borderRadius: 10, padding: 12 }}>
                <p style={{ margin: 0, fontWeight: 700 }}>{fav.listings?.title ?? 'Anuncio'}</p>
                <p style={{ margin: '4px 0 0' }}>Precio: {fav.listings?.price ? `R$ ${fav.listings.price}` : 'No disponible'}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2>Conversaciones ({conversations.length})</h2>
        {conversations.length === 0 ? (
          <p>No hay conversaciones activas.</p>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {conversations.map((conversation) => (
              <div key={conversation.id} style={{ border: '1px solid #e6eef6', borderRadius: 10, padding: 12 }}>
                <p style={{ margin: 0, fontWeight: 700 }}>{conversation.listing?.title ?? 'Conversación'}</p>
                <p style={{ margin: '4px 0 0' }}><strong>Estado:</strong> {conversation.status}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
