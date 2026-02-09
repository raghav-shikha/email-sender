"use client";

import { useEffect, useMemo, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Badge } from "@/components/ui/Badge";

type BucketRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  priority: number;
  is_enabled: boolean;
  matchers: any;
  actions: any;
};

function csvToList(s: string) {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function listToCsv(xs: unknown) {
  if (!Array.isArray(xs)) return "";
  return xs
    .map((x) => String(x))
    .filter(Boolean)
    .join(", ");
}

export function BucketEditor() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const [buckets, setBuckets] = useState<BucketRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const selected = buckets.find((b) => b.id === selectedId) ?? null;

  const [enabled, setEnabled] = useState(true);
  const [ignore, setIgnore] = useState(false);
  const [push, setPush] = useState(true);
  const [summarize, setSummarize] = useState(true);
  const [draft, setDraft] = useState(true);
  const [classify, setClassify] = useState(true);

  const [keywords, setKeywords] = useState("");
  const [senderDomains, setSenderDomains] = useState("");
  const [senderEmails, setSenderEmails] = useState("");

  const [advanced, setAdvanced] = useState(false);
  const [excludeKeywords, setExcludeKeywords] = useState("");
  const [excludeSenderDomains, setExcludeSenderDomains] = useState("");
  const [excludeSenderEmails, setExcludeSenderEmails] = useState("");
  const [pushMinConf, setPushMinConf] = useState<string>("");
  const [draftMinConf, setDraftMinConf] = useState<string>("");

  async function refresh() {
    setLoading(true);
    setError(null);
    setStatus("");

    try {
      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes.data.session?.access_token;
      if (!token) {
        setBuckets([]);
        setSelectedId("");
        return;
      }

      const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (apiBase) {
        // Create default rows (buckets + context pack) if missing.
        await fetch(`${apiBase.replace(/\/$/, "")}/setup/bootstrap`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
          },
        }).catch(() => null);
      }

      const { data, error } = await supabase
        .from("email_buckets")
        .select("id,slug,name,description,priority,is_enabled,matchers,actions")
        .order("priority", { ascending: true })
        .limit(100);

      if (error) throw new Error(error.message);

      const rows = ((data as any[]) || []) as BucketRow[];
      setBuckets(rows);
      if (!selectedId && rows[0]?.id) setSelectedId(rows[0].id);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  useEffect(() => {
    if (!selected) return;

    setStatus("");
    setError(null);

    setEnabled(Boolean(selected.is_enabled));

    const m = (selected.matchers || {}) as any;
    const a = (selected.actions || {}) as any;

    setIgnore(Boolean(a.ignore));
    setPush(Boolean(a.push ?? true));
    setSummarize(Boolean(a.llm_summarize ?? true));
    setDraft(Boolean(a.llm_draft ?? true));
    setClassify(Boolean(a.llm_classify ?? true));

    setKeywords(listToCsv(m.keywords));
    setSenderDomains(listToCsv(m.sender_domains));
    setSenderEmails(listToCsv(m.sender_emails));

    setExcludeKeywords(listToCsv(m.exclude_keywords));
    setExcludeSenderDomains(listToCsv(m.exclude_sender_domains));
    setExcludeSenderEmails(listToCsv(m.exclude_sender_emails));

    setPushMinConf(
      a.push_min_confidence != null ? String(a.push_min_confidence) : "",
    );
    setDraftMinConf(
      a.draft_min_confidence != null ? String(a.draft_min_confidence) : "",
    );
  }, [selected]);

  if (loading) {
    return <div className="text-sm text-black/60">Loading buckets…</div>;
  }

  if (!buckets.length) {
    return (
      <div className="space-y-2">
        <div className="text-sm text-black/60">No buckets found yet.</div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => refresh()}
        >
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <Label>Bucket</Label>
          <select
            className="h-10 w-full rounded-xl border border-black/10 bg-white/60 px-3 text-sm text-black/80 shadow-sm outline-none backdrop-blur-xl transition focus:border-black/20"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {buckets.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          {selected?.description ? (
            <div className="text-xs text-black/50">{selected.description}</div>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label>Actions</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Toggle label="Enabled" checked={enabled} onChange={setEnabled} />
            <Toggle label="Ignore" checked={ignore} onChange={setIgnore} />
            <Toggle
              label="Push"
              checked={push}
              onChange={setPush}
              disabled={ignore}
            />
            <Toggle
              label="Summary"
              checked={summarize}
              onChange={setSummarize}
              disabled={ignore}
            />
            <Toggle
              label="Draft"
              checked={draft}
              onChange={setDraft}
              disabled={ignore}
            />
            <Toggle
              label="Classify"
              checked={classify}
              onChange={setClassify}
              disabled={ignore}
            />
          </div>
          <div className="text-xs text-black/50">
            Recommended defaults are prefilled. Ignore is best for newsletters.
          </div>
        </div>

        <div className="space-y-1 md:col-span-2">
          <Label>Keywords</Label>
          <Input
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="pricing, invoice, interview, urgent"
          />
          <div className="text-xs text-black/45">
            Matched against subject, snippet, and body.
          </div>
        </div>

        <div className="space-y-1">
          <Label>Sender domains (optional)</Label>
          <Input
            value={senderDomains}
            onChange={(e) => setSenderDomains(e.target.value)}
            placeholder="stripe.com, ashbyhq.com"
          />
        </div>

        <div className="space-y-1">
          <Label>Sender emails (optional)</Label>
          <Input
            value={senderEmails}
            onChange={(e) => setSenderEmails(e.target.value)}
            placeholder="vip@customer.com"
          />
        </div>
      </div>

      <button
        type="button"
        className="text-left text-xs font-medium text-black/50 underline decoration-black/20 underline-offset-4 hover:text-black/65"
        onClick={() => setAdvanced((v) => !v)}
      >
        {advanced ? "Hide advanced" : "Advanced"}
      </button>

      {advanced ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Exclude keywords</Label>
            <Input
              value={excludeKeywords}
              onChange={(e) => setExcludeKeywords(e.target.value)}
              placeholder="unsubscribe"
            />
          </div>

          <div className="space-y-1">
            <Label>Exclude sender domains</Label>
            <Input
              value={excludeSenderDomains}
              onChange={(e) => setExcludeSenderDomains(e.target.value)}
              placeholder="mailchimp.com"
            />
          </div>

          <div className="space-y-1">
            <Label>Exclude sender emails</Label>
            <Input
              value={excludeSenderEmails}
              onChange={(e) => setExcludeSenderEmails(e.target.value)}
              placeholder="noreply@…"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Push min confidence</Label>
              <Input
                value={pushMinConf}
                onChange={(e) => setPushMinConf(e.target.value)}
                placeholder="0.85"
              />
            </div>
            <div className="space-y-1">
              <Label>Draft min confidence</Label>
              <Input
                value={draftMinConf}
                onChange={(e) => setDraftMinConf(e.target.value)}
                placeholder="0.7"
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          loading={saving}
          onClick={async () => {
            if (!selected) return;
            setSaving(true);
            setStatus("");
            setError(null);

            try {
              const matchers = {
                keywords: csvToList(keywords),
                sender_domains: csvToList(senderDomains),
                sender_emails: csvToList(senderEmails),
                exclude_keywords: csvToList(excludeKeywords),
                exclude_sender_domains: csvToList(excludeSenderDomains),
                exclude_sender_emails: csvToList(excludeSenderEmails),
              };

              const actions: any = {
                ignore,
                push,
                llm_summarize: summarize,
                llm_draft: draft,
                llm_classify: classify,
              };

              if (pushMinConf.trim())
                actions.push_min_confidence = Number(pushMinConf);
              else delete actions.push_min_confidence;

              if (draftMinConf.trim())
                actions.draft_min_confidence = Number(draftMinConf);
              else delete actions.draft_min_confidence;

              const { error } = await supabase
                .from("email_buckets")
                .update({ is_enabled: enabled, matchers, actions })
                .eq("id", selected.id);

              if (error) throw new Error(error.message);
              setStatus("Saved.");
              await refresh();
            } catch (e: unknown) {
              setError(e instanceof Error ? e.message : "Failed to save.");
            } finally {
              setSaving(false);
            }
          }}
        >
          Save
        </Button>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => refresh()}
        >
          Refresh
        </Button>

        {status ? <div className="text-xs text-black/60">{status}</div> : null}
        {error ? <div className="text-xs text-red-700">{error}</div> : null}
      </div>

      <div className="text-xs text-black/50">
        <Badge variant="neutral">Tip</Badge> Put the most important bucket
        keywords in “Priority” and raise its confidence gates to reduce noise.
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={disabled ? "opacity-50" : ""}>
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        className={
          "inline-flex h-8 items-center gap-2 rounded-xl border border-black/10 bg-white/55 px-3 text-xs font-medium text-black/70 shadow-sm backdrop-blur-xl transition peer-checked:bg-ink peer-checked:text-paper"
        }
      >
        {label}
      </span>
    </label>
  );
}
