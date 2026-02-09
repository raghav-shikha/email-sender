"use client";

import { useEffect, useMemo, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";

type EmailItemRow = {
  id: string;
  from_email: string | null;
  subject: string | null;
  body_text: string | null;
  summary_json: unknown;
  status: string;
  is_relevant: boolean | null;
};

type ReplyDraftRow = {
  id: string;
  version: number;
  draft_text: string;
  instruction: string | null;
  created_at: string;
};

export default function EmailDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [signedIn, setSignedIn] = useState(false);
  const [item, setItem] = useState<EmailItemRow | null>(null);
  const [drafts, setDrafts] = useState<ReplyDraftRow[]>([]);
  const [draftText, setDraftText] = useState("");
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setError(null);

      const sessionRes = await supabase.auth.getSession();
      const session = sessionRes.data.session;
      if (!session) {
        if (!alive) return;
        setSignedIn(false);
        setItem(null);
        setDrafts([]);
        return;
      }

      setSignedIn(true);

      const { data, error: qErr } = await supabase
        .from("email_items")
        .select(
          "id,from_email,subject,body_text,summary_json,status,is_relevant",
        )
        .eq("id", params.id)
        .maybeSingle();

      if (!alive) return;
      if (qErr) {
        setError(qErr.message);
        return;
      }

      setItem((data as EmailItemRow) || null);

      const { data: dData, error: dErr } = await supabase
        .from("reply_drafts")
        .select("id,version,draft_text,instruction,created_at")
        .eq("email_item_id", params.id)
        .order("version", { ascending: false });

      if (!alive) return;
      if (dErr) {
        setError(dErr.message);
        return;
      }

      const rows = (dData as ReplyDraftRow[]) || [];
      setDrafts(rows);
      if (rows[0]?.draft_text) setDraftText(rows[0].draft_text);
    })();

    return () => {
      alive = false;
    };
  }, [params.id, supabase]);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Email</h1>
          <p className="text-sm text-black/60">
            Review the summary and draft. Sending always requires manual
            approval.
          </p>
        </div>
        <ButtonLink href="/inbox" variant="secondary" size="sm">
          Back
        </ButtonLink>
      </header>

      {!signedIn ? (
        <Card>
          <CardContent className="space-y-3">
            <div className="text-sm font-semibold">
              Sign in to view this email
            </div>
            <div className="text-sm text-black/60">
              Go to Setup to sign in, connect Gmail, and enable push.
            </div>
            <div>
              <ButtonLink href="/setup" variant="secondary">
                Go to Setup
              </ButtonLink>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {error ? <Alert variant="danger">{error}</Alert> : null}

      {signedIn && !item ? (
        <Card>
          <CardContent className="text-sm text-black/60">Loading…</CardContent>
        </Card>
      ) : null}

      {signedIn && item ? (
        <>
          <Card>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold tracking-tight">
                    {item.subject || (
                      <span className="text-black/40">(no subject)</span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-black/55">
                    {item.from_email || "(unknown sender)"}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={badgeVariantForStatus(item.status)}>
                    {item.status}
                  </Badge>
                  {item.is_relevant === true ? (
                    <Badge variant="info">relevant</Badge>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
                <CardDescription>
                  Generated by the LLM, validated against a JSON schema.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SummaryBlock summary={item.summary_json} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Draft Reply</CardTitle>
                <CardDescription>
                  Edit freely. You can also instruct the LLM to revise.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Draft</Label>
                  <Textarea
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    rows={10}
                    placeholder="Draft will appear here once processed."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Instruction (optional)</Label>
                  <Input
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    placeholder='e.g. "Make it shorter and ask for MOQ."'
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    loading={busy}
                    disabled={!draftText.trim() || !instruction.trim()}
                    onClick={() =>
                      reviseDraft(
                        params.id,
                        draftText,
                        instruction,
                        setBusy,
                        setError,
                        setDraftText,
                        () => setInstruction(""),
                      )
                    }
                  >
                    Revise draft
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    loading={busy}
                    disabled={!draftText.trim()}
                    onClick={() => {
                      const ok = window.confirm(
                        "Send this reply now? This will send an email from your connected Gmail account.",
                      );
                      if (!ok) return;
                      sendReply(params.id, draftText, setBusy, setError);
                    }}
                  >
                    Approve & Send
                  </Button>
                </div>

                {drafts.length ? (
                  <div className="text-xs text-black/50">
                    Latest draft version:{" "}
                    <span className="font-medium text-black/70">
                      {drafts[0].version}
                    </span>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Email Body</CardTitle>
              <CardDescription>
                Plain text (HTML is converted to text on ingest).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap text-sm leading-relaxed text-black/70">
                {item.body_text || ""}
              </pre>
            </CardContent>
          </Card>
        </>
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

function SummaryBlock({ summary }: { summary: unknown }) {
  if (!summary || typeof summary !== "object") {
    return <div className="text-sm text-black/60">Not processed yet.</div>;
  }

  const s = summary as {
    summary_bullets?: unknown;
    what_they_want?: unknown;
    suggested_next_step?: unknown;
  };

  const bullets = Array.isArray(s.summary_bullets)
    ? s.summary_bullets.map((x) => String(x))
    : [];
  const wants = Array.isArray(s.what_they_want)
    ? s.what_they_want.map((x) => String(x))
    : [];

  return (
    <div className="space-y-4 text-sm text-black/70">
      {bullets.length ? (
        <div>
          <div className="text-xs font-medium text-black/55">Summary</div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {wants.length ? (
        <div>
          <div className="text-xs font-medium text-black/55">
            What they want
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {wants.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {s.suggested_next_step ? (
        <div>
          <div className="text-xs font-medium text-black/55">
            Suggested next step
          </div>
          <div className="mt-2">{String(s.suggested_next_step)}</div>
        </div>
      ) : null}
    </div>
  );
}

async function reviseDraft(
  emailItemId: string,
  currentDraftText: string,
  instruction: string,
  setBusy: (v: boolean) => void,
  setError: (v: string | null) => void,
  setDraftText: (v: string) => void,
  onSuccess: () => void,
) {
  setBusy(true);
  setError(null);

  try {
    const supabase = getSupabaseBrowserClient();
    const sessionRes = await supabase.auth.getSession();
    const token = sessionRes.data.session?.access_token;
    if (!token) throw new Error("Not signed in.");

    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!apiBase) throw new Error("Missing NEXT_PUBLIC_API_BASE_URL");

    const res = await fetch(`${apiBase}/ai/revise`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        email_item_id: emailItemId,
        current_draft_text: currentDraftText,
        instruction,
      }),
    });

    if (!res.ok) throw new Error(await res.text());
    const json = (await res.json()) as { revised_draft?: unknown };
    if (json?.revised_draft) setDraftText(String(json.revised_draft));
    onSuccess();
  } catch (e: unknown) {
    setError(e instanceof Error ? e.message : "Failed to revise.");
  } finally {
    setBusy(false);
  }
}

async function sendReply(
  emailItemId: string,
  finalDraftText: string,
  setBusy: (v: boolean) => void,
  setError: (v: string | null) => void,
) {
  setBusy(true);
  setError(null);

  try {
    const supabase = getSupabaseBrowserClient();
    const sessionRes = await supabase.auth.getSession();
    const token = sessionRes.data.session?.access_token;
    if (!token) throw new Error("Not signed in.");

    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!apiBase) throw new Error("Missing NEXT_PUBLIC_API_BASE_URL");

    const res = await fetch(`${apiBase}/gmail/send-reply`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        email_item_id: emailItemId,
        final_draft_text: finalDraftText,
      }),
    });

    if (!res.ok) throw new Error(await res.text());
  } catch (e: unknown) {
    setError(e instanceof Error ? e.message : "Failed to send.");
  } finally {
    setBusy(false);
  }
}
