"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, ExternalLink, Loader2 } from "lucide-react";
import { Crest } from "@/components/crest";
import { useI18n } from "@/lib/i18n/context";
import { supabaseBrowser } from "@/lib/supabase";
import { billingMe, openCustomerPortal, type BillingMe } from "@/lib/api";

export default function AccountPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState<string | null>(null);
  const [billing, setBilling] = useState<BillingMe | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    const supa = supabaseBrowser();
    supa.auth.getUser().then(async ({ data }) => {
      setEmail(data.user?.email ?? null);
      if (data.user) {
        try {
          setBilling(await billingMe());
        } catch {
          // keep null — guest-ish state
        }
      }
    });
  }, []);

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    window.location.href = "/";
  }

  async function openPortal() {
    setPortalLoading(true);
    try {
      const { url } = await openCustomerPortal();
      window.location.href = url;
    } catch {
      setPortalLoading(false);
    }
  }

  const tierLabel =
    billing?.active_packages.length
      ? billing.active_packages.join(" · ")
      : t("free_member");

  const balancePct = billing && billing.monthly_grant > 0
    ? Math.min(100, Math.round((billing.balance / billing.monthly_grant) * 100))
    : 100;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-4">
      <h1 className="text-xl font-semibold tracking-tight">{t("nav_account")}</h1>

      {!email ? (
        <div className="mt-4 rounded-2xl border border-default bg-surface p-4">
          <div className="text-sm text-fg-muted">
            {t("log_in")} / {t("sign_up")}
          </div>
          <div className="mt-3 flex gap-2">
            <Link href="/login" className="flex-1 rounded-lg bg-surface-2 py-2.5 text-center text-sm font-semibold">
              {t("log_in")}
            </Link>
            <Link href="/signup" className="flex-1 rounded-lg shine py-2.5 text-center text-sm font-semibold text-[var(--color-accent-fg)]">
              {t("sign_up")}
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-4 rounded-2xl border border-default bg-surface p-4">
            <div className="flex items-center gap-3">
              <Crest
                label={email[0].toUpperCase()}
                className="shine text-[var(--color-accent-fg)] rounded-full"
                size="md"
              />
              <div>
                <div className="text-sm font-semibold">{email}</div>
                <div className="text-[11px] text-fg-subtle">{tierLabel}</div>
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-surface-2 p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-fg-muted">{t("tokens_this_mo")}</span>
                <span className="font-semibold">
                  {billing ? `${billing.balance} / ${billing.monthly_grant}` : "…"}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg">
                <div className="h-full rounded-full bg-accent" style={{ width: `${balancePct}%` }} />
              </div>
            </div>

            <div className="mt-3 space-y-2">
              <Link
                href="/pricing"
                className="block w-full rounded-lg shine py-2.5 text-center text-sm font-semibold text-[var(--color-accent-fg)]"
              >
                {t("upgrade_plan")}
              </Link>
              {billing?.active_packages.length ? (
                <button
                  onClick={openPortal}
                  disabled={portalLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-surface-2 py-2.5 text-sm font-semibold disabled:opacity-60"
                >
                  {portalLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Stripe portal
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
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
