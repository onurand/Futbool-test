import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/cn";

const plans = [
  {
    code: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    tokens: "20 tokens / month",
    mode: "Fast pundit only",
    cta: "Start free",
    highlight: false,
    features: [
      "Limited agent access",
      "Fast pundit answers (1 token each)",
      "Market consensus surfaced",
    ],
  },
  {
    code: "england_pack",
    name: "England Pack",
    price: "$9.99",
    period: "month",
    tokens: "500 tokens / month",
    mode: "Fast + Sharp analysis",
    cta: "Subscribe",
    highlight: true,
    features: [
      "John — Premier League + Championship",
      "Sharp analysis mode (5 tokens)",
      "Line movement history",
      "Top-ups available any time",
    ],
  },
  {
    code: "all_leagues_pro",
    name: "All-Leagues Pro",
    price: "$24.99",
    period: "month",
    tokens: "2000 tokens / month",
    mode: "All agents + extras",
    cta: "Go pro",
    highlight: false,
    features: [
      "John, Carlos, Hans, Emre (as each goes live)",
      "Sharp analysis mode",
      "Market movement add-on",
      "Priority model queue",
    ],
  },
];

const others = [
  { name: "Spain Pack",    price: "$9.99",  agents: "Carlos — La Liga",      tokens: "500" },
  { name: "Germany Pack",  price: "$9.99",  agents: "Hans — Bundesliga",     tokens: "500" },
  { name: "Türkiye Pack",  price: "$7.99",  agents: "Emre — Süper Lig",      tokens: "500" },
  { name: "Top-up 500",    price: "$4.99",  agents: "any active agent",       tokens: "+500 (one-time)" },
];

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-2 text-sm text-fg-muted hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="max-w-2xl">
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
          Subscribe to the leagues you follow.
        </h1>
        <p className="mt-4 text-lg text-fg-muted">
          Monthly tokens renew automatically. Fast pundit answers cost 1 token;
          sharp analysis costs 5. Cached queries are free.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
        {plans.map((p) => (
          <Card
            key={p.code}
            className={cn(
              "relative flex flex-col",
              p.highlight && "border-[color-mix(in_oklch,var(--color-accent)_55%,transparent)] glow-accent bg-surface-2"
            )}
          >
            {p.highlight && (
              <Badge tone="accent" className="absolute -top-2 left-6">
                Most popular
              </Badge>
            )}
            <CardTitle className="text-xl">{p.name}</CardTitle>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-3xl font-semibold">{p.price}</span>
              <span className="text-sm text-fg-subtle">/ {p.period}</span>
            </div>
            <CardDescription className="mt-1">{p.tokens} · {p.mode}</CardDescription>

            <ul className="mt-6 space-y-2 text-sm">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 text-accent" />
                  <span className="text-fg-muted">{f}</span>
                </li>
              ))}
            </ul>

            <div className="mt-auto pt-6">
              <Button
                variant={p.highlight ? "primary" : "secondary"}
                className="w-full"
              >
                {p.cta}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <h2 className="mt-16 text-sm font-medium uppercase tracking-wider text-fg-subtle">
        Other packages
      </h2>
      <div className="mt-4 overflow-hidden rounded-xl border border-subtle">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface text-left text-xs uppercase tracking-wider text-fg-subtle">
              <th className="px-4 py-3 font-medium">Pack</th>
              <th className="px-4 py-3 font-medium">Agent · League</th>
              <th className="px-4 py-3 font-medium">Tokens</th>
              <th className="px-4 py-3 text-right font-medium">Price</th>
            </tr>
          </thead>
          <tbody>
            {others.map((o) => (
              <tr key={o.name} className="border-t border-subtle">
                <td className="px-4 py-3 font-medium">{o.name}</td>
                <td className="px-4 py-3 text-fg-muted">{o.agents}</td>
                <td className="px-4 py-3 text-fg-muted">{o.tokens}</td>
                <td className="px-4 py-3 text-right">{o.price}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-8 text-xs text-fg-subtle">
        Checkout and subscription management arrive in Phase 2 (Stripe). The
        plans above are final pricing targets and will be wired to Stripe Prices
        once keys are in place.
      </p>
    </main>
  );
}
