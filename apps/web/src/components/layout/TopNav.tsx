"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

const NAV = [
  { href: "/inbox", label: "Inbox" },
  { href: "/settings", label: "Settings" }
] as const;

export function TopNav() {
  const pathname = usePathname();
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
    <header className="sticky top-0 z-40 -mx-4 border-b border-black/5 bg-white/35 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-4">
          <Link href="/" className="group inline-flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-ink text-paper shadow-[0_12px_30px_rgba(11,18,32,0.18)]">
              <span className="text-sm font-semibold">IC</span>
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight">Inbox Copilot</div>
              <div className="text-[11px] text-black/50">Review-first. Never auto-send.</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((l) => {
              const active = pathname === l.href || pathname.startsWith(l.href + "/");
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "rounded-xl px-3 py-2 text-sm font-medium transition",
                    active ? "bg-white/60 text-black shadow-sm" : "text-black/60 hover:bg-white/50"
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {userEmail ? <Badge className="hidden md:inline-flex">{userEmail}</Badge> : null}

          {userEmail ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/";
              }}
            >
              Sign out
            </Button>
          ) : (
            <Link
              href="/settings"
              className={
                "inline-flex h-9 items-center justify-center rounded-xl border border-black/10 bg-white/55 px-3 text-sm font-medium text-black/80 shadow-[0_1px_0_rgba(255,255,255,0.75)_inset,0_12px_30px_rgba(11,18,32,0.08)] backdrop-blur-xl transition hover:bg-white/65 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
              }
            >
              Sign in
            </Link>
          )}
        </div>
      </div>

      <nav className="mx-auto flex max-w-6xl items-center gap-1 px-4 pb-3 md:hidden">
        {NAV.map((l) => {
          const active = pathname === l.href || pathname.startsWith(l.href + "/");
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "flex-1 rounded-xl px-3 py-2 text-center text-sm font-medium transition",
                active ? "bg-white/60 text-black shadow-sm" : "text-black/60 hover:bg-white/50"
              )}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
