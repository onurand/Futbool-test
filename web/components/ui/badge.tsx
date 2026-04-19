import * as React from "react";
import { cn } from "@/lib/cn";

export function Badge({
  className,
  tone = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "default" | "accent" | "success" | "warning" | "danger" | "muted";
}) {
  const palette: Record<string, string> = {
    default: "bg-surface-2 text-fg border-default",
    accent: "bg-[color-mix(in_oklch,var(--color-accent)_25%,transparent)] text-[var(--color-accent)] border-[color-mix(in_oklch,var(--color-accent)_40%,transparent)]",
    success: "bg-[color-mix(in_oklch,var(--color-success)_22%,transparent)] text-[var(--color-success)] border-[color-mix(in_oklch,var(--color-success)_40%,transparent)]",
    warning: "bg-[color-mix(in_oklch,var(--color-warning)_22%,transparent)] text-[var(--color-warning)] border-[color-mix(in_oklch,var(--color-warning)_40%,transparent)]",
    danger:  "bg-[color-mix(in_oklch,var(--color-danger)_22%,transparent)] text-[var(--color-danger)] border-[color-mix(in_oklch,var(--color-danger)_40%,transparent)]",
    muted:   "bg-surface text-fg-muted border-subtle",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        palette[tone],
        className
      )}
      {...props}
    />
  );
}
