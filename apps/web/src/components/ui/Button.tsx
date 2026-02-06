import * as React from "react";

import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:pointer-events-none disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-ink text-paper shadow-[0_1px_0_rgba(255,255,255,0.12)_inset,0_12px_30px_rgba(11,18,32,0.12)] hover:bg-ink/95",
  secondary:
    "border border-black/10 bg-white/55 text-black/85 backdrop-blur-xl shadow-[0_1px_0_rgba(255,255,255,0.75)_inset,0_12px_30px_rgba(11,18,32,0.08)] hover:bg-white/65",
  ghost: "text-black/75 hover:bg-white/55",
  danger:
    "bg-red-600 text-white shadow-[0_1px_0_rgba(255,255,255,0.12)_inset,0_12px_30px_rgba(220,38,38,0.18)] hover:bg-red-600/90"
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-base"
};

export function buttonClassName({
  variant = "primary",
  size = "md",
  className
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  return cn(base, variants[variant], sizes[size], className);
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading = false, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={buttonClassName({ variant, size, className })}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-b-transparent opacity-70"
          />
        ) : null}
        <span>{children}</span>
      </button>
    );
  }
);

Button.displayName = "Button";
