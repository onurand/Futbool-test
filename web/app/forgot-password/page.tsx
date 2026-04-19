"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabaseBrowser } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n/context";

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supa = supabaseBrowser();
    const { error } = await supa.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center justify-center px-4 pb-24">
      <Card className="w-full">
        <CardTitle>{t("forgot_password")}</CardTitle>
        <CardDescription>{t("reset_password")}</CardDescription>

        {sent ? (
          <p className="mt-5 rounded-md border border-[color-mix(in_oklch,var(--color-accent)_40%,transparent)] bg-[color-mix(in_oklch,var(--color-accent)_15%,transparent)] px-3 py-2 text-sm text-accent">
            {t("reset_email_sent")}
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-fg-muted">{t("email")}</label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            {error && (
              <p className="rounded-md border border-[color-mix(in_oklch,var(--color-danger)_40%,transparent)] bg-[color-mix(in_oklch,var(--color-danger)_15%,transparent)] px-3 py-2 text-sm text-[var(--color-danger)]">
                {error}
              </p>
            )}
            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("reset_password")}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-fg-muted">
          <Link href="/login" className="text-accent hover:underline">
            {t("log_in")}
          </Link>
        </p>
      </Card>
    </main>
  );
}
