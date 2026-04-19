import { cn } from "@/lib/cn";

const SECTIONS: { key: string; label: string }[] = [
  { key: "Direct view", label: "Direct view" },
  { key: "Market read", label: "Market read" },
  { key: "Why the market leans this way", label: "Why the market leans this way" },
  { key: "My angle", label: "My angle" },
  { key: "If there is a surprise", label: "If there is a surprise" },
  { key: "Confidence", label: "Confidence" },
];

// Parse John's output template into labeled sections. Anything outside the known
// headings falls into "other" and is rendered verbatim — this keeps the renderer
// safe when the model deviates from the format.
function parseSections(text: string) {
  const map = new Map<string, string>();
  const pattern = new RegExp(
    `(${SECTIONS.map((s) => s.key).join("|")}):`,
    "gi"
  );
  const matches = [...text.matchAll(pattern)];
  if (matches.length === 0) return null;
  for (let i = 0; i < matches.length; i++) {
    const start = (matches[i].index ?? 0) + matches[i][0].length;
    const end = matches[i + 1]?.index ?? text.length;
    const key = matches[i][1].toLowerCase();
    map.set(key, text.slice(start, end).trim());
  }
  return map;
}

export function JohnAnswer({ text }: { text: string }) {
  const sections = parseSections(text);
  if (!sections) {
    return <MessageBubble text={text} />;
  }
  return (
    <div className="space-y-4">
      {SECTIONS.map((s) => {
        const v = sections.get(s.key.toLowerCase());
        if (!v) return null;
        const isConfidence = s.key === "Confidence";
        return (
          <div key={s.key}>
            <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-fg-subtle">
              {s.label}
            </div>
            <div
              className={cn(
                "text-[15px] leading-relaxed text-fg",
                isConfidence && "font-mono text-accent"
              )}
            >
              {isConfidence ? <ConfidenceMeter value={v} /> : v}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ConfidenceMeter({ value }: { value: string }) {
  const n = Number((value.match(/\d+/) || [])[0]);
  if (!Number.isFinite(n) || n <= 0) return <span>{value}</span>;
  const pct = Math.min(10, n) * 10;
  return (
    <div className="flex items-center gap-3">
      <span className="min-w-[3ch] font-mono text-lg font-medium text-accent">
        {n}/10
      </span>
      <div className="h-1.5 w-48 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-[var(--color-accent)]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function MessageBubble({ text }: { text: string }) {
  return (
    <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-fg">
      {text}
    </div>
  );
}
