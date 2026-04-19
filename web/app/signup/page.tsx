"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabaseBrowser } from "@/lib/supabase";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    const supa = supabaseBrowser();
    const { data, error } = await supa.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data.session) {
      router.push("/chat");
    } else {
      setInfo("Check your inbox to confirm your email, then log in.");
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center justify-center px-6">
      <Card className="w-full">
        <CardTitle>Create an account</CardTitle>
        <CardDescription>Free tier gets 20 tokens per month.</CardDescription>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-fg-muted">Email</label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-fg-muted">Password</label>
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
          {info && (
            <p className="rounded-md border border-[color-mix(in_oklch,var(--color-accent)_40%,transparent)] bg-[color-mix(in_oklch,var(--color-accent)_15%,transparent)] px-3 py-2 text-sm text-accent">
              {info}
            </p>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Sign up
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-fg-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Log in
          </Link>
        </p>
      </Card>
    </main>
  );
}
