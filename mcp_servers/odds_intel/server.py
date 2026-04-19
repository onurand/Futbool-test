"""odds-intel MCP server entry point.

Phase 1: handlers delegate to mock providers. Swap in live The Odds API client later.
"""

from __future__ import annotations

from backend.core.config import get_settings
from backend.providers import mock_odds


async def get_market_odds_consensus(
    fixture_id: str,
    market: str,
    bookmaker_filter: list[str] | None = None,
) -> dict:
    if get_settings().use_mock_providers:
        return await mock_odds.get_market_odds_consensus(fixture_id, market, bookmaker_filter)
    return {"data_missing": True, "reason": "live Odds API client not yet implemented"}


async def get_market_movement(fixture_id: str, market: str) -> dict:
    if get_settings().use_mock_providers:
        return await mock_odds.get_market_movement(fixture_id, market)
    return {"data_missing": True, "reason": "live Odds API client not yet implemented"}
