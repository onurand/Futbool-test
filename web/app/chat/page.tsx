"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Cog,
  LogOut,
  Loader2,
  Sparkles,
  Trophy,
  User2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { JohnAnswer, MessageBubble } from "@/components/john-answer";
import { ToolCallBlock } from "@/components/tool-call";
import { cn } from "@/lib/cn";
import { sendChat, type AgentCode, type ChatResponse } from "@/lib/api";
import { supabaseBrowser } from "@/lib/supabase";

type Turn =
  | { role: "user"; text: string }
  | {
      role: "assistant";
      agent: AgentCode;
      text: string;
      tool_calls: ChatResponse["tool_calls"];
      usage: ChatResponse["usage"];
    };

const AGENTS: {
  code: AgentCode;
  name: string;
  tag: string;
  flag: string;
  status: "active" | "planned";
}[] = [
  { code: "john",   name: "John",   tag: "Premier · Championship", flag: "🏴", status: "active" },
  { code: "carlos", name: "Carlos", tag: "La Liga",                flag: "🇪🇸", status: "planned" },
  { code: "hans",   name: "Hans",   tag: "Bundesliga",             flag: "🇩🇪", status: "planned" },
  { code: "emre",   name: "Emre",   tag: "Süper Lig",              flag: "🇹🇷", status: "planned" },
];

const SUGGESTIONS = [
  "Manu - Leeds tonight: market consensus and the most likely surprise?",
  "Is Manchester United's home favourite status justified by form?",
  "Walk me through bookmaker odds for the demo fixture.",
];

