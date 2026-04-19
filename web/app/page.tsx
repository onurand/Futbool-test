"use client";

import { useI18n } from "@/lib/i18n/context";
import { MATCHES } from "@/lib/matches";
import { MatchHeroCard, MatchRowCard } from "@/components/match-card";

export default function MatchesPage() {
  const { t } = useI18n();
  const [hero, ...rest] = MATCHES;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-fg-subtle">
            {t("today")}
          </div>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight">
            {t("england_fixtures")}
          </h1>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] text-fg-muted">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
          <span>{t("live_odds")}</span>
        </div>
      </div>

      <MatchHeroCard match={hero} />

      <div className="mt-5 mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium text-fg-muted">{t("other_fixtures")}</h2>
        <span className="text-[11px] text-fg-subtle">{t("incl_championship")}</span>
      </div>

      <div className="space-y-2">
        {rest.map((m) => (
          <MatchRowCard key={m.id} match={m} />
        ))}
      </div>
    </main>
  );
}
