"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";
import { prewarmProfile } from "../lib/profileCache";

type SessionContextValue = {
  session: Session | null;
  sessionLoading: boolean;
};

const SessionContext = createContext<SessionContextValue>({ session: null, sessionLoading: true });

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  useEffect(() => {
    // Precalentar el canal con la base de datos apenas abre la app: un pedido mínimo
    // (HEAD, sin filas) que establece la conexión HTTP/2 y atraviesa la renovación del
    // token vencido durante la noche. Corre en segundo plano, off del camino crítico →
    // cuando el usuario abre su primer anuncio del día, la query del detalle ya no paga
    // ese "arranque en frío" y la descripción aparece rápido desde la primera vez.
    supabase.from("listings").select("id", { head: true, count: undefined }).limit(1).then(() => {}, () => {});

    supabase.auth.getSession().then(({ data }) => {
      const s = data?.session ?? null;
      setSession(s);
      setSessionLoading(false);
      if (s) prewarmProfile(s.user.id);
    });
    const { data: l } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s ?? null);
      setSessionLoading(false);
      if (s) prewarmProfile(s.user.id);
    });
    return () => l?.subscription.unsubscribe();
  }, []);

  return (
    <SessionContext.Provider value={{ session, sessionLoading }}>
      {children}
    </SessionContext.Provider>
  );
}

export const useSession = () => useContext(SessionContext);
