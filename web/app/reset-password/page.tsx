"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabaseBrowser } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n/context";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supa = supabaseBrowser();
    const { error } = await supa.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/"), 1200);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center justify-center px-4 pb-24">
      <Card className="w-full">
        <CardTitle>{t("set_new_password")}</CardTitle>
        <CardDescription>{t("reset_password")}</CardDescription>

        {done ? (
          <p className="mt-5 rounded-md border border-[color-mix(in_oklch,var(--color-accent)_40%,transparent)] bg-[color-mix(in_oklch,var(--color-accent)_15%,transparent)] px-3 py-2 text-sm text-accent">
            {t("password_updated")}
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-fg-muted">{t("password")}</label>
              <Input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="at least 8 characters"
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
      </Card>
    </main>
  );
}
