"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { cn } from "@/lib/cn";
import { createCheckout } from "@/lib/api";
import { supabaseBrowser } from "@/lib/supabase";

export default function PricingPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const plans = [
    { code: "free",            name: t("free_plan"),                price: "$0",     tokens: `20 ${t("tokens_per_mo")}` },
    { code: "england_pack",    name: "England Pack · John 🏴",      price: "$9.99",  tokens: `500 ${t("fast_plus_sharp")}`, highlight: true, cta: t("subscribe") },
    { code: "all_leagues_pro", name: "All-Leagues Pro 🌍",           price: "$24.99", tokens: `2000 ${t("all_agents")}`,      cta: t("subscribe") },
    { code: "turkiye_pack",    name: "Türkiye Pack · Emre 🇹🇷",      price: "$7.99",  tokens: `500 ${t("tokens_per_mo")} · ${t("soon")}`, muted: true },
  ];

  async function onSubscribe(packageCode: string) {
    setError(null);
    const supa = supabaseBrowser();
    const { data } = await supa.auth.getSession();
    if (!data.session) {
      router.push("/login");
      return;
    }
    setLoading(packageCode);
    try {
      const { url } = await createCheckout(packageCode);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "checkout failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-4">
      <h1 className="text-xl font-semibold tracking-tight">{t("nav_packages")}</h1>
      <p className="mt-1 text-sm text-fg-muted">{t("packages_intro")}</p>

      {error && (
        <p className="mt-3 rounded-md border border-[color-mix(in_oklch,var(--color-danger)_40%,transparent)] bg-[color-mix(in_oklch,var(--color-danger)_12%,transparent)] px-3 py-2 text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}

      <div className="mt-5 space-y-3">
        {plans.map((p) => (
          <div
            key={p.code}
            className={cn(
              "relative rounded-2xl border bg-surface p-4",
              p.highlight
                ? "border-2 border-[color-mix(in_oklch,var(--color-accent)_60%,transparent)]"
                : "border-default"
            )}
          >
            {p.highlight && (
              <span className="absolute -top-2 left-4 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-[var(--color-accent-fg)]">
                {t("most_popular")}
              </span>
            )}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">{p.name}</div>
                <div className="text-[11px] text-fg-subtle">{p.tokens}</div>
              </div>
              <div className={cn("text-lg font-extrabold", p.muted && "text-fg-muted")}>
                {p.price}
              </div>
            </div>
            {p.cta && !p.muted && (
              <button
                onClick={() => onSubscribe(p.code)}
                disabled={loading === p.code}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg shine py-2.5 text-sm font-semibold text-[var(--color-accent-fg)] disabled:opacity-60"
              >
                {loading === p.code && <Loader2 className="h-4 w-4 animate-spin" />}
                {p.cta}
              </button>
            )}
          </div>
        ))}

        <button
          onClick={() => onSubscribe("top_up_500")}
          disabled={loading === "top_up_500"}
          className="flex w-full items-center justify-between rounded-2xl border border-default bg-surface p-4 text-sm text-fg-muted transition hover:border-[color-mix(in_oklch,var(--color-accent)_40%,transparent)] disabled:opacity-60"
        >
          <span className="flex items-center gap-2">
            {loading === "top_up_500" && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("topup")}
          </span>
          <span className="font-semibold text-fg">$4.99</span>
        </button>
      </div>
    </main>
  );
}
