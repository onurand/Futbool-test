"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Coins, CreditCard, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { supabaseBrowser } from "@/lib/supabase";

export default function AccountPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    supabaseBrowser()
      .auth.getUser()
      .then(({ data }) => {
        setEmail(data.user?.email ?? null);
        setUid(data.user?.id ?? null);
      });
  }, []);

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    window.location.href = "/";
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <Link
        href="/chat"
        className="mb-8 inline-flex items-center gap-2 text-sm text-fg-muted hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" /> Back to chat
      </Link>

      <h1 className="text-3xl font-semibold tracking-tight">Account</h1>

      <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
        <Card>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your sign-in details.</CardDescription>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-fg-subtle">Email</dt>
              <dd className="font-medium">{email ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-fg-subtle">User ID</dt>
              <dd className="font-mono text-xs text-fg-muted">{uid ?? "—"}</dd>
            </div>
          </dl>
          <Button variant="secondary" className="mt-6 w-full" onClick={signOut}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Subscription</CardTitle>
              <CardDescription>Phase 2 will plug this into Stripe.</CardDescription>
            </div>
            <Badge tone="muted">free</Badge>
          </div>
          <div className="mt-5 rounded-lg border border-subtle bg-surface-2 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-fg-muted">
                <Coins className="h-4 w-4 text-accent" /> Tokens this month
              </span>
              <span className="font-mono text-fg">20 / 20</span>
            </div>
          </div>
          <Link href="/pricing" className="mt-4 block">
            <Button className="w-full">
              <CreditCard className="h-4 w-4" /> See plans
            </Button>
          </Link>
        </Card>
      </div>
    </main>
  );
}
