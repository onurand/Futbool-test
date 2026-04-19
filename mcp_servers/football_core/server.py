"""football-core MCP server entry point. Phase 0 stub."""

from __future__ import annotations


def missing(reason: str) -> dict:
    return {"data_missing": True, "reason": reason}


async def resolve_match_query(team_query_1: str, team_query_2: str, **_) -> dict:
    return missing("football-core not yet wired to Sportmonks")


async def get_fixture_context(fixture_id: str) -> dict:
    return missing("football-core not yet wired to Sportmonks")


async def get_team_form(team_ids: list[str], lookback_matches: int = 5) -> dict:
    return missing("football-core not yet wired to Sportmonks")


async def get_player_availability(fixture_id: str) -> dict:
    return missing("football-core not yet wired to Sportmonks")
