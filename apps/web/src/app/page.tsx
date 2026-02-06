import Link from "next/link";

import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/ButtonLink";

export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">PWA + Push</Badge>
          <Badge>Hourly poll</Badge>
          <Badge>Manual send only</Badge>
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Clear the inbox.
            <span className="text-black/55"> Keep control.</span>
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-black/60">
            Inbox Copilot polls Gmail, flags business-relevant emails, generates a structured summary and a suggested
            reply, and nudges you with a push notification.
            <span className="font-medium text-black/70"> You approve every send.</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/inbox">Open Inbox</ButtonLink>
          <ButtonLink href="/settings" variant="secondary">
            Connect Gmail
          </ButtonLink>
        </div>

        <p className="text-sm text-black/50">
          Tip: iOS push requires Add to Home Screen (iOS 16.4+). Enable push from the installed app.
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <FeatureCard
          title="Business relevance"
          body="Keyword prefilter + LLM classification so you only get pinged for what matters."
        />
        <FeatureCard
          title="Structured summary"
          body="What they want, key bullets, and next step. Built for quick scanning."
        />
        <FeatureCard
          title="Reply drafts"
          body="Drafts are editable, versioned, and never sent without your explicit approval."
        />
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-black/60">
          New here? Start in <Link className="font-medium text-black/80 underline" href="/settings">Settings</Link>.
        </div>
        <div className="flex gap-2">
          <ButtonLink href="/settings" variant="secondary" size="sm">
            Settings
          </ButtonLink>
          <ButtonLink href="/inbox" size="sm">
            Inbox
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <Card className="hover:bg-white/60">
      <CardContent className="space-y-2">
        <div className="text-sm font-semibold tracking-tight">{title}</div>
        <div className="text-sm leading-relaxed text-black/60">{body}</div>
      </CardContent>
    </Card>
  );
}
