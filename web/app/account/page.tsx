"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Crest } from "@/components/crest";
import { useI18n } from "@/lib/i18n/context";
import { supabaseBrowser } from "@/lib/supabase";

export default function AccountPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabaseBrowser()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    window.location.href = "/";
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-4">
      <h1 className="text-xl font-semibold tracking-tight">{t("nav_account")}</h1>

      {!email ? (
        <div className="mt-4 rounded-2xl border border-default bg-surface p-4">
          <div className="text-sm text-fg-muted">
            {t("log_in")} / {t("sign_up")}
          </div>
          <div className="mt-3 flex gap-2">
            <Link
              href="/login"
              className="flex-1 rounded-lg bg-surface-2 py-2.5 text-center text-sm font-semibold"
            >
              {t("log_in")}
            </Link>
            <Link
              href="/signup"
              className="flex-1 rounded-lg shine py-2.5 text-center text-sm font-semibold text-[var(--color-accent-fg)]"
            >
              {t("sign_up")}
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-4 rounded-2xl border border-default bg-surface p-4">
            <div className="flex items-center gap-3">
              <Crest label={email[0].toUpperCase()} className="shine text-[var(--color-accent-fg)] rounded-full" size="md" />
              <div>
                <div className="text-sm font-semibold">{email}</div>
                <div className="text-[11px] text-fg-subtle">{t("free_member")}</div>
              </div>
            </div>
            <div className="mt-4 rounded-xl bg-surface-2 p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-fg-muted">{t("tokens_this_mo")}</span>
                <span className="font-semibold">18 / 20</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg">
                <div className="h-full rounded-full bg-accent" style={{ width: "90%" }} />
              </div>
            </div>
            <Link
              href="/pricing"
              className="mt-3 block w-full rounded-lg shine py-2.5 text-center text-sm font-semibold text-[var(--color-accent-fg)]"
            >
              {t("upgrade_plan")}
            </Link>
          </div>

          <div className="mt-3 divide-y divide-[var(--color-border-subtle)] overflow-hidden rounded-2xl border border-default bg-surface text-sm">
            <Row label={t("notifications")} />
            <Row label={t("fav_teams")} />
            <Row label={t("help")} />
            <button
              onClick={signOut}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-live"
            >
              <span>{t("sign_out")}</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </>
      )}
    </main>
  );
}

function Row({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span>{label}</span>
      <ChevronRight className="h-4 w-4 text-fg-subtle" />
    </div>
  );
}
