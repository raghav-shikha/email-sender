"use client";

import { useMemo, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { urlBase64ToUint8Array } from "@/lib/push";
import { Button } from "@/components/ui/Button";

export function PushEnableButton() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="secondary"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          setStatus("");
          try {
            const sessionRes = await supabase.auth.getSession();
            const token = sessionRes.data.session?.access_token;
            if (!token) throw new Error("Sign in first.");

            if (!("serviceWorker" in navigator)) throw new Error("Service workers not supported.");
            if (!("PushManager" in window)) throw new Error("Push not supported in this browser.");

            const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            if (!vapidPublicKey) throw new Error("Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY");

            const registration = await navigator.serviceWorker.ready;
            const sub = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
            });

            const res = await fetch("/api/push/subscribe", {
              method: "POST",
              headers: {
                "content-type": "application/json",
                authorization: `Bearer ${token}`
              },
              body: JSON.stringify(sub)
            });
            if (!res.ok) throw new Error(await res.text());
            setStatus("Push enabled for this device.");
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Failed to enable push.";
            setStatus(msg);
          } finally {
            setBusy(false);
          }
        }}
      >
        Enable Push
      </Button>

      {status ? <div className="text-xs text-black/60">{status}</div> : null}
    </div>
  );
}
