"""Public matches endpoints.

- GET /v1/matches            — today's fixtures (list)
- GET /v1/matches/{id}       — single fixture context
- GET /v1/matches/{id}/odds  — market consensus for h2h

These don't require auth so the marketing/landing page can show live
fixtures to anonymous visitors.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from mcp_servers.football_core import server as football_srv
from mcp_servers.odds_intel import server as odds_srv

router = APIRouter(prefix="/v1/matches", tags=["matches"])


@router.get("")
async def list_matches() -> dict:
    return await football_srv.list_today_fixtures()


@router.get("/{fixture_id}")
async def get_match(fixture_id: str) -> dict:
    ctx = await football_srv.get_fixture_context(fixture_id)
    if ctx.get("data_missing"):
        raise HTTPException(status.HTTP_404_NOT_FOUND, ctx.get("reason", "fixture not found"))
    return ctx


@router.get("/{fixture_id}/odds")
async def get_match_odds(fixture_id: str) -> dict:
    return await odds_srv.get_market_odds_consensus(fixture_id, "h2h")
