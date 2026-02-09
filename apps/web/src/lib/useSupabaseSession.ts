"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

export function useSupabaseSession() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      setSession(data.session ?? null);
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(
      (_evt, nextSession) => {
        setSession(nextSession);
      },
    );

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  return {
    supabase,
    session,
    userEmail: session?.user?.email ?? null,
    loading,
  };
}
