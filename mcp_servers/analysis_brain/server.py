"""analysis-brain MCP server.

Runs the real ensemble by calling upstream football-core and odds-intel
tools for the fixture, then blending the signals. When providers are in
mock mode the same flow still works — producing an identical contract.
"""

from __future__ import annotations

from backend.providers import ensemble
from mcp_servers.football_core import server as football_srv
from mcp_servers.odds_intel import server as odds_srv


async def get_prediction_snapshot(fixture_id: str) -> dict:
    ctx = await football_srv.get_fixture_context(fixture_id)
    if ctx.get("data_missing"):
        return {**ctx, "reason": f"cannot predict without fixture context: {ctx.get('reason')}"}

    home_id = (ctx.get("home_team") or {}).get("id")
    away_id = (ctx.get("away_team") or {}).get("id")
    if not (home_id and away_id):
        return {"data_missing": True, "reason": "fixture context missing team ids"}

    odds = await odds_srv.get_market_odds_consensus(fixture_id, "h2h")
    form = await football_srv.get_team_form([home_id, away_id], lookback_matches=5)
    avail = await football_srv.get_player_availability(fixture_id)

    payload = ensemble.compute(odds, form, avail, home_id, away_id)
    payload["fixture_id"] = fixture_id
    return payload
