"""ElevenLabs text-to-speech client.

Returns raw MP3 bytes. Per-agent voice IDs are read from env; fallbacks are
explicit (no voice_id → data_missing so the caller can skip audio output).
"""

from __future__ import annotations

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential_jitter

from backend.core.config import get_settings

BASE = "https://api.elevenlabs.io/v1"


def _voice_id(agent_code: str) -> str | None:
    s = get_settings()
    mapping = {
        "john":   s.elevenlabs_voice_john,
        "carlos": s.elevenlabs_voice_carlos,
        "hans":   s.elevenlabs_voice_hans,
        "emre":   s.elevenlabs_voice_emre,
    }
    return mapping.get(agent_code) or None


@retry(stop=stop_after_attempt(2), wait=wait_exponential_jitter(initial=0.5, max=3))
async def synthesize(agent_code: str, text: str) -> bytes | None:
    """Return MP3 bytes for the text in the agent's voice, or None if the
    voice / key is not configured."""
    s = get_settings()
    if not s.elevenlabs_api_key:
        return None
    voice = _voice_id(agent_code)
    if not voice:
        return None

    payload = {
        "text": text,
        "model_id": "eleven_turbo_v2_5",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
    }
    try:
        async with httpx.AsyncClient(
            base_url=BASE,
            timeout=30.0,
            headers={
                "xi-api-key": s.elevenlabs_api_key,
                "accept": "audio/mpeg",
            },
        ) as c:
            r = await c.post(f"/text-to-speech/{voice}", json=payload)
            r.raise_for_status()
            return r.content
    except Exception:
        return None
