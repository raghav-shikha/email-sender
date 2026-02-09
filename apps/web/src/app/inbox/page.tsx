"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useSupabaseSession } from "@/lib/useSupabaseSession";
import { PollNowButton } from "@/components/PollNowButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/ButtonLink";

type BucketRow = {
  id: string;
  slug: string;
  name: string;
  priority: number;
};

type EmailItemRow = {
  id: string;
  from_email: string | null;
  subject: string | null;
  snippet: string | null;
  received_at: string | null;
  is_relevant: boolean | null;
  status: string;
  bucket_id: string | null;
};

type ViewKey = "needs_review" | "sent" | "all";

export default function InboxPage() {
  const { supabase, session } = useSupabaseSession();

  const [view, setView] = useState<ViewKey>("needs_review");
  const [bucketId, setBucketId] = useState<string>("all");

  const [buckets, setBuckets] = useState<BucketRow[]>([]);
  const [items, setItems] = useState<EmailItemRow[]>([]);
  const [reloadTick, setReloadTick] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setError(null);

      if (!session) {
        if (!alive) return;
        setBuckets([]);
        setItems([]);
        setLoading(false);
        return;
      }

      const [{ data: bData, error: bErr }, { data: iData, error: iErr }] =
        await Promise.all([
          supabase
            .from("email_buckets")
            .select("id,slug,name,priority")
            .order("priority", { ascending: true })
            .limit(100),
          supabase
            .from("email_items")
            .select(
              "id,from_email,subject,snippet,received_at,is_relevant,status,bucket_id",
            )
            .order("received_at", { ascending: false })
            .limit(200),
        ]);

      if (!alive) return;

      if (bErr) setError(bErr.message);
      else setBuckets(((bData as any[]) || []) as BucketRow[]);

      if (iErr) setError(iErr.message);
      else setItems(((iData as any[]) || []) as EmailItemRow[]);

      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [session, supabase, reloadTick]);

  const bucketById = useMemo(() => {
    const m = new Map<string, BucketRow>();
    for (const b of buckets) m.set(b.id, b);
    return m;
  }, [buckets]);

  const filtered = useMemo(() => {
    let list = items;

    if (view === "needs_review") {
      list = list.filter(
        (i) => i.status === "needs_review" || i.status === "failed",
      );
    } else if (view === "sent") {
      list = list.filter((i) => i.status === "sent");
    }

    if (bucketId !== "all") {
      list = list.filter((i) => i.bucket_id === bucketId);
    }

    return list;
  }, [items, view, bucketId]);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
        <p className="text-sm text-black/60">
          The app ingests new inbox emails, routes them into buckets, and drafts
          replies for anything relevant.
        </p>
      </header>

      {!session ? (
        <Card>
          <CardContent className="space-y-3">
            <div className="text-sm font-semibold">
              Sign in to view your inbox
            </div>
            <div className="text-sm text-black/60">
              Start in setup, then link Gmail.
            </div>
            <ButtonLink href="/setup" variant="secondary">
              Open setup
            </ButtonLink>
          </CardContent>
        </Card>
      ) : null}

      {session ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs font-medium text-black/55">Bucket</div>
            <select
              className="h-9 rounded-xl border border-black/10 bg-white/60 px-3 text-sm text-black/80 shadow-sm outline-none backdrop-blur-xl transition focus:border-black/20"
              value={bucketId}
              onChange={(e) => setBucketId(e.target.value)}
            >
              <option value="all">All buckets</option>
              {buckets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <PollNowButton onComplete={() => setReloadTick((t) => t + 1)} />
            <TabsList>
              <TabsTrigger
                active={view === "needs_review"}
                onClick={() => setView("needs_review")}
              >
                Needs review
              </TabsTrigger>
              <TabsTrigger
                active={view === "sent"}
                onClick={() => setView("sent")}
              >
                Sent
              </TabsTrigger>
              <TabsTrigger
                active={view === "all"}
                onClick={() => setView("all")}
              >
                All
              </TabsTrigger>
            </TabsList>
          </div>
        </div>
      ) : null}

      {session ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Messages</CardTitle>
            <div className="text-xs text-black/50">
              Showing {filtered.length}
            </div>
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
              {filtered.map((item) => {
                const bucketName = item.bucket_id
                  ? bucketById.get(item.bucket_id)?.name
                  : null;

                return (
                  <li
                    key={item.id}
                    className="px-5 py-4 transition hover:bg-white/50"
                  >
                    <Link href={`/inbox/${item.id}`} className="block">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="text-sm font-semibold tracking-tight">
                            {item.subject || (
                              <span className="text-black/40">
                                (no subject)
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-black/55">
                            {item.from_email || "(unknown sender)"}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {bucketName ? <Badge>{bucketName}</Badge> : null}
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
                );
              })}
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
