import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Gauge,
  LineChart,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

const agents = [
  {
    code: "john",
    name: "John",
    tag: "Premier League · Championship",
    status: "active" as const,
    flag: "🏴",
  },
  { code: "carlos", name: "Carlos", tag: "La Liga",     status: "planned" as const, flag: "🇪🇸" },
  { code: "hans",   name: "Hans",   tag: "Bundesliga",  status: "planned" as const, flag: "🇩🇪" },
  { code: "emre",   name: "Emre",   tag: "Süper Lig",   status: "planned" as const, flag: "🇹🇷" },
];

const features = [
  {
    icon: Target,
    title: "Market-first reasoning",
    body: "Bookmaker consensus from 8-20 books, vig-clean fair probabilities, and explicit snapshot timestamps. Never invented.",
  },
  {
    icon: LineChart,
    title: "Form + availability context",
    body: "Rolling home/away splits, xG trends, injuries and suspensions folded into every take.",
  },
  {
    icon: Sparkles,
    title: "Upset paths, not hot takes",
    body: "John names the most plausible surprise — and is honest when the surprise is a draw, not an away win.",
  },
  {
    icon: ShieldCheck,
    title: "No hallucinated numbers",
    body: "Every score, odd and injury is sourced from a tool. Missing data is surfaced, never fabricated.",
  },
];

export default function HomePage() {
  return (
    <main className="relative isolate">
      <div className="pointer-events-none absolute inset-0 -z-10 grid-dots opacity-50" />

      <Header />

      <section className="mx-auto max-w-6xl px-6 pt-24 pb-20 md:pt-32">
        <Badge tone="accent" className="mb-6">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
          Phase 1 · John is live in mock mode
        </Badge>
        <h1 className="text-balance text-5xl font-semibold tracking-tight md:text-6xl">
          Sharp, data-grounded football analysts.
          <br />
          <span className="text-fg-muted">Not a chatbot. A pundit that reads the market.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-fg-muted">
          Futbool pairs Claude with live market and fixture data. Ask about tonight&apos;s
          game — get bookmaker consensus, the most plausible upset path, and an honest
          confidence score.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/signup">
            <Button size="lg">
              Create account <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/chat">
            <Button size="lg" variant="secondary">
              Try the chat
            </Button>
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="text-sm font-medium uppercase tracking-wider text-fg-subtle">
          Agents
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          {agents.map((a) => (
            <Card key={a.code} className="relative">
              <div className="flex items-center justify-between">
                <span className="text-2xl">{a.flag}</span>
                <Badge tone={a.status === "active" ? "success" : "muted"}>
                  {a.status}
                </Badge>
              </div>
              <CardTitle className="mt-6">{a.name}</CardTitle>
              <CardDescription>{a.tag}</CardDescription>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-sm font-medium uppercase tracking-wider text-fg-subtle">
          How John reasons
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {features.map((f) => (
            <Card key={f.title}>
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-2 text-accent">
                  <f.icon className="h-4 w-4" />
                </span>
                <CardTitle className="text-base">{f.title}</CardTitle>
              </div>
              <CardDescription className="mt-3">{f.body}</CardDescription>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <Card className="glow-accent flex flex-col items-start justify-between gap-6 bg-surface-2 p-8 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Gauge className="h-5 w-5 text-accent" />
              <span className="text-sm font-medium uppercase tracking-wider text-fg-subtle">
                Pricing
              </span>
            </div>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight">
              League-based packages, token-priced answers.
            </h3>
            <p className="mt-2 max-w-xl text-fg-muted">
              Subscribe to the leagues you follow. Fast pundit answers cost 1 token,
              sharp analysis costs 5. Monthly tokens renew; top-ups available any time.
            </p>
          </div>
          <Link href="/pricing">
            <Button variant="primary" size="lg">
              See plans <BarChart3 className="h-4 w-4" />
            </Button>
          </Link>
        </Card>
      </section>

      <Footer />
    </main>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-subtle backdrop-blur supports-[backdrop-filter]:bg-[color-mix(in_oklch,var(--color-bg)_80%,transparent)]">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-accent)] text-[var(--color-accent-fg)] text-xs font-bold">
            F
          </span>
          <span className="text-sm font-semibold tracking-tight">Futbool</span>
        </Link>
        <nav className="flex items-center gap-1">
          <Link href="/chat" className="px-3 py-1.5 text-sm text-fg-muted hover:text-fg">
            Chat
          </Link>
          <Link href="/pricing" className="px-3 py-1.5 text-sm text-fg-muted hover:text-fg">
            Pricing
          </Link>
          <Link href="/login">
            <Button variant="ghost" size="sm">Log in</Button>
          </Link>
          <Link href="/signup">
            <Button size="sm">Sign up</Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mx-auto mt-16 max-w-6xl border-t border-subtle px-6 py-10 text-sm text-fg-subtle">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <span>© {new Date().getFullYear()} Futbool · market-aware football analysts</span>
        <div className="flex gap-4">
          <Link href="/pricing" className="hover:text-fg">Pricing</Link>
          <Link href="/chat" className="hover:text-fg">Chat</Link>
          <Link href="/login" className="hover:text-fg">Log in</Link>
        </div>
      </div>
    </footer>
  );
}
