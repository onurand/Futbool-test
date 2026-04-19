"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brain, Star, Trophy, User2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { cn } from "@/lib/cn";

export function BottomNav() {
  const { t } = useI18n();
  const pathname = usePathname();

  const items = [
    { href: "/",                    label: t("nav_matches"),  icon: Trophy, match: (p: string) => p === "/" },
    { href: "/match/demo-mun-lee",  label: t("nav_analysis"), icon: Brain,  match: (p: string) => p.startsWith("/match") },
    { href: "/pricing",             label: t("nav_packages"), icon: Star,   match: (p: string) => p.startsWith("/pricing") },
    { href: "/account",             label: t("nav_account"),  icon: User2,  match: (p: string) => p.startsWith("/account") || p.startsWith("/login") || p.startsWith("/signup") },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-default/70 bg-bg/95 backdrop-blur">
      <div
        className="mx-auto flex max-w-2xl items-stretch justify-around px-2 pt-1.5"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)" }}
      >
        {items.map((it) => {
          const active = it.match(pathname);
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href as never}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-1.5",
                active ? "text-accent" : "text-fg-subtle hover:text-fg-muted"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
