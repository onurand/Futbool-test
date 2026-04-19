import * as React from "react";
import { cn } from "@/lib/cn";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-10 w-full rounded-md border border-default bg-surface-2 px-3 py-2 text-sm text-fg",
      "placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]",
      "disabled:opacity-50",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[88px] w-full rounded-md border border-default bg-surface-2 px-3 py-2 text-sm text-fg",
      "placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]",
      "resize-none disabled:opacity-50",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
