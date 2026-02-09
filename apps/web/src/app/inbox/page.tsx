"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/ButtonLink";

type EmailItemRow = {
  id: string;
  from_email: string | null;
  subject: string | null;
  snippet: string | null;
  received_at: string | null;
  is_relevant: boolean | null;
  status: string;
};

type TabKey = "relevant" | "all" | "sent" | "needs_review";

export default function InboxPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [signedIn, setSignedIn] = useState<boolean>(false);
  const [tab, setTab] = useState<TabKey>("relevant");
  const [items, setItems] = useState<EmailItemRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);

      const sessionRes = await supabase.auth.getSession();
      const session = sessionRes.data.session;
      if (!session) {
        if (!alive) return;
        setSignedIn(false);
        setItems([]);
        setLoading(false);
        return;
      }

      setSignedIn(true);

      const { data, error: qErr } = await supabase
        .from("email_items")
        .select("id,from_email,subject,snippet,received_at,is_relevant,status")
        .order("received_at", { ascending: false })
        .limit(100);

      if (!alive) return;
      if (qErr) setError(qErr.message);
      setItems((data as EmailItemRow[]) || []);
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [supabase]);

  const filtered = useMemo(() => {
    if (tab === "all") return items;
    if (tab === "relevant") return items.filter((i) => i.is_relevant === true);
    if (tab === "sent") return items.filter((i) => i.status === "sent");
    return items.filter((i) => i.status === "needs_review");
  }, [items, tab]);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
          <p className="text-sm text-black/60">
            Relevant items generate a draft and a push notification.
          </p>
        </div>
      </header>

      {!signedIn ? (
        <Card>
          <CardContent className="space-y-3">
            <div className="text-sm font-semibold">
              Sign in to view your inbox
            </div>
            <div className="text-sm text-black/60">
              Connect Gmail in Setup, then run the poll to ingest messages.
            </div>
            <div>
              <ButtonLink href="/setup" variant="secondary">
                Go to Setup
              </ButtonLink>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {signedIn ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger
              active={tab === "relevant"}
              onClick={() => setTab("relevant")}
            >
              Relevant
            </TabsTrigger>
            <TabsTrigger
              active={tab === "needs_review"}
              onClick={() => setTab("needs_review")}
            >
              Needs review
            </TabsTrigger>
            <TabsTrigger active={tab === "sent"} onClick={() => setTab("sent")}>
              Sent
            </TabsTrigger>
            <TabsTrigger active={tab === "all"} onClick={() => setTab("all")}>
              All
            </TabsTrigger>
          </TabsList>

          <div className="text-xs text-black/50">
            Showing {filtered.length} items
          </div>
        </div>
      ) : null}

      {signedIn ? (
        <Card>
          <CardHeader>
            <CardTitle>Messages</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="px-5 pb-5 text-sm text-black/60">Loading…</div>
            ) : null}
            {error ? (
              <div className="px-5 pb-5 text-sm text-red-700">
                Error: {error}
              </div>
            ) : null}

            {!loading && !error && filtered.length === 0 ? (
              <div className="px-5 pb-5 text-sm text-black/60">
                No items yet.
              </div>
            ) : null}

            <ul className="divide-y divide-black/5">
              {filtered.map((item) => (
                <li
                  key={item.id}
                  className="px-5 py-4 transition hover:bg-white/50"
                >
                  <Link href={`/inbox/${item.id}`} className="block">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="text-sm font-semibold tracking-tight">
                          {item.subject || (
                            <span className="text-black/40">(no subject)</span>
                          )}
                        </div>
                        <div className="text-xs text-black/55">
                          {item.from_email || "(unknown sender)"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={badgeVariantForStatus(item.status)}>
                          {item.status}
                        </Badge>
                        {item.is_relevant === true ? (
                          <Badge variant="info">relevant</Badge>
                        ) : null}
                        <div className="text-xs text-black/45">
                          {formatDate(item.received_at)}
                        </div>
                      </div>
                    </div>

                    {item.snippet ? (
                      <div className="mt-2 line-clamp-2 text-sm text-black/60">
                        {item.snippet}
                      </div>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function badgeVariantForStatus(status: string) {
  if (status === "sent") return "good" as const;
  if (status === "needs_review") return "warn" as const;
  if (status === "failed") return "danger" as const;
  if (status === "processed") return "info" as const;
  return "neutral" as const;
}

function formatDate(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}
