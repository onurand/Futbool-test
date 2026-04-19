"""odds-intel MCP server entry point. Phase 0 stub."""

from __future__ import annotations


def missing(reason: str) -> dict:
    return {"data_missing": True, "reason": reason}


async def get_market_odds_consensus(
    fixture_id: str,
    market: str,
    bookmaker_filter: list[str] | None = None,
) -> dict:
    return missing("odds-intel not yet wired to The Odds API")


async def get_market_movement(fixture_id: str, market: str) -> dict:
    return missing("odds-intel not yet wired to The Odds API")
