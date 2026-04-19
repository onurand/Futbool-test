"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import type { ToolCall } from "@/lib/api";

export function ToolCallBlock({ call }: { call: ToolCall }) {
  const [open, setOpen] = useState(false);

  const missing = (call.result as { data_missing?: boolean }).data_missing;
  const cacheHit = (call.result as { cache_hit?: boolean }).cache_hit;
  const source = (call.result as { source?: string }).source;

  const preview = useMemo(() => {
    if (missing) return (call.result as { reason?: string }).reason || "data missing";
    const out: string[] = [];
    if (source) out.push(`source: ${source}`);
    if (cacheHit) out.push("cache hit");
    return out.join(" · ") || "ok";
  }, [missing, cacheHit, source, call.result]);

  return (
    <div className="rounded-lg border border-subtle bg-surface-2/60 text-xs">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-fg-subtle" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-fg-subtle" />
        )}
        <Wrench className="h-3.5 w-3.5 text-accent" />
        <span className="font-mono text-[11px] text-fg">{call.name}</span>
        <span
          className={cn(
            "ml-auto font-mono",
            missing ? "text-[var(--color-warning)]" : "text-fg-subtle"
          )}
        >
          {preview}
        </span>
      </button>
      {open && (
        <div className="border-t border-subtle px-3 py-2">
          <div className="mb-2">
            <div className="text-[10px] uppercase tracking-wider text-fg-subtle">
              args
            </div>
            <pre className="mt-1 overflow-x-auto rounded bg-bg p-2 font-mono text-[11px] leading-relaxed text-fg-muted">
              {JSON.stringify(call.args, null, 2)}
            </pre>
          </div>
          <div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-fg-subtle">
              <span>result</span>
              {missing && <Badge tone="warning">data missing</Badge>}
              {cacheHit && <Badge tone="muted">cache</Badge>}
              {source && !missing && <Badge tone="muted">{source}</Badge>}
            </div>
            <pre className="mt-1 overflow-x-auto rounded bg-bg p-2 font-mono text-[11px] leading-relaxed text-fg-muted">
              {JSON.stringify(call.result, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
