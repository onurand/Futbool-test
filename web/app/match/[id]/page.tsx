"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { AskJohnBar, JohnTake } from "@/components/john-take";
import { MatchHero } from "@/components/match-hero";
import { ModeToggle, type ChatMode } from "@/components/mode-toggle";
import { OddsPanel } from "@/components/odds-panel";
import { VoiceButton } from "@/components/voice-button";
import { getMatch } from "@/lib/matches";
import { useI18n } from "@/lib/i18n/context";

export default function MatchAnalysisPage() {
  const { t } = useI18n();
  const params = useParams<{ id: string }>();
  const match = getMatch(params.id);
  const [mode, setMode] = useState<ChatMode>("fast");
  if (!match) return notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-4">
      <Link
        href="/"
        className="mb-3 inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>{t("back_to_matches")}</span>
      </Link>

      <MatchHero match={match} />

      <div className="mt-4">
        <OddsPanel match={match} />
      </div>

      <div className="mt-4">
        <ModeToggle mode={mode} onChange={setMode} />
      </div>

      <div className="mt-4">
        <JohnTake />
      </div>

      <div className="mt-4">
        <VoiceButton agent="john" />
      </div>

      <div className="mt-3">
        <AskJohnBar mode={mode} />
      </div>
    </main>
  );
}
