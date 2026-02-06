"use client";

import { useEffect, useMemo, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { GmailConnectButton } from "@/components/GmailConnectButton";
import { Badge } from "@/components/ui/Badge";

type GmailAccountRow = {
  google_email: string;
  status: string;
  last_polled_at: string | null;
  created_at: string;
};

export function GmailConnectionPanel() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [busy, setBusy] = useState(false);
  const [row, setRow] = useState<GmailAccountRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setBusy(true);
      setError(null);
      try {
        const sessionRes = await supabase.auth.getSession();
        if (!sessionRes.data.session) {
          setRow(null);
          return;
        }

        const { data, error: qErr } = await supabase
          .from("gmail_accounts")
          .select("google_email,status,last_polled_at,created_at")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!alive) return;
        if (qErr) {
          setError(qErr.message);
          return;
        }

        setRow((data as GmailAccountRow) || null);
      } finally {
        if (alive) setBusy(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [supabase]);

  return (
    <div className="space-y-3">
      {busy ? <div className="text-sm text-black/60">Checking connection…</div> : null}
      {error ? <div className="text-sm text-red-700">{error}</div> : null}

      {row ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={row.status === "active" ? "good" : "warn"}>{row.status}</Badge>
          <div className="text-sm font-medium text-black/85">{row.google_email}</div>
          {row.last_polled_at ? (
            <div className="text-xs text-black/50">Last polled: {new Date(row.last_polled_at).toLocaleString()}</div>
          ) : (
            <div className="text-xs text-black/50">Not polled yet</div>
          )}
        </div>
      ) : (
        <div className="text-sm text-black/60">No Gmail connected yet.</div>
      )}

      <GmailConnectButton onStarted={() => setError(null)} />

      <div className="text-xs text-black/50">
        You’ll be redirected to Google to grant access. We request read-only + send so you can approve and send replies
        from inside the app.
      </div>
    </div>
  );
}
