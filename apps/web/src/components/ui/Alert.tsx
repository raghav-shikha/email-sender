import * as React from "react";

import { cn } from "@/lib/cn";

export type AlertVariant = "neutral" | "danger" | "good";

export function Alert({
  variant = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: AlertVariant }) {
  const variants: Record<AlertVariant, string> = {
    neutral: "border-black/10 bg-white/45 text-black/75",
    good: "border-emerald-200/60 bg-emerald-50/60 text-emerald-900",
    danger: "border-red-200/70 bg-red-50/70 text-red-900"
  };

  return (
    <div
      role={variant === "danger" ? "alert" : undefined}
      className={cn(
        "rounded-2xl border p-4 text-sm backdrop-blur-xl shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_18px_60px_rgba(11,18,32,0.06)]",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
