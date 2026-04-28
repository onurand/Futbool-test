"""Redis cache helpers. Used for tool-result caching with per-tool TTLs.

Optional. If REDIS_URL is empty or Redis is unreachable, the cache layer
silently no-ops — the backend keeps working, every tool call simply hits
the upstream provider directly.
"""

from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

import redis.asyncio as aioredis

from backend.core.config import get_settings

# Per-tool default TTLs (seconds). Documented in ARCHITECTURE.md.
TTL = {
    "resolve_match_query": 300,
    "get_fixture_context": 1800,
    "get_team_form": 600,
    "get_player_availability": 600,
    "get_market_odds_consensus": 60,
    "get_market_movement": 120,
    "get_prediction_snapshot": 180,
}


@lru_cache
def redis_client() -> aioredis.Redis | None:
    url = get_settings().redis_url
    if not url:
        return None
    try:
        return aioredis.from_url(url, decode_responses=True)
    except Exception:
        return None


def cache_key(tool_name: str, args: dict[str, Any]) -> str:
    payload = json.dumps(args, sort_keys=True, default=str)
    return f"tool:{tool_name}:{payload}"


async def cache_get(key: str) -> Any | None:
    client = redis_client()
    if client is None:
        return None
    try:
        raw = await client.get(key)
    except Exception:
        return None
    return json.loads(raw) if raw else None


async def cache_set(key: str, value: Any, ttl: int) -> None:
    client = redis_client()
    if client is None:
        return
    try:
        await client.set(key, json.dumps(value, default=str), ex=ttl)
    except Exception:
        return
