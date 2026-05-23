"use client";

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function ProfilePage() {
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data?.session ?? null);
    }
    load();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session ?? null);
    });
    return () => {
      mounted = false;
      if (sub?.subscription) sub.subscription.unsubscribe();
    };
  }, []);

  if (!session) return (
    <main className="page-container">
      <h1>Perfil</h1>
      <p>No estás autenticado. <a href="/signin">Inicia sesión</a>.</p>
    </main>
  );

  const user = session.user;

  return (
    <main className="page-container">
      <h1>Mi perfil</h1>
      <p><strong>ID:</strong> {user.id}</p>
      <p><strong>Email:</strong> {user.email}</p>
    </main>
  );
}
