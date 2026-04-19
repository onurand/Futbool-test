"use client";

import { useI18n } from "@/lib/i18n/context";
import { cn } from "@/lib/cn";

export default function PricingPage() {
  const { t } = useI18n();

  const plans = [
    {
      code: "free",
      name: t("free_plan"),
      price: "$0",
      tokens: `20 ${t("tokens_per_mo")}`,
    },
    {
      code: "england",
      name: "England Pack · John 🏴",
      price: "$9.99",
      tokens: `500 ${t("fast_plus_sharp")}`,
      highlight: true,
      cta: t("subscribe"),
    },
    {
      code: "pro",
      name: "All-Leagues Pro 🌍",
      price: "$24.99",
      tokens: `2000 ${t("all_agents")}`,
    },
    {
      code: "turkiye",
      name: "Türkiye Pack · Emre 🇹🇷",
      price: "$7.99",
      tokens: `500 ${t("tokens_per_mo")} · ${t("soon")}`,
      muted: true,
    },
  ];

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-4">
      <h1 className="text-xl font-semibold tracking-tight">{t("nav_packages")}</h1>
      <p className="mt-1 text-sm text-fg-muted">{t("packages_intro")}</p>

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
              <div
                className={cn(
                  "text-lg font-extrabold",
                  p.muted && "text-fg-muted"
                )}
              >
                {p.price}
              </div>
            </div>
            {p.cta && (
              <button className="mt-3 w-full rounded-lg shine py-2.5 text-sm font-semibold text-[var(--color-accent-fg)]">
                {p.cta}
              </button>
            )}
          </div>
        ))}

        <div className="rounded-2xl border border-default bg-surface p-4 text-sm text-fg-muted">
          <div className="flex items-center justify-between">
            <span>{t("topup")}</span>
            <span className="font-semibold text-fg">$4.99</span>
          </div>
        </div>
      </div>
    </main>
  );
}
