"use client";

import { useMemo, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { Button } from "@/components/ui/Button";

export function ContinueWithGoogleButton({
  redirectPath = "/setup",
  label = "Continue with Google"
}: {
  redirectPath?: string;
  label?: string;
}) {
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
            const redirectTo = `${window.location.origin}${redirectPath}`;
            const { error } = await supabase.auth.signInWithOAuth({
              provider: "google",
              options: { redirectTo }
            });
            if (error) setError(error.message);
          } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Failed to start Google sign-in.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {label}
      </Button>

      {error ? <div className="text-xs text-red-700">{error}</div> : null}
    </div>
  );
}
