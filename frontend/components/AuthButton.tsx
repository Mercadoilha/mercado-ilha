"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function AuthButton() {
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

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  if (session) {
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <a href="/profile">Mi perfil</a>
        <button onClick={signOut}>Cerrar sesión</button>
      </div>
    );
  }

  return <a href="/signin">Iniciar sesión</a>;
}
