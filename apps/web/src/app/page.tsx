"use client";

import { useEffect, useMemo, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { ContinueWithGoogleButton } from "@/components/ContinueWithGoogleButton";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card, CardContent } from "@/components/ui/Card";

export default function HomePage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
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
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">Gmail</Badge>
          <Badge>Hourly poll</Badge>
          <Badge>Manual send only</Badge>
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Inbox Copilot</h1>
          <p className="max-w-2xl text-base leading-relaxed text-black/60">
            Business-only summaries and reply drafts, delivered by push. You approve everything before it’s sent.
          </p>
        </div>
      </section>

      {!userEmail ? (
        <Card>
          <CardContent className="space-y-3">
            <div className="text-sm font-semibold tracking-tight">Get started</div>
            <div className="text-sm text-black/60">Sign in with Google, then connect Gmail.</div>
            <ContinueWithGoogleButton redirectPath="/setup" label="Sign up with Gmail" />
            <div className="text-xs text-black/45">We’ll ask for Gmail read + send after sign-in.</div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-3">
            <div className="text-sm text-black/70">
              Signed in as <span className="font-medium text-black/85">{userEmail}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <ButtonLink href="/setup">Continue setup</ButtonLink>
              <ButtonLink href="/inbox" variant="secondary">
                Open inbox
              </ButtonLink>
            </div>
          </CardContent>
        </Card>
      )}

      <section className="grid gap-3 md:grid-cols-3">
        <MiniFeature title="Relevance" body="Keyword prefilter + LLM classification." />
        <MiniFeature title="Structure" body="Summary bullets, what they want, next step." />
        <MiniFeature title="Control" body="Drafts are editable. Nothing auto-sends." />
      </section>
    </div>
  );
}

function MiniFeature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white/45 p-4 text-sm text-black/60 backdrop-blur-xl">
      <div className="text-sm font-semibold tracking-tight text-black/80">{title}</div>
      <div className="mt-1 leading-relaxed">{body}</div>
    </div>
  );
}
