"""Whisper speech-to-text client (OpenAI).

Accepts a raw audio blob (webm/ogg/mp3/mp4) and returns the transcribed
text. Follows the same data_missing contract as the other providers so
the voice endpoint can surface failures cleanly.
"""

from __future__ import annotations

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential_jitter

from backend.core.config import get_settings

BASE = "https://api.openai.com/v1"


def _missing(reason: str) -> dict:
    return {"data_missing": True, "reason": reason}


@retry(stop=stop_after_attempt(2), wait=wait_exponential_jitter(initial=0.5, max=3))
async def transcribe(audio: bytes, mime: str = "audio/webm", language: str | None = None) -> dict:
    s = get_settings()
    if not s.openai_api_key:
        return _missing("OPENAI_API_KEY not configured")

    files = {"file": ("clip.webm", audio, mime)}
    data: dict[str, str] = {"model": "whisper-1"}
    if language:
        data["language"] = language

    try:
        async with httpx.AsyncClient(
            base_url=BASE,
            timeout=30.0,
            headers={"Authorization": f"Bearer {s.openai_api_key}"},
        ) as c:
            r = await c.post("/audio/transcriptions", data=data, files=files)
            r.raise_for_status()
            j = r.json()
            return {"text": j.get("text", "").strip(), "source": "whisper"}
    except Exception as e:
        return _missing(f"whisper error: {e}")
