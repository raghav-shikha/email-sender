import Link, { type LinkProps } from "next/link";
import * as React from "react";

import { buttonClassName, type ButtonSize, type ButtonVariant } from "@/components/ui/Button";

export type ButtonLinkProps = LinkProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
  };

export function ButtonLink({ variant = "primary", size = "md", className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClassName({ variant, size, className })} {...props} />;
}
