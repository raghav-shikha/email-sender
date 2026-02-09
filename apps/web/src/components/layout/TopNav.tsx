"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/ButtonLink";

const NAV = [
  { href: "/inbox", label: "Inbox" },
  { href: "/setup", label: "Setup" }
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
          <ButtonLink href="/setup" variant="secondary" size="sm">
            {userEmail ? "Setup" : "Get started"}
          </ButtonLink>
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
