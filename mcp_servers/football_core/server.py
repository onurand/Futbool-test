"""football-core MCP server.

Uses the live Sportmonks client when use_mock_providers is false. Falls back
to football-data.org if Sportmonks fails and a fallback key is configured.
Otherwise returns the mock payload.
"""

from __future__ import annotations

from backend.core.config import get_settings
from backend.providers import football_data_org, mock_football, sportmonks


def _is_missing(payload: dict) -> bool:
    return bool(payload.get("data_missing"))


async def resolve_match_query(
    team_query_1: str,
    team_query_2: str,
    competition_scope: list[str] | None = None,
    date_hint: str | None = None,
) -> dict:
    s = get_settings()
    if s.use_mock_providers or not s.sportmonks_api_key:
        return await mock_football.resolve_match_query(
            team_query_1, team_query_2, competition_scope, date_hint
        )
    result = await sportmonks.resolve_match_query(
        team_query_1, team_query_2, competition_scope, date_hint
    )
    return result


async def get_fixture_context(fixture_id: str) -> dict:
    s = get_settings()
    if s.use_mock_providers or not s.sportmonks_api_key:
        return await mock_football.get_fixture_context(fixture_id)
    return await sportmonks.get_fixture_context(fixture_id)


async def get_team_form(team_ids: list[str], lookback_matches: int = 5) -> dict:
    s = get_settings()
    if s.use_mock_providers or not s.sportmonks_api_key:
        return await mock_football.get_team_form(team_ids, lookback_matches)
    return await sportmonks.get_team_form(team_ids, lookback_matches)


async def get_player_availability(fixture_id: str) -> dict:
    s = get_settings()
    if s.use_mock_providers or not s.sportmonks_api_key:
        return await mock_football.get_player_availability(fixture_id)
    return await sportmonks.get_player_availability(fixture_id)


async def list_today_fixtures() -> dict:
    """Used by /v1/matches. Tries Sportmonks, then football-data.org, then mock."""
    s = get_settings()
    if not s.use_mock_providers and s.sportmonks_api_key:
        result = await sportmonks.list_today_fixtures()
        if not _is_missing(result):
            return result
    if not s.use_mock_providers and s.football_data_org_key:
        result = await football_data_org.list_today_fixtures()
        if not _is_missing(result):
            return result
    # Mock fallback — serve the demo fixture.
    return {
        "fixtures": [
            {
                "id": mock_football.DEMO_FIXTURE["id"],
                "league": mock_football.DEMO_FIXTURE["competition"],
                "league_short": "PL",
                "kickoff_utc": mock_football.DEMO_FIXTURE["kickoff_utc"],
                "status": mock_football.DEMO_FIXTURE["status"],
                "home": {
                    "id": mock_football.DEMO_FIXTURE["home_team"]["id"],
                    "name": mock_football.DEMO_FIXTURE["home_team"]["name"],
                    "short": mock_football.DEMO_FIXTURE["home_team"]["short_name"],
                },
                "away": {
                    "id": mock_football.DEMO_FIXTURE["away_team"]["id"],
                    "name": mock_football.DEMO_FIXTURE["away_team"]["name"],
                    "short": mock_football.DEMO_FIXTURE["away_team"]["short_name"],
                },
            }
        ],
        "source": "mock",
    }
