"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, Play, Square } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { sendVoice, type AgentCode, type VoiceResponse } from "@/lib/api";
import { cn } from "@/lib/cn";

type Status = "idle" | "recording" | "uploading" | "playing" | "error";

export function VoiceButton({ agent }: { agent: AgentCode }) {
  const { t, lang } = useI18n();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState<VoiceResponse | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  async function start() {
    setError(null);
    setReply(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = onStopRecording;
      recorderRef.current = rec;
      rec.start();
      setStatus("recording");
    } catch {
      setStatus("error");
      setError(t("voice_no_mic"));
    }
  }

  function stop() {
    recorderRef.current?.stop();
  }

  async function onStopRecording() {
    stopStream();
    setStatus("uploading");
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    try {
      const res = await sendVoice(agent, blob, lang);
      setReply(res);
      if (res.audio_b64) {
        const audio = new Audio(`data:audio/mpeg;base64,${res.audio_b64}`);
        audioRef.current = audio;
        audio.onended = () => setStatus("idle");
        setStatus("playing");
        audio.play().catch(() => setStatus("idle"));
      } else {
        setStatus("idle");
      }
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "voice failed");
    }
  }

  function replay() {
    audioRef.current?.play().catch(() => {});
    setStatus("playing");
    if (audioRef.current) {
      audioRef.current.onended = () => setStatus("idle");
    }
  }

  const busy = status === "uploading";

  return (
    <div className="rounded-2xl border border-default bg-surface p-3">
      <div className="flex items-center gap-3">
        <button
          onMouseDown={start}
          onMouseUp={stop}
          onMouseLeave={status === "recording" ? stop : undefined}
          onTouchStart={(e) => { e.preventDefault(); start(); }}
          onTouchEnd={(e) => { e.preventDefault(); stop(); }}
          disabled={busy || status === "playing"}
          className={cn(
            "relative inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition",
            status === "recording"
              ? "bg-live text-white"
              : "shine text-[var(--color-accent-fg)]",
            (busy || status === "playing") && "opacity-60"
          )}
          aria-label={t("voice_hold")}
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> :
           status === "recording" ? <Square className="h-5 w-5" /> :
           <Mic className="h-5 w-5" />}
          {status === "recording" && (
            <span className="absolute -inset-1 animate-ping rounded-full border border-live/60" />
          )}
        </button>

        <div className="flex-1 text-xs">
          <div className="font-medium text-fg">
            {status === "recording" ? t("voice_recording") :
             busy                   ? t("voice_thinking") :
             status === "playing"   ? "▶" :
             t("voice_hold")}
          </div>
          <div className="text-[10px] text-fg-subtle">{t("voice_cost")}</div>
        </div>

        {reply?.audio_b64 && status !== "playing" && (
          <button
            onClick={replay}
            className="inline-flex h-9 items-center gap-1 rounded-md bg-surface-2 px-3 text-xs font-medium"
          >
            <Play className="h-3.5 w-3.5" />
            {t("voice_replay")}
          </button>
        )}
      </div>

      {error && (
        <div className="mt-2 rounded-md border border-[color-mix(in_oklch,var(--color-danger)_40%,transparent)] bg-[color-mix(in_oklch,var(--color-danger)_12%,transparent)] px-3 py-2 text-xs text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {reply?.transcript && (
        <div className="mt-3 rounded-lg bg-surface-2 p-3 text-[13px]">
          <div className="text-[10px] uppercase tracking-wider text-fg-subtle">
            {agent}
          </div>
          <div className="mt-0.5 text-fg-muted italic">"{reply.transcript}"</div>
          {reply.text && (
            <div className="mt-2 whitespace-pre-wrap border-t border-subtle pt-2 text-fg">
              {reply.text}
            </div>
          )}
          <div className="mt-2 text-[10px] text-fg-subtle">
            −{reply.tokens_charged} · {reply.tokens_balance} left
          </div>
        </div>
      )}
    </div>
  );
}
