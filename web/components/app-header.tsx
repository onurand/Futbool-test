"use client";

import Link from "next/link";
import { LangToggle } from "@/components/lang-toggle";
import { useI18n } from "@/lib/i18n/context";

export function AppHeader() {
  const { t } = useI18n();
  return (
    <header className="sticky top-0 z-40 border-b border-subtle bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg shine text-[var(--color-accent-fg)] text-sm font-extrabold">
            F
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">Futbool</div>
            <div className="text-[10px] text-fg-subtle">{t("app_tagline")}</div>
          </div>
        </Link>
        <LangToggle />
      </div>
    </header>
  );
}
