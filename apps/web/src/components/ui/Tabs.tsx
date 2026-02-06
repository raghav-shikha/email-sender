import * as React from "react";

import { cn } from "@/lib/cn";

export function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "inline-flex flex-wrap items-center gap-1 rounded-2xl border border-black/10 bg-white/45 p-1 backdrop-blur-xl",
        className
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  active,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "h-9 rounded-xl px-3 text-sm font-medium transition",
        active
          ? "bg-ink text-paper shadow-[0_1px_0_rgba(255,255,255,0.12)_inset,0_18px_40px_rgba(11,18,32,0.12)]"
          : "text-black/70 hover:bg-white/55",
        className
      )}
      {...props}
    />
  );
}
