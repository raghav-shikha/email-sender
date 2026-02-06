import * as React from "react";

import { cn } from "@/lib/cn";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "h-10 w-full rounded-xl border border-black/10 bg-white/65 px-3 text-sm text-black/80 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset] outline-none transition placeholder:text-black/30 focus:border-accent/35 focus:ring-2 focus:ring-accent/20",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
