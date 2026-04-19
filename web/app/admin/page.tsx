import Link from "next/link";
import { ArrowLeft, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export default function AdminPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <Link
        href="/chat"
        className="mb-8 inline-flex items-center gap-2 text-sm text-fg-muted hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="flex items-center gap-3">
        <Settings className="h-5 w-5 text-accent" />
        <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
        <Badge tone="muted">Phase 3</Badge>
      </div>

      <p className="mt-3 max-w-2xl text-fg-muted">
        Product catalogue, user management, token ledger inspection, and
        analytics land here once the billing layer is live. Access gated by
        Supabase <code className="font-mono text-sm text-fg">role = admin</code>.
      </p>

      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
        <PlaceholderCard title="Packages" body="CRUD for products and Stripe Price IDs." />
        <PlaceholderCard title="Users" body="Search, tier change, manual token grants, bans." />
        <PlaceholderCard title="Subscriptions" body="Active / cancelled / refunded, jump to Stripe." />
        <PlaceholderCard title="Token ledger" body="Per-user spend history and anomaly flags." />
        <PlaceholderCard title="Usage analytics" body="Most-asked agents, fixtures, hours." />
        <PlaceholderCard title="System health" body="Cache hit rate, provider spend, errors." />
      </div>
    </main>
  );
}

function PlaceholderCard({ title, body }: { title: string; body: string }) {
  return (
    <Card className="opacity-70">
      <div className="flex items-center justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        <Badge tone="muted">stub</Badge>
      </div>
      <CardDescription className="mt-2">{body}</CardDescription>
    </Card>
  );
}
