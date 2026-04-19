"""football-core MCP server entry point.

Phase 1: handlers delegate to mock providers (Sportmonks wrapper lands later).
Flip `use_mock_providers` in settings to False once the live client is wired.
"""

from __future__ import annotations

from backend.core.config import get_settings
from backend.providers import mock_football


async def resolve_match_query(
    team_query_1: str,
    team_query_2: str,
    competition_scope: list[str] | None = None,
    date_hint: str | None = None,
) -> dict:
    if get_settings().use_mock_providers:
        return await mock_football.resolve_match_query(
            team_query_1, team_query_2, competition_scope, date_hint
        )
    return {"data_missing": True, "reason": "live Sportmonks client not yet implemented"}


async def get_fixture_context(fixture_id: str) -> dict:
    if get_settings().use_mock_providers:
        return await mock_football.get_fixture_context(fixture_id)
    return {"data_missing": True, "reason": "live Sportmonks client not yet implemented"}


async def get_team_form(team_ids: list[str], lookback_matches: int = 5) -> dict:
    if get_settings().use_mock_providers:
        return await mock_football.get_team_form(team_ids, lookback_matches)
    return {"data_missing": True, "reason": "live Sportmonks client not yet implemented"}


async def get_player_availability(fixture_id: str) -> dict:
    if get_settings().use_mock_providers:
        return await mock_football.get_player_availability(fixture_id)
    return {"data_missing": True, "reason": "live Sportmonks client not yet implemented"}
