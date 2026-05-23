"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';

export default function AuthButton() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(false);

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

  const handleSignOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setLoading(false);
  };

  if (session) {
    return (
      <button type="button" onClick={handleSignOut} disabled={loading} style={{ padding: '0.5rem 1rem' }}>
        {loading ? 'Cerrando...' : 'Cerrar sesión'}
      </button>
    );
  }

  return (
    <Link href="/signin" style={{ padding: '0.5rem 1rem', display: 'inline-block' }}>
      Iniciar sesión
    </Link>
  );
}
