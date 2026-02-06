"use client";

import { useMemo, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { Button } from "@/components/ui/Button";

export function GmailConnectButton({ onStarted }: { onStarted?: () => void }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <Button
        type="button"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const sessionRes = await supabase.auth.getSession();
            const token = sessionRes.data.session?.access_token;
            if (!token) throw new Error("Sign in first.");

            const res = await fetch("/api/oauth/google/start", {
              method: "POST",
              headers: {
                authorization: `Bearer ${token}`
              }
            });
            if (!res.ok) throw new Error(await res.text());
            const json = (await res.json()) as { url?: unknown };
            if (!json?.url) throw new Error("Missing redirect URL.");
            onStarted?.();
            window.location.href = String(json.url);
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Failed to start OAuth.";
            setError(msg);
          } finally {
            setBusy(false);
          }
        }}
      >
        Connect Gmail
      </Button>

      {error ? <div className="text-xs text-red-700">{error}</div> : null}
    </div>
  );
}
