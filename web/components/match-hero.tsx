"use client";

import { Crest } from "@/components/crest";
import { useI18n } from "@/lib/i18n/context";
import type { Match } from "@/lib/matches";

export function MatchHero({ match }: { match: Match }) {
  const { t } = useI18n();
  return (
    <div className="relative overflow-hidden rounded-2xl border border-default bg-surface">
      <div className="pitch-lines absolute inset-0 opacity-15" />
      <div className="relative p-4">
        <div className="flex items-center justify-between text-[11px] text-fg-muted">
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-gold)]" />
            {match.league} · {t("matchweek")}
          </span>
          <span className="rounded-full border border-[color-mix(in_oklch,var(--color-accent)_40%,transparent)] bg-[color-mix(in_oklch,var(--color-accent)_15%,transparent)] px-2 py-0.5 font-semibold text-accent">
            {match.kickoff}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="flex flex-col items-center">
            <Crest
              size="lg"
              label={match.home.short}
              style={{ background: match.home.crestBg, color: match.home.crestFg }}
            />
            <div className="mt-2 text-center font-semibold leading-tight">
              {match.home.name.split(" ").map((w, i) => (
                <span key={i} className="block">{w}</span>
              ))}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-[0.2em] text-fg-subtle">VS</div>
            {match.venue && (
              <div className="mt-1 text-[11px] text-fg-muted">{match.venue}</div>
            )}
          </div>
          <div className="flex flex-col items-center">
            <Crest
              size="lg"
              label={match.away.short}
              style={{ background: match.away.crestBg, color: match.away.crestFg }}
            />
            <div className="mt-2 text-center font-semibold leading-tight">
              {match.away.name.split(" ").map((w, i) => (
                <span key={i} className="block">{w}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
