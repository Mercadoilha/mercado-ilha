"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabaseClient';

export default function ListingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const listingId = Number(params?.id ?? params?.['id']);

  const [listing, setListing] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [existingConversation, setExistingConversation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
    if (!listingId || Number.isNaN(listingId)) {
      setError('ID de anuncio inválido.');
      setLoading(false);
      return;
    }

    let mounted = true;

    async function loadListing() {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .eq('id', listingId)
        .single();

      if (!mounted) return;
      if (error || !data) {
        setError(error?.message ?? 'No se encontró el anuncio.');
        setListing(null);
      } else {
        setListing(data);
      }
      setLoading(false);
    }

    loadListing();

    return () => { mounted = false; };
  }, [listingId]);

  useEffect(() => {
    if (!listing || !session) {
      setExistingConversation(null);
      return;
    }

    let mounted = true;

    async function loadConversation() {
      const { data, error } = await supabase
        .from('conversations')
        .select('id,status')
        .eq('listing_id', listing.id)
        .or(`buyer_profile_id.eq.${session.user.id},seller_profile_id.eq.${session.user.id}`)
        .limit(1);

      if (!mounted) return;
      if (!error && data?.length) {
        setExistingConversation(data[0]);
      }
    }

    loadConversation();

    return () => { mounted = false; };
  }, [listing, session]);

  const handleStartConversation = async () => {
    if (!session) {
      setError('Debes iniciar sesión para iniciar una conversación.');
      return;
    }

    if (!listing) {
      setError('No hay anuncio seleccionado.');
      return;
    }

    if (session.user.id === listing.user_id) {
      setError('No puedes iniciar conversación con tu propio anuncio.');
      return;
    }

    setActionLoading(true);
    setError(null);
    setSuccess(null);

    const { data, error } = await supabase
      .from('conversations')
      .insert({
        listing_id: listing.id,
        buyer_profile_id: session.user.id,
        seller_profile_id: listing.user_id,
        status: 'open',
        last_message_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      setError(error.message);
    } else {
      setSuccess('Conversación iniciada. Puedes ver los detalles en tu perfil.');
      setExistingConversation({ id: data?.id, status: 'open' });
    }

    setActionLoading(false);
  };

  if (loading) {
    return (
      <main className="page-container">
        <h1>Detalle del anuncio</h1>
        <p>Cargando anuncio...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="page-container">
        <h1>Detalle del anuncio</h1>
        <p style={{ color: 'red' }}>{error}</p>
        <Link href="/listings" style={{ display: 'inline-block', marginTop: 16 }}>
          Volver a listados
        </Link>
      </main>
    );
  }

  if (!listing) {
    return (
      <main className="page-container">
        <h1>Detalle del anuncio</h1>
        <p>No se pudo cargar el anuncio.</p>
        <Link href="/listings" style={{ display: 'inline-block', marginTop: 16 }}>
          Volver a listados
        </Link>
      </main>
    );
  }

  return (
    <main className="page-container">
      <div style={{ marginBottom: 16 }}>
        <Link href="/listings" style={{ textDecoration: 'none', color: '#3b82f6' }}>
          ← Volver a listados
        </Link>
      </div>
      <h1>{listing.title}</h1>
      <p style={{ color: '#475569' }}>{listing.description}</p>
      <div style={{ display: 'grid', gap: 12, marginTop: 24, maxWidth: 680 }}>
        <div>
          <p><strong>Precio:</strong> {listing.price != null ? `R$ ${listing.price}` : 'No especificado'}</p>
          <p><strong>Estado:</strong> {listing.status}</p>
          <p><strong>Ubicación:</strong> {listing.location_type}</p>
          {listing.whatsapp_message && <p><strong>Mensaje de contacto:</strong> {listing.whatsapp_message}</p>}
        </div>

        {success && <p style={{ color: 'green' }}>{success}</p>}
        {existingConversation && (
          <p style={{ color: '#059669' }}>Ya existe una conversación para este anuncio.</p>
        )}

        <button
          type="button"
          onClick={handleStartConversation}
          disabled={actionLoading || session?.user?.id === listing.user_id}
          style={{
            padding: '0.75rem 1rem',
            backgroundColor: '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            cursor: actionLoading ? 'not-allowed' : 'pointer',
            width: 'fit-content',
          }}
        >
          {actionLoading ? 'Iniciando...' : 'Iniciar conversación'}
        </button>

        <div style={{ marginTop: 12 }}>
          <p><strong>Contacto:</strong> {listing.contact_button_text || 'No disponible'}</p>
        </div>
      </div>
    </main>
  );
}
