"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

type SessionContextValue = {
  session: Session | null;
  sessionLoading: boolean;
};

const SessionContext = createContext<SessionContextValue>({ session: null, sessionLoading: true });

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data?.session ?? null);
      setSessionLoading(false);
    });
    const { data: l } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s ?? null);
      setSessionLoading(false);
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
