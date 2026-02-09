"use client";

import { useEffect, useMemo, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { ContinueWithGoogleButton } from "@/components/ContinueWithGoogleButton";
import { Button } from "@/components/ui/Button";

export function AuthPanel({ redirectPath }: { redirectPath?: string }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [busy, setBusy] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!alive) return;
      setUserEmail(data.user?.email ?? null);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setUserEmail(session?.user?.email ?? null);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  if (!userEmail) {
    return (
      <div className="space-y-2">
        <div className="text-sm text-black/60">Sign in to connect Gmail and save your setup.</div>
        <ContinueWithGoogleButton redirectPath={redirectPath} />
        <div className="text-xs text-black/45">You can revoke access any time from your Google account settings.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="text-sm text-black/70">
        Signed in as <span className="font-medium text-black/85">{userEmail}</span>
      </div>
      <Button
        variant="secondary"
        size="sm"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await supabase.auth.signOut();
          } finally {
            setBusy(false);
          }
        }}
      >
        Sign out
      </Button>
    </div>
  );
}
