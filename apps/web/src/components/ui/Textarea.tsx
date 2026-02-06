import * as React from "react";

import { cn } from "@/lib/cn";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "min-h-[120px] w-full resize-y rounded-xl border border-black/10 bg-white/65 px-3 py-2 text-sm text-black/80 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset] outline-none transition placeholder:text-black/30 focus:border-accent/35 focus:ring-2 focus:ring-accent/20",
          className
        )}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";
