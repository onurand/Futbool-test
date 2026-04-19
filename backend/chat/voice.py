"""Voice chat endpoint.

Accepts an audio clip (multipart/form-data), runs Whisper STT, feeds the
transcript into the normal Claude tool-use loop, synthesises John's reply
with ElevenLabs, and returns:

{
  "transcript": "…",
  "text":       "…",   # model reply, same shape as /v1/chat
  "audio_b64":  "…",   # base64-encoded MP3 (or null if TTS unavailable)
  "tool_calls": [...],
  "tokens_charged": 3,
  "tokens_balance": 497
}

Billed as VOICE_ROUND_TRIP (3 tokens) regardless of chat mode. Falls back
gracefully when OpenAI or ElevenLabs keys are missing: the text path still
works, audio simply isn't returned.
"""

from __future__ import annotations

import base64
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel

from agents.registry import REGISTRY, get_agent
from backend.auth.middleware import AuthUser, current_user
from backend.billing.tokens import (
    COSTS,
    SpendReason,
    ensure_balance_row,
    require_spend,
    user_can_access_agent,
)
from backend.chat.claude_client import run_agent
from backend.providers import elevenlabs, whisper

router = APIRouter(prefix="/v1/chat", tags=["chat"])


class VoiceResponse(BaseModel):
    transcript: str
    text: str
    tool_calls: list[dict]
    audio_b64: str | None
    tokens_charged: int
    tokens_balance: int


@router.post("/voice", response_model=VoiceResponse)
async def chat_voice(
    user: Annotated[AuthUser, Depends(current_user)],
    audio: UploadFile = File(...),
    agent_code: str = Form(default="john"),
    language: str | None = Form(default=None),
) -> VoiceResponse:
    if agent_code not in REGISTRY:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"unknown agent: {agent_code}")
    agent = get_agent(agent_code)
    if agent.status != "active":
        raise HTTPException(status.HTTP_409_CONFLICT, f"agent '{agent.code}' not active yet")

    ensure_balance_row(user.user_id)
    if not user_can_access_agent(user.user_id, agent.required_packages):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail={
                "code": "agent_locked",
                "agent": agent.code,
                "required_packages": list(agent.required_packages),
            },
        )

    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "empty audio")

    # 1) STT
    stt = await whisper.transcribe(
        audio_bytes, mime=audio.content_type or "audio/webm", language=language
    )
    if stt.get("data_missing") or not stt.get("text"):
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            f"speech-to-text failed: {stt.get('reason', 'no transcript')}",
        )
    transcript: str = stt["text"]

    # 2) Debit once the transcription is usable.
    new_balance = require_spend(
        user.user_id, SpendReason.VOICE_ROUND_TRIP, agent_code=agent.code
    )

    # 3) Claude tool-use loop
    reply = await run_agent(agent, transcript)

    # 4) TTS (best-effort). Missing keys → audio_b64 null, not an error.
    audio_mp3 = await elevenlabs.synthesize(agent.code, reply.text)
    audio_b64 = base64.b64encode(audio_mp3).decode("ascii") if audio_mp3 else None

    return VoiceResponse(
        transcript=transcript,
        text=reply.text,
        tool_calls=[
            {"name": tc.name, "args": tc.args, "result": tc.result}
            for tc in reply.tool_calls
        ],
        audio_b64=audio_b64,
        tokens_charged=COSTS[SpendReason.VOICE_ROUND_TRIP],
        tokens_balance=new_balance,
    )
