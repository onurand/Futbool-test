"use client";

import { useI18n } from "@/lib/i18n/context";
import { cn } from "@/lib/cn";

export type ChatMode = "fast" | "sharp";

export function ModeToggle({
  mode,
  onChange,
}: {
  mode: ChatMode;
  onChange: (m: ChatMode) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex gap-2">
      <Option
        active={mode === "fast"}
        onClick={() => onChange("fast")}
        title={t("mode_fast")}
        cost={t("mode_fast_cost")}
      />
      <Option
        active={mode === "sharp"}
        onClick={() => onChange("sharp")}
        title={t("mode_sharp")}
        cost={t("mode_sharp_cost")}
      />
    </div>
  );
}

function Option({
  active,
  onClick,
  title,
  cost,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  cost: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 rounded-xl border px-3 py-2 text-left transition",
        active
          ? "border-[color-mix(in_oklch,var(--color-accent)_60%,transparent)] bg-[color-mix(in_oklch,var(--color-accent)_14%,transparent)]"
          : "border-default bg-surface-2 hover:border-[color-mix(in_oklch,var(--color-accent)_30%,transparent)]"
      )}
    >
      <div className={cn("text-sm font-semibold", active && "text-accent")}>{title}</div>
      <div className="text-[11px] text-fg-subtle">{cost}</div>
    </button>
  );
}
