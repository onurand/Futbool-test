"use client";

import Link from "next/link";
import { Crest } from "@/components/crest";
import { useI18n } from "@/lib/i18n/context";
import type { Match } from "@/lib/matches";

export function MatchHeroCard({ match }: { match: Match }) {
  const { t } = useI18n();
  return (
    <Link
      href={`/match/${match.id}` as never}
      className="relative block w-full overflow-hidden rounded-2xl border border-default bg-surface transition hover:border-[color-mix(in_oklch,var(--color-accent)_60%,transparent)]"
    >
      <div className="pitch-lines absolute inset-0 opacity-20" />
      <div className="relative p-4">
        <div className="mb-3 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-2 text-fg-muted">
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-gold)]" />
              {match.league}
            </span>
            {match.venue && (
              <>
                <span>·</span>
                <span>{match.venue}</span>
              </>
            )}
          </div>
          <span className="rounded-full border border-[color-mix(in_oklch,var(--color-accent)_40%,transparent)] bg-[color-mix(in_oklch,var(--color-accent)_15%,transparent)] px-2 py-0.5 font-semibold text-accent">
            {match.kickoff}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-1 items-center gap-3">
            <Crest
              label={match.home.short}
              style={{ background: match.home.crestBg, color: match.home.crestFg }}
            />
            <div>
              <div className="font-semibold leading-tight">{match.home.name}</div>
              <div className="text-[11px] text-fg-subtle">{t("home_team")}</div>
            </div>
          </div>
          <span className="text-sm text-fg-subtle">vs</span>
          <div className="flex flex-1 items-center justify-end gap-3">
            <div className="text-right">
              <div className="font-semibold leading-tight">{match.away.name}</div>
              <div className="text-[11px] text-fg-subtle">{t("away_team")}</div>
            </div>
            <Crest
              label={match.away.short}
              style={{ background: match.away.crestBg, color: match.away.crestFg }}
            />
          </div>
        </div>

        {match.odds && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { k: "odds_home" as const, v: match.odds.home },
              { k: "odds_draw" as const, v: match.odds.draw },
              { k: "odds_away" as const, v: match.odds.away },
            ].map((o) => (
              <div key={o.k} className="rounded-xl bg-surface-2 py-2.5 text-center">
                <div className="text-[10px] uppercase tracking-wider text-fg-subtle">
                  {t(o.k)}
                </div>
                <div className="mt-0.5 text-lg font-semibold">{o.v.toFixed(2)}</div>
              </div>
            ))}
          </div>
        )}

        {match.hasJohnTake && (
          <div className="mt-3 flex items-center justify-between rounded-xl border border-[color-mix(in_oklch,var(--color-accent)_25%,transparent)] bg-[color-mix(in_oklch,var(--color-accent)_10%,transparent)] px-3 py-2 text-[12px]">
            <div className="flex items-center gap-2">
              <Crest label="J" size="sm" className="shine rounded-full text-[var(--color-accent-fg)]" />
              <span>{t("johns_take_ready")}</span>
            </div>
            <span className="font-semibold text-accent">{t("read")}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

export function MatchRowCard({ match }: { match: Match }) {
  return (
    <Link
      href={`/match/${match.id}` as never}
      className="flex items-center gap-3 rounded-xl border border-default bg-surface px-3 py-3 transition hover:border-[color-mix(in_oklch,var(--color-accent)_40%,transparent)]"
    >
      <div className="w-10 shrink-0 text-center">
        {match.status === "live" ? (
          <>
            <div className="flex items-center justify-center gap-1">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-live" />
              <span className="text-[11px] font-semibold text-live">{match.minute}&apos;</span>
            </div>
            <div className="text-[10px] text-fg-subtle">{match.leagueShort}</div>
          </>
        ) : (
          <>
            <div className="text-sm font-semibold text-accent">{match.kickoff}</div>
            <div className="text-[10px] text-fg-subtle">{match.leagueShort}</div>
          </>
        )}
      </div>

      <div className="flex flex-1 items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <Crest
            label={match.home.short}
            size="sm"
            style={{ background: match.home.crestBg, color: match.home.crestFg }}
          />
          <span className="truncate text-sm">{match.home.name}</span>
        </div>
        <span className="shrink-0 text-sm text-fg-subtle">
          {match.status === "live" && match.score
            ? `${match.score.home} — ${match.score.away}`
            : "—"}
        </span>
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate text-sm">{match.away.name}</span>
          <Crest
            label={match.away.short}
            size="sm"
            style={{ background: match.away.crestBg, color: match.away.crestFg }}
          />
        </div>
      </div>

      {match.status === "live" ? (
        <span className="shrink-0 rounded-full bg-[color-mix(in_oklch,var(--color-live)_15%,transparent)] px-2 py-0.5 text-[10px] font-semibold text-live">
          LIVE
        </span>
      ) : match.odds ? (
        <span className="shrink-0 text-[11px] text-fg-muted">{match.odds.home.toFixed(2)}</span>
      ) : null}
    </Link>
  );
}
