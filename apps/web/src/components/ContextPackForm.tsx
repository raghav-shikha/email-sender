"use client";

import { useEffect, useMemo, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";

type ContextPackRow = {
  brand_name: string | null;
  brand_blurb: string | null;
  tone: string | null;
  signature: string | null;
  keywords_array: string[] | null;
};

export function ContextPackForm() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [row, setRow] = useState<ContextPackRow>({
    brand_name: "",
    brand_blurb: "",
    tone: "",
    signature: "",
    keywords_array: []
  });
  const [keywords, setKeywords] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setStatus("");
      const sessionRes = await supabase.auth.getSession();
      if (!sessionRes.data.session) return;

      const { data, error } = await supabase
        .from("context_packs")
        .select("brand_name,brand_blurb,tone,signature,keywords_array")
        .maybeSingle();

      if (!alive) return;
      if (error) {
        setStatus(error.message);
        return;
      }
      if (data) {
        const r = data as ContextPackRow;
        setRow(r);
        setKeywords((r.keywords_array || []).join(", "));
      }
    })();
    return () => {
      alive = false;
    };
  }, [supabase]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <Label>Brand name</Label>
          <Input
            value={row.brand_name ?? ""}
            onChange={(e) => setRow((r) => ({ ...r, brand_name: e.target.value }))}
            placeholder="e.g. Shikha"
          />
        </div>

        <div className="space-y-1">
          <Label>Tone</Label>
          <Input
            placeholder='e.g. "concise, warm, professional"'
            value={row.tone ?? ""}
            onChange={(e) => setRow((r) => ({ ...r, tone: e.target.value }))}
          />
        </div>

        <div className="space-y-1 md:col-span-2">
          <Label>Brand blurb</Label>
          <Textarea
            rows={4}
            value={row.brand_blurb ?? ""}
            onChange={(e) => setRow((r) => ({ ...r, brand_blurb: e.target.value }))}
            placeholder="A 2-4 sentence description of what you do and who you serve."
          />
        </div>

        <div className="space-y-1 md:col-span-2">
          <Label>Signature</Label>
          <Textarea
            rows={4}
            placeholder="Best,\nName\nCompany"
            value={row.signature ?? ""}
            onChange={(e) => setRow((r) => ({ ...r, signature: e.target.value }))}
          />
        </div>

        <div className="space-y-1 md:col-span-2">
          <Label>Keywords (comma-separated)</Label>
          <Input
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="quote, invoice, pricing, MOQ"
          />
          <div className="text-xs text-black/50">
            These are used as a fast prefilter before the LLM classification.
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            setStatus("");
            try {
              const sessionRes = await supabase.auth.getSession();
              const session = sessionRes.data.session;
              if (!session) {
                setStatus("Sign in first.");
                return;
              }

              const kw = keywords
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);

              const { error } = await supabase.from("context_packs").upsert({
                user_id: session.user.id,
                brand_name: row.brand_name,
                brand_blurb: row.brand_blurb,
                tone: row.tone,
                signature: row.signature,
                keywords_array: kw
              });

              if (error) setStatus(error.message);
              else setStatus("Saved.");
            } finally {
              setBusy(false);
            }
          }}
        >
          Save
        </Button>

        {status ? <div className="text-xs text-black/60">{status}</div> : null}
      </div>
    </div>
  );
}
