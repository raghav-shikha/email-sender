"use client";

import { useEffect, useMemo, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { AuthPanel } from "@/components/AuthPanel";
import { GmailConnectionPanel } from "@/components/GmailConnectionPanel";
import { PushEnableButton } from "@/components/PushEnableButton";
import { ContextPackForm } from "@/components/ContextPackForm";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

export default function SetupPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [signedIn, setSignedIn] = useState(false);
  const [gmailConnected, setGmailConnected] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;

    async function refresh() {
      const sessionRes = await supabase.auth.getSession();
      const session = sessionRes.data.session;
      if (!alive) return;

      if (!session) {
        setSignedIn(false);
        setGmailConnected(null);
        return;
      }

      setSignedIn(true);

      const { data, error } = await supabase
        .from("gmail_accounts")
        .select("id")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!alive) return;
      if (error) {
        // Don't block setup UI on a status query.
        setGmailConnected(false);
        return;
      }
      setGmailConnected(Boolean(data));
    }

    refresh();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  const stepsDone = (signedIn ? 1 : 0) + (signedIn && gmailConnected ? 1 : 0);

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={signedIn ? "good" : "neutral"}>1. Signed in</Badge>
          <Badge variant={signedIn && gmailConnected ? "good" : "neutral"}>2. Gmail connected</Badge>
          <Badge>3. Push</Badge>
          <Badge>4. Context</Badge>
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Setup</h1>
          <p className="text-sm text-black/60">Get connected in a minute. You’ll always approve before anything is sent.</p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>1. Sign in</CardTitle>
          <CardDescription>Use Google so your setup follows you across devices.</CardDescription>
        </CardHeader>
        <CardContent>
          <AuthPanel redirectPath="/setup" />
        </CardContent>
      </Card>

      {signedIn ? (
        <Card>
          <CardHeader>
            <CardTitle>2. Connect Gmail</CardTitle>
            <CardDescription>Grant read-only + send so you can draft and approve replies.</CardDescription>
          </CardHeader>
          <CardContent>
            <GmailConnectionPanel />
          </CardContent>
        </Card>
      ) : null}

      {signedIn && gmailConnected ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>3. Enable push</CardTitle>
              <CardDescription>Get a notification when a new draft is ready.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-black/60">iOS requires Add to Home Screen (iOS 16.4+).</div>
              <PushEnableButton />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>4. Context</CardTitle>
              <CardDescription>Used for relevance, summaries, and reply drafts.</CardDescription>
            </CardHeader>
            <CardContent>
              <ContextPackForm />
            </CardContent>
          </Card>
        </div>
      ) : null}

      {stepsDone >= 2 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-black/60">You’re ready. Run the poll, then review drafts in your inbox.</div>
          <ButtonLink href="/inbox" size="sm">
            Go to Inbox
          </ButtonLink>
        </div>
      ) : null}
    </div>
  );
}
