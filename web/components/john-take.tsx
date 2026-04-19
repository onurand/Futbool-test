"use client";

import { ArrowUp } from "lucide-react";
import { Crest } from "@/components/crest";
import { useI18n } from "@/lib/i18n/context";

export function JohnTake() {
  const { t } = useI18n();

  return (
    <div className="rounded-2xl border border-default bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <Crest label="J" className="shine text-[var(--color-accent-fg)] rounded-full" size="sm" />
        <div>
          <div className="text-sm font-semibold">John</div>
          <div className="text-[11px] text-fg-subtle">{t("premier_analyst")}</div>
        </div>
      </div>

      <div className="space-y-4">
        <Section label={t("direct_view")} body={t("john_direct")} />
        <Section label={t("why_market")} body={t("john_why")} />
        <Section label={t("my_angle")}   body={t("john_angle")} />

        <div className="rounded-xl border-l-2 border-[var(--color-accent)] bg-[color-mix(in_oklch,var(--color-accent)_10%,transparent)] p-3">
          <div className="text-[10px] uppercase tracking-[0.14em] text-accent">
            {t("if_surprise")}
          </div>
          <p className="mt-1 text-[15px] leading-relaxed">{t("john_upset")}</p>
        </div>

        <div className="flex items-center gap-3 rounded-xl bg-surface-2 p-3">
          <div className="text-[10px] uppercase tracking-[0.14em] text-fg-subtle">
            {t("confidence")}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-extrabold text-accent">7</span>
            <span className="text-xs text-fg-subtle">/10</span>
          </div>
          <div className="ml-auto h-2 w-28 overflow-hidden rounded-full bg-bg">
            <div className="h-full rounded-full bg-accent" style={{ width: "70%" }} />
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-subtle pt-3 text-[11px]">
        <span className="text-fg-subtle">{t("sources")}</span>
        <Chip>12 bookmaker</Chip>
        <Chip>{t("src_form")}</Chip>
        <Chip>{t("src_squad")}</Chip>
        <Chip>ensemble</Chip>
      </div>
    </div>
  );
}

export function AskJohnBar({ mode = "fast" }: { mode?: "fast" | "sharp" }) {
  const { t } = useI18n();
  return (
    <div className="rounded-2xl border border-default bg-surface p-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder={t("ask_john_ph")}
          className="flex-1 rounded-lg bg-surface-2 px-3 py-2.5 text-sm placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        />
        <button
          title={mode === "sharp" ? t("mode_sharp_cost") : t("mode_fast_cost")}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg shine text-[var(--color-accent-fg)]"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-1.5 text-[10px] text-fg-subtle">
        {mode === "sharp" ? t("mode_sharp_cost") : t("mode_fast_cost")}
      </div>
    </div>
  );
}

function Section({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-fg-subtle">{label}</div>
      <p className="mt-1 text-[15px] leading-relaxed">{body}</p>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-fg-muted">{children}</span>
  );
}
