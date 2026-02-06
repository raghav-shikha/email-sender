"use client";

import { useEffect, useMemo, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

export function AuthPanel() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-black/70">
          {userEmail ? (
            <>
              Signed in as <span className="font-medium text-black/85">{userEmail}</span>
            </>
          ) : (
            "Not signed in"
          )}
        </div>

        {userEmail ? (
          <Button
            variant="secondary"
            size="sm"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              setStatus("");
              try {
                const { error } = await supabase.auth.signOut();
                if (error) setStatus(error.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Sign out
          </Button>
        ) : null}
      </div>

      {!userEmail ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="auth-email">Email</Label>
            <Input
              id="auth-email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="auth-password">Password</Label>
            <Input
              id="auth-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
            />
          </div>

          <div className="flex flex-wrap gap-2 md:col-span-2">
            <Button
              type="button"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                setStatus("");
                try {
                  const { error } = await supabase.auth.signInWithPassword({ email, password });
                  if (error) setStatus(error.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Sign in
            </Button>

            <Button
              type="button"
              variant="secondary"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                setStatus("");
                try {
                  const { error } = await supabase.auth.signUp({ email, password });
                  if (error) setStatus(error.message);
                  else setStatus("Check your email to confirm (if confirmation is enabled).");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Sign up
            </Button>
          </div>
        </div>
      ) : null}

      {status ? <div className="text-xs text-black/60">{status}</div> : null}
    </div>
  );
}
