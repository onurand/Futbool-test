"use client";

import { useI18n } from "@/lib/i18n/context";
import { cn } from "@/lib/cn";

export function LangToggle() {
  const { lang, setLang } = useI18n();
  return (
    <div className="flex items-center gap-1 rounded-full border border-default p-0.5 text-[11px] font-medium">
      <button
        onClick={() => setLang("tr")}
        className={cn(
          "rounded-full px-2.5 py-1",
          lang === "tr" ? "bg-surface-2 text-fg" : "text-fg-muted"
        )}
      >
        TR
      </button>
      <button
        onClick={() => setLang("en")}
        className={cn(
          "rounded-full px-2.5 py-1",
          lang === "en" ? "bg-surface-2 text-fg" : "text-fg-muted"
        )}
      >
        EN
      </button>
    </div>
  );
}
