import * as React from "react";

import { cn } from "@/lib/cn";

export type BadgeVariant = "neutral" | "good" | "warn" | "danger" | "info";

export function Badge({
  variant = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  const variants: Record<BadgeVariant, string> = {
    neutral: "border-black/10 bg-white/55 text-black/60",
    good: "border-emerald-200/60 bg-emerald-50/60 text-emerald-800",
    warn: "border-amber-200/70 bg-amber-50/70 text-amber-900",
    danger: "border-red-200/70 bg-red-50/70 text-red-800",
    info: "border-sky-200/70 bg-sky-50/70 text-sky-900"
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-tight backdrop-blur",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
