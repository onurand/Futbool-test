"""Redis cache helpers. Used for tool-result caching with per-tool TTLs."""

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
def redis_client() -> aioredis.Redis:
    return aioredis.from_url(get_settings().redis_url, decode_responses=True)


def cache_key(tool_name: str, args: dict[str, Any]) -> str:
    payload = json.dumps(args, sort_keys=True, default=str)
    return f"tool:{tool_name}:{payload}"


async def cache_get(key: str) -> Any | None:
    raw = await redis_client().get(key)
    return json.loads(raw) if raw else None


async def cache_set(key: str, value: Any, ttl: int) -> None:
    await redis_client().set(key, json.dumps(value, default=str), ex=ttl)
