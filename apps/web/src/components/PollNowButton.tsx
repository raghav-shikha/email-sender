"use client";

import { useMemo, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { Button } from "@/components/ui/Button";

type PollNowAccount = {
  gmail_account_id: string;
  user_id: string;
  new: number;
  processed: number;
  relevant: number;
  pushed: number;
  failed: number;
  skipped?: boolean;
  skip_reason?: string;
  errors?: string[];
};

type PollNowResponse = {
  ok: boolean;
  total_new: number;
  per_account: PollNowAccount[];
};

export function PollNowButton({
  onComplete,
  size = "sm",
  variant = "secondary",
  label = "Check now",
}: {
  onComplete?: (res: PollNowResponse | null) => void;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary" | "ghost" | "danger";
  label?: string;
}) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      <Button
        type="button"
        size={size}
        variant={variant}
        loading={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          setNote(null);

          try {
            const sessionRes = await supabase.auth.getSession();
            const token = sessionRes.data.session?.access_token;
            if (!token) throw new Error("Sign in first.");

            const resp = await fetch("/api/poll/now", {
              method: "POST",
              headers: {
                authorization: `Bearer ${token}`,
              },
            });

            if (!resp.ok) {
              const txt = await resp.text();
              throw new Error(txt || "Poll failed.");
            }

            const json = (await resp.json()) as PollNowResponse;
            const accounts = Array.isArray(json.per_account)
              ? json.per_account
              : [];

            const skipped = accounts.filter((a) => Boolean(a.skipped)).length;
            const processed = accounts.reduce(
              (sum, a) => sum + (Number(a.processed) || 0),
              0,
            );
            const relevant = accounts.reduce(
              (sum, a) => sum + (Number(a.relevant) || 0),
              0,
            );

            if (skipped > 0 && json.total_new === 0 && processed === 0) {
              setNote("Just checked a moment ago.");
            } else if (json.total_new === 0 && processed === 0) {
              setNote("No new mail.");
            } else {
              setNote(
                `Found ${json.total_new} new, processed ${processed}, relevant ${relevant}.`,
              );
            }

            onComplete?.(json);
          } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Poll failed.");
            onComplete?.(null);
          } finally {
            setBusy(false);
          }
        }}
      >
        {label}
      </Button>

      {error ? <div className="text-xs text-red-700">{error}</div> : null}
      {note ? <div className="text-xs text-black/55">{note}</div> : null}
    </div>
  );
}
