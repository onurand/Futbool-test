"""Tool registry + dispatcher for Claude tool use.

Responsibilities:
- Load the JSON schemas once.
- Map tool names to async handlers (in MCP servers).
- Apply per-tool Redis caching.
- Enforce the anti-hallucination contract: handlers that return data_missing=True
  flow straight through to the model so it knows the fact is unavailable.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Awaitable, Callable

from backend.core.cache import TTL, cache_get, cache_key, cache_set
from mcp_servers.analysis_brain import server as analysis_srv
from mcp_servers.football_core import server as football_srv
from mcp_servers.odds_intel import server as odds_srv

REPO_ROOT = Path(__file__).resolve().parents[2]
SCHEMAS_PATH = REPO_ROOT / "tools" / "schemas.json"


def load_tool_schemas() -> list[dict[str, Any]]:
    data = json.loads(SCHEMAS_PATH.read_text(encoding="utf-8"))
    return data["tools"]


ToolHandler = Callable[..., Awaitable[dict[str, Any]]]

HANDLERS: dict[str, ToolHandler] = {
    "resolve_match_query": football_srv.resolve_match_query,
    "get_fixture_context": football_srv.get_fixture_context,
    "get_team_form": football_srv.get_team_form,
    "get_player_availability": football_srv.get_player_availability,
    "get_market_odds_consensus": odds_srv.get_market_odds_consensus,
    "get_prediction_snapshot": analysis_srv.get_prediction_snapshot,
}


async def dispatch(name: str, args: dict[str, Any]) -> dict[str, Any]:
    handler = HANDLERS.get(name)
    if handler is None:
        return {"data_missing": True, "reason": f"unknown tool: {name}"}

    key = cache_key(name, args)
    cached = await cache_get(key)
    if cached is not None:
        return {**cached, "cache_hit": True}

    result = await handler(**args)
    ttl = TTL.get(name, 60)
    await cache_set(key, result, ttl)
    return result