export default function ChatPage() {
  const [agent, setAgent] = useState<AgentCode>("john");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supa = supabaseBrowser();
    supa.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, loading]);

  const send = useCallback(
    async (msg: string) => {
      if (!msg.trim() || loading) return;
      setError(null);
      setTurns((t) => [...t, { role: "user", text: msg }]);
      setInput("");
      setLoading(true);
      try {
        const res = await sendChat(agent, msg);
        setTurns((t) => [
          ...t,
          {
            role: "assistant",
            agent,
            text: res.text,
            tool_calls: res.tool_calls,
            usage: res.usage,
          },
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "chat failed");
      } finally {
        setLoading(false);
      }
    },
    [agent, loading]
  );

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    window.location.href = "/";
  }

  return (
    <div className="grid min-h-dvh grid-cols-1 md:grid-cols-[280px_1fr]">
      {/* Sidebar */}
      <aside className="hidden border-r border-subtle bg-surface/60 md:flex md:flex-col">
        <Link href="/" className="flex items-center gap-2 border-b border-subtle px-5 py-4">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-accent)] text-[var(--color-accent-fg)] text-xs font-bold">
            F
          </span>
          <span className="text-sm font-semibold tracking-tight">Futbool</span>
        </Link>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-2 px-2 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
            Agents
          </div>
          <div className="space-y-1">
            {AGENTS.map((a) => {
              const active = a.code === agent;
              const disabled = a.status !== "active";
              return (
                <button
                  key={a.code}
                  disabled={disabled}
                  onClick={() => setAgent(a.code)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors",
                    active && "bg-surface-2 text-fg",
                    !active && !disabled && "text-fg-muted hover:bg-surface-2 hover:text-fg",
                    disabled && "cursor-not-allowed text-fg-subtle"
                  )}
                >
                  <span className="text-base">{a.flag}</span>
                  <span className="flex-1">
                    <div className="flex items-center gap-2">
                      <span>{a.name}</span>
                      {disabled && <Badge tone="muted">soon</Badge>}
                    </div>
                    <div className="text-[11px] text-fg-subtle">{a.tag}</div>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-8 mb-2 px-2 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
            Suggested
          </div>
          <div className="space-y-1">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setInput(s)}
                className="block w-full rounded-md px-2 py-1.5 text-left text-[13px] text-fg-muted hover:bg-surface-2 hover:text-fg"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-subtle p-3">
          <div className="flex items-center gap-2 rounded-md bg-surface-2 px-2 py-2 text-xs text-fg-muted">
            <User2 className="h-3.5 w-3.5" />
            <span className="truncate">{email ?? "signed out"}</span>
          </div>
          <div className="mt-2 flex gap-1">
            <Link href="/account" className="flex-1">
              <Button variant="ghost" size="sm" className="w-full justify-start">
                <Cog className="h-3.5 w-3.5" /> Account
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main chat */}
      <section className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-subtle bg-[color-mix(in_oklch,var(--color-bg)_70%,transparent)] px-6 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <Trophy className="h-4 w-4 text-accent" />
            <span className="text-sm font-medium tracking-tight">
              {AGENTS.find((a) => a.code === agent)?.name}
            </span>
            <Badge tone="muted">
              {AGENTS.find((a) => a.code === agent)?.tag}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="accent">mock mode</Badge>
            <Link href="/pricing">
              <Button variant="secondary" size="sm">
                <Sparkles className="h-3.5 w-3.5" /> Upgrade
              </Button>
            </Link>
          </div>
        </header>

        <div ref={feedRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-6 py-8">
            {turns.length === 0 && <EmptyState onPick={send} />}
            <div className="space-y-8">
              {turns.map((t, i) =>
                t.role === "user" ? (
                  <UserTurn key={i} text={t.text} />
                ) : (
                  <AssistantTurn key={i} turn={t} />
                )
              )}
              {loading && <ThinkingTurn />}
              {error && (
                <div className="rounded-md border border-[color-mix(in_oklch,var(--color-danger)_40%,transparent)] bg-[color-mix(in_oklch,var(--color-danger)_12%,transparent)] px-4 py-3 text-sm text-[var(--color-danger)]">
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="border-t border-subtle bg-[color-mix(in_oklch,var(--color-bg)_70%,transparent)] px-6 py-4 backdrop-blur"
        >
          <div className="mx-auto flex max-w-3xl gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Ask John about tonight's fixture, the market, or the most likely surprise…"
              className="min-h-[56px]"
            />
            <Button type="submit" disabled={loading || !input.trim()} size="lg">
              <ArrowUp className="h-4 w-4" />
            </Button>
          </div>
          <p className="mx-auto mt-2 max-w-3xl text-[11px] text-fg-subtle">
            Enter to send · Shift+Enter for a new line. John will never invent scores or odds.
          </p>
        </form>
      </section>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (s: string) => void }) {
  return (
    <div className="py-20 text-center">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-surface-2 text-accent">
        <Sparkles className="h-5 w-5" />
      </div>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        What match are we reading?
      </h1>
      <p className="mt-2 text-sm text-fg-muted">
        John starts every market question with bookmaker consensus before giving
        you his own angle.
      </p>
      <div className="mx-auto mt-6 grid max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="rounded-lg border border-subtle bg-surface px-4 py-3 text-left text-sm text-fg-muted transition-colors hover:border-default hover:text-fg"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function UserTurn({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-surface-2 px-4 py-3 text-[15px] leading-relaxed text-fg">
        {text}
      </div>
    </div>
  );
}

function AssistantTurn({
  turn,
}: {
  turn: Extract<Turn, { role: "assistant" }>;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-xs text-fg-subtle">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-accent)] text-[10px] font-bold text-[var(--color-accent-fg)]">
          J
        </span>
        <span>{turn.agent}</span>
        <span>·</span>
        <span>
          {turn.usage.input_tokens + turn.usage.output_tokens} model tokens
        </span>
      </div>

      {turn.tool_calls.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {turn.tool_calls.map((tc, i) => (
            <ToolCallBlock key={i} call={tc} />
          ))}
        </div>
      )}

      {turn.agent === "john" ? (
        <JohnAnswer text={turn.text} />
      ) : (
        <MessageBubble text={turn.text} />
      )}
    </div>
  );
}

function ThinkingTurn() {
  return (
    <div className="flex items-center gap-3 text-sm text-fg-subtle">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>John is reading the market…</span>
    </div>
  );
}
