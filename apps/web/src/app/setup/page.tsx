"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { useSupabaseSession } from "@/lib/useSupabaseSession";
import { ContinueWithGoogleButton } from "@/components/ContinueWithGoogleButton";
import { GmailConnectButton } from "@/components/GmailConnectButton";
import { PollNowButton } from "@/components/PollNowButton";
import { PushEnableButton } from "@/components/PushEnableButton";
import { ContextPackForm } from "@/components/ContextPackForm";
import { BucketEditor } from "@/components/BucketEditor";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";

type GmailAccountRow = {
  google_email: string;
  status: string;
  last_polled_at: string | null;
  created_at: string;
};

export default function SetupPage() {
  return (
    <Suspense fallback={<div className="text-sm text-black/60">Loading…</div>}>
      <SetupClient />
    </Suspense>
  );
}

function SetupClient() {
  const {
    supabase,
    session,
    userEmail,
    loading: sessionLoading,
  } = useSupabaseSession();
  const searchParams = useSearchParams();

  const autoConnect = searchParams.get("autoconnect") === "1";

  const [gmail, setGmail] = useState<GmailAccountRow | null>(null);
  const [gmailLoading, setGmailLoading] = useState(false);
  const [gmailChecked, setGmailChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoStarted, setAutoStarted] = useState(false);
  const [prefsTab, setPrefsTab] = useState<"context" | "buckets">("context");
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let alive = true;

    (async () => {
      setError(null);
      if (!session) {
        setGmail(null);
        setGmailChecked(false);
        return;
      }

      setGmailChecked(false);

      setGmailLoading(true);
      try {
        const { data, error: qErr } = await supabase
          .from("gmail_accounts")
          .select("google_email,status,last_polled_at,created_at")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!alive) return;
        if (qErr) {
          setError(qErr.message);
          setGmail(null);
          return;
        }

        setGmail((data as GmailAccountRow) || null);
      } finally {
        if (alive) {
          setGmailLoading(false);
          setGmailChecked(true);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [session, supabase, reloadTick]);

  useEffect(() => {
    if (!autoConnect) return;
    if (!session) return;
    if (!gmailChecked) return;
    if (gmail) return;
    if (autoStarted) return;

    setAutoStarted(true);

    (async () => {
      try {
        const res = await fetch("/api/oauth/google/start", {
          method: "POST",
          headers: {
            authorization: `Bearer ${session.access_token}`,
          },
        });
        if (!res.ok) throw new Error(await res.text());
        const json = (await res.json()) as { url?: unknown };
        if (!json?.url) throw new Error("Missing redirect URL.");
        window.location.href = String(json.url);
      } catch (e: unknown) {
        setError(
          e instanceof Error ? e.message : "Failed to start Gmail connection.",
        );
      }
    })();
  }, [autoConnect, session, gmail, gmailChecked, autoStarted]);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Setup</h1>
        <p className="text-sm text-black/60">
          Sign in, link Gmail, then review drafts. Nothing ever auto-sends.
        </p>
      </header>

      {error ? <Alert variant="danger">{error}</Alert> : null}

      {!session ? (
        <Card>
          <CardHeader>
            <CardTitle>Continue with Gmail</CardTitle>
            <CardDescription>
              One-time setup: sign in, then grant Gmail access.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {sessionLoading ? (
              <div className="text-sm text-black/60">Checking session…</div>
            ) : null}
            <ContinueWithGoogleButton label="Continue" />
            <div className="text-xs text-black/50">
              You can revoke access any time in your Google account.
            </div>
          </CardContent>
        </Card>
      ) : !gmail ? (
        <Card>
          <CardHeader>
            <CardTitle>Link Gmail</CardTitle>
            <CardDescription>
              Grant access so we can read new emails and draft replies you
              approve.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-black/70">
                Signed in as{" "}
                <span className="font-medium text-black/85">
                  {userEmail || "(unknown)"}
                </span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  await supabase.auth.signOut();
                }}
              >
                Sign out
              </Button>
            </div>

            {gmailLoading ? (
              <div className="text-sm text-black/60">
                Checking Gmail connection…
              </div>
            ) : null}

            {autoConnect && autoStarted ? (
              <div className="text-sm text-black/60">
                Opening Google consent…
              </div>
            ) : (
              <GmailConnectButton />
            )}

            <div className="text-xs text-black/50">
              Signing in identifies you; linking Gmail grants mailbox
              permissions.
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Connected</CardTitle>
              <CardDescription>
                We poll hourly and notify you when a draft is ready.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={gmail.status === "active" ? "good" : "warn"}>
                    {gmail.status}
                  </Badge>
                  <div className="text-sm font-medium text-black/85">
                    {gmail.google_email}
                  </div>
                  {gmail.last_polled_at ? (
                    <div className="text-xs text-black/50">
                      Last checked:{" "}
                      {new Date(gmail.last_polled_at).toLocaleString()}
                    </div>
                  ) : (
                    <div className="text-xs text-black/50">Not checked yet</div>
                  )}
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    await supabase.auth.signOut();
                  }}
                >
                  Sign out
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <PollNowButton
                  label="Poll now"
                  onComplete={() => setReloadTick((t) => t + 1)}
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Notifications (optional)</CardTitle>
                <CardDescription>
                  Get a push notification when a draft is ready.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-black/60">
                  iOS requires Add to Home Screen (iOS 16.4+).
                </div>
                <PushEnableButton />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Preferences (optional)</CardTitle>
                <CardDescription>
                  Buckets are preconfigured for a solo founder or COO. Customize
                  if you want.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <TabsList>
                  <TabsTrigger
                    active={prefsTab === "context"}
                    onClick={() => setPrefsTab("context")}
                  >
                    Context
                  </TabsTrigger>
                  <TabsTrigger
                    active={prefsTab === "buckets"}
                    onClick={() => setPrefsTab("buckets")}
                  >
                    Buckets
                  </TabsTrigger>
                </TabsList>

                {prefsTab === "context" ? (
                  <ContextPackForm />
                ) : (
                  <BucketEditor />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-black/60">
              You’re ready. Review drafts in your inbox.
            </div>
            <ButtonLink href="/inbox" size="sm">
              Open Inbox
            </ButtonLink>
          </div>
        </>
      )}
    </div>
  );
}
