"use client";

import { createBrowserClient } from "@supabase/ssr";

export function supabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      "Supabase env eksik. Önce `scripts/setup-env.ps1` çalıştır, sonra `npm run dev`'i yeniden başlat."
    );
  }
  return createBrowserClient(url, anon);
}
