"use client";

import { useI18n } from "@/lib/i18n/context";
import type { Match } from "@/lib/matches";
import { cn } from "@/lib/cn";

export function OddsPanel({ match }: { match: Match }) {
  const { t } = useI18n();
  if (!match.odds || !match.fairProb) return null;

  const cols = [
    { label: t("odds_home"), odds: match.odds.home, prob: match.fairProb.home, lead: true },
    { label: t("odds_draw"), odds: match.odds.draw, prob: match.fairProb.draw },
    { label: t("odds_away"), odds: match.odds.away, prob: match.fairProb.away },
  ];

  return (
    <div className="rounded-2xl border border-default bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t("market_consensus")}</h3>
        <span className="text-[10px] text-fg-subtle">12 bookmaker · 17:02 UTC</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {cols.map((c, i) => (
          <div
            key={i}
            className={cn(
              "rounded-xl bg-surface-2 p-3 text-center",
              c.lead && "ring-1 ring-[color-mix(in_oklch,var(--color-accent)_30%,transparent)]"
            )}
          >
            <div className="text-[10px] uppercase tracking-wider text-fg-subtle">
              {c.label}
            </div>
            <div className="mt-1 text-2xl font-extrabold">{c.odds.toFixed(2)}</div>
            <div
              className={cn(
                "text-[11px]",
                c.lead ? "font-semibold text-accent" : "text-fg-muted"
              )}
            >
              %{(c.prob * 100).toFixed(1)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
