"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import {
  adminAnalytics,
  adminListLedger,
  adminListProducts,
  adminListUsers,
  adminUpdateProduct,
  type AdminAnalytics,
  type AdminProduct,
  type AdminUser,
  type LedgerEntry,
} from "@/lib/api";
import { cn } from "@/lib/cn";

type Tab = "products" | "users" | "ledger" | "analytics";

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("analytics");

  return (
    <main className="mx-auto max-w-4xl px-4 pb-24 pt-4">
      <div className="mb-4 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-accent" />
        <h1 className="text-xl font-semibold tracking-tight">Admin</h1>
      </div>

      <div className="mb-4 flex gap-1 overflow-x-auto rounded-full border border-default p-1 text-xs">
        {(["analytics", "products", "users", "ledger"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "whitespace-nowrap rounded-full px-3 py-1.5 font-medium",
              tab === t ? "bg-surface-2 text-fg" : "text-fg-muted"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "analytics" && <AnalyticsTab />}
      {tab === "products"  && <ProductsTab />}
      {tab === "users"     && <UsersTab />}
      {tab === "ledger"    && <LedgerTab />}
    </main>
  );
}

function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    fn().then(setData).catch((e) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, err, loading, reload: () => fn().then(setData) };
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-default bg-surface p-4">{children}</div>;
}

function Loading() {
  return (
    <div className="flex items-center gap-2 text-sm text-fg-muted">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading…
    </div>
  );
}

function Err({ msg }: { msg: string }) {
  return (
    <div className="rounded-md border border-[color-mix(in_oklch,var(--color-danger)_40%,transparent)] bg-[color-mix(in_oklch,var(--color-danger)_12%,transparent)] px-3 py-2 text-sm text-[var(--color-danger)]">
      {msg}
    </div>
  );
}

// -------------------- Analytics --------------------

function AnalyticsTab() {
  const { data, err, loading } = useAsync<AdminAnalytics>(() => adminAnalytics(), []);
  if (loading) return <Loading />;
  if (err) return <Err msg={err} />;
  if (!data) return null;
  return (
    <div className="grid grid-cols-2 gap-3">
      <Card>
        <div className="text-xs uppercase tracking-wider text-fg-subtle">Total users</div>
        <div className="mt-1 text-2xl font-extrabold">{data.total_users}</div>
      </Card>
      <Card>
        <div className="text-xs uppercase tracking-wider text-fg-subtle">Active subs</div>
        <div className="mt-1 text-2xl font-extrabold">{data.active_subscriptions}</div>
      </Card>
      <div className="col-span-2 rounded-2xl border border-default bg-surface p-4">
        <div className="text-sm font-semibold">Tokens spent by agent (last 500)</div>
        <div className="mt-2 space-y-1 text-sm">
          {Object.entries(data.recent_tokens_spent_by_agent).length === 0 && (
            <div className="text-fg-subtle">no activity yet</div>
          )}
          {Object.entries(data.recent_tokens_spent_by_agent).map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span>{k}</span>
              <span className="font-mono">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// -------------------- Products --------------------

function ProductsTab() {
  const { data, err, loading, reload } = useAsync<{ products: AdminProduct[] }>(
    () => adminListProducts(),
    []
  );
  const [editing, setEditing] = useState<string | null>(null);
  const [priceId, setPriceId] = useState("");
  const [saving, setSaving] = useState(false);

  if (loading) return <Loading />;
  if (err) return <Err msg={err} />;

  async function save(code: string) {
    setSaving(true);
    try {
      await adminUpdateProduct(code, { stripe_price_id: priceId });
      setEditing(null);
      setPriceId("");
      await reload();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {data?.products.map((p) => (
        <Card key={p.code}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">{p.name}</div>
              <div className="text-[11px] text-fg-subtle">
                {p.code} · {p.monthly_tokens} tokens · {p.interval}
              </div>
            </div>
            <div className="text-lg font-extrabold">
              ${(p.price_cents / 100).toFixed(2)}
            </div>
          </div>
          <div className="mt-3 text-xs">
            <div className="text-fg-subtle">Stripe Price ID</div>
            {editing === p.code ? (
              <div className="mt-1 flex gap-2">
                <input
                  value={priceId}
                  onChange={(e) => setPriceId(e.target.value)}
                  placeholder="price_..."
                  className="flex-1 rounded-md bg-surface-2 px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
                <button
                  onClick={() => save(p.code)}
                  disabled={saving || !priceId}
                  className="rounded-md shine px-3 text-xs font-semibold text-[var(--color-accent-fg)] disabled:opacity-60"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditing(null)}
                  className="rounded-md bg-surface-2 px-3 text-xs"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-surface-2 px-2 py-1 font-mono">
                  {p.stripe_price_id || "—"}
                </code>
                <button
                  onClick={() => {
                    setEditing(p.code);
                    setPriceId(p.stripe_price_id || "");
                  }}
                  className="rounded-md bg-surface-2 px-3 py-1 text-xs"
                >
                  Edit
                </button>
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

// -------------------- Users --------------------

function UsersTab() {
  const [q, setQ] = useState("");
  const { data, err, loading, reload } = useAsync<{ users: AdminUser[] }>(
    () => adminListUsers(q),
    [q]
  );

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="search email…"
        className="mb-3 w-full rounded-md border border-default bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
      />
      {loading && <Loading />}
      {err && <Err msg={err} />}
      <div className="overflow-hidden rounded-2xl border border-default">
        <table className="w-full text-xs">
          <thead className="bg-surface-2 text-left text-fg-subtle">
            <tr>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Tier</th>
              <th className="px-3 py-2 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {data?.users.map((u) => (
              <tr key={u.id} className="border-t border-subtle bg-surface">
                <td className="px-3 py-2 font-medium">{u.email}</td>
                <td className="px-3 py-2">{u.role}</td>
                <td className="px-3 py-2">{u.tier}</td>
                <td className="px-3 py-2 text-fg-subtle">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// -------------------- Ledger --------------------

function LedgerTab() {
  const { data, err, loading } = useAsync<{ ledger: LedgerEntry[] }>(
    () => adminListLedger(),
    []
  );
  if (loading) return <Loading />;
  if (err) return <Err msg={err} />;
  return (
    <div className="overflow-hidden rounded-2xl border border-default">
      <table className="w-full text-xs">
        <thead className="bg-surface-2 text-left text-fg-subtle">
          <tr>
            <th className="px-3 py-2 font-medium">When</th>
            <th className="px-3 py-2 font-medium">User</th>
            <th className="px-3 py-2 font-medium">Δ</th>
            <th className="px-3 py-2 font-medium">Reason</th>
            <th className="px-3 py-2 font-medium">Agent</th>
          </tr>
        </thead>
        <tbody>
          {data?.ledger.map((l) => (
            <tr key={l.id} className="border-t border-subtle bg-surface">
              <td className="px-3 py-2 text-fg-subtle">
                {new Date(l.created_at).toLocaleString()}
              </td>
              <td className="px-3 py-2 font-mono truncate max-w-[140px]">{l.user_id.slice(0, 8)}…</td>
              <td className={cn("px-3 py-2 font-semibold", l.delta < 0 ? "text-[var(--color-danger)]" : "text-accent")}>
                {l.delta > 0 ? `+${l.delta}` : l.delta}
              </td>
              <td className="px-3 py-2">{l.reason}</td>
              <td className="px-3 py-2 text-fg-muted">{l.agent_code || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
