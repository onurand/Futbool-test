"""odds-intel MCP server.

Uses the live The Odds API client when configured; otherwise mock.
"""

from __future__ import annotations

from backend.core.config import get_settings
from backend.providers import mock_odds, the_odds_api


async def get_market_odds_consensus(
    fixture_id: str,
    market: str,
    bookmaker_filter: list[str] | None = None,
) -> dict:
    s = get_settings()
    if s.use_mock_providers or not s.the_odds_api_key:
        return await mock_odds.get_market_odds_consensus(fixture_id, market, bookmaker_filter)
    return await the_odds_api.get_market_odds_consensus(fixture_id, market, bookmaker_filter)


async def get_market_movement(fixture_id: str, market: str) -> dict:
    s = get_settings()
    if s.use_mock_providers or not s.the_odds_api_key:
        return await mock_odds.get_market_movement(fixture_id, market)
    return await the_odds_api.get_market_movement(fixture_id, market)
