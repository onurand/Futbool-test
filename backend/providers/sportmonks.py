"""Sportmonks live client.

Wraps the Sportmonks Football API. Only the endpoints John actually needs are
implemented. Falls back to data_missing=True on any HTTP or parse error so the
anti-hallucination contract is preserved.

Docs: https://docs.sportmonks.com/football/
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential_jitter

from backend.core.config import get_settings

BASE = "https://api.sportmonks.com/v3/football"


def _missing(reason: str) -> dict:
    return {"data_missing": True, "reason": reason}


def _client() -> httpx.AsyncClient:
    s = get_settings()
    if not s.sportmonks_api_key:
        raise RuntimeError("SPORTMONKS_API_KEY not configured")
    return httpx.AsyncClient(
        base_url=BASE,
        timeout=15.0,
        params={"api_token": s.sportmonks_api_key},
    )


@retry(stop=stop_after_attempt(3), wait=wait_exponential_jitter(initial=0.5, max=4))
async def _get(path: str, **params: Any) -> dict:
    async with _client() as client:
        r = await client.get(path, params=params)
        r.raise_for_status()
        return r.json()


async def resolve_match_query(
    team_query_1: str,
    team_query_2: str,
    competition_scope: list[str] | None = None,
    date_hint: str | None = None,
) -> dict:
    """Search fixtures in a ±3-day window around the hint for two teams."""
    try:
        today = datetime.now(UTC).date()
        start = (today - timedelta(days=3)).isoformat()
        end = (today + timedelta(days=3)).isoformat()
        data = await _get(
            f"/fixtures/between/{start}/{end}",
            include="participants;league",
            per_page=50,
        )
        for fx in data.get("data", []):
            participants = [p["name"].lower() for p in fx.get("participants", [])]
            if any(team_query_1.lower() in p for p in participants) and any(
                team_query_2.lower() in p for p in participants
            ):
                home = next(p for p in fx["participants"] if p["meta"]["location"] == "home")
                away = next(p for p in fx["participants"] if p["meta"]["location"] == "away")
                return {
                    "fixture_id": str(fx["id"]),
                    "competition": fx.get("league", {}).get("name"),
                    "home_team": {"id": str(home["id"]), "name": home["name"], "short_name": home.get("short_code")},
                    "away_team": {"id": str(away["id"]), "name": away["name"], "short_name": away.get("short_code")},
                    "kickoff_utc": fx.get("starting_at"),
                    "source": "sportmonks",
                }
        return _missing(f"no Sportmonks fixture matched '{team_query_1}' vs '{team_query_2}'")
    except Exception as e:
        return _missing(f"sportmonks error: {e}")


async def get_fixture_context(fixture_id: str) -> dict:
    try:
        data = await _get(
            f"/fixtures/{fixture_id}",
            include="participants;league;venue;referees",
        )
        fx = data.get("data") or {}
        if not fx:
            return _missing(f"no fixture {fixture_id}")
        home = next((p for p in fx.get("participants", []) if p["meta"]["location"] == "home"), None)
        away = next((p for p in fx.get("participants", []) if p["meta"]["location"] == "away"), None)
        return {
            "id": str(fx.get("id")),
            "competition": fx.get("league", {}).get("name"),
            "kickoff_utc": fx.get("starting_at"),
            "venue": (fx.get("venue") or {}).get("name"),
            "referee": next(
                (r.get("name") for r in fx.get("referees", []) if r.get("type_id") == 6), None
            ),
            "home_team": home and {"id": str(home["id"]), "name": home["name"]},
            "away_team": away and {"id": str(away["id"]), "name": away["name"]},
            "status": fx.get("state", {}).get("name"),
            "source": "sportmonks",
        }
    except Exception as e:
        return _missing(f"sportmonks error: {e}")


async def get_team_form(team_ids: list[str], lookback_matches: int = 5) -> dict:
    try:
        async def _one(tid: str) -> dict:
            data = await _get(
                f"/fixtures/by-team/{tid}",
                per_page=lookback_matches,
                order="desc",
                include="participants",
            )
            wins = draws = losses = goals_for = goals_against = 0
            for fx in data.get("data", []):
                scores = fx.get("scores", []) or []
                home_g = next((s["score"]["goals"] for s in scores if s.get("score", {}).get("participant") == "home" and s.get("description") == "CURRENT"), None)
                away_g = next((s["score"]["goals"] for s in scores if s.get("score", {}).get("participant") == "away" and s.get("description") == "CURRENT"), None)
                if home_g is None or away_g is None:
                    continue
                is_home = any(p["meta"]["location"] == "home" and str(p["id"]) == tid for p in fx.get("participants", []))
                our, theirs = (home_g, away_g) if is_home else (away_g, home_g)
                goals_for += our
                goals_against += theirs
                if our > theirs:   wins += 1
                elif our == theirs: draws += 1
                else:              losses += 1
            played = wins + draws + losses
            return {
                "team_id": tid,
                "last_n": played,
                "record": {"W": wins, "D": draws, "L": losses},
                "goals_for_avg": round(goals_for / played, 2) if played else None,
                "goals_against_avg": round(goals_against / played, 2) if played else None,
            }

        results = await asyncio.gather(*[_one(t) for t in team_ids])
        return {"teams": {r["team_id"]: r for r in results}, "source": "sportmonks"}
    except Exception as e:
        return _missing(f"sportmonks error: {e}")


async def get_player_availability(fixture_id: str) -> dict:
    try:
        data = await _get(
            f"/fixtures/{fixture_id}",
            include="sidelined.player;participants",
        )
        fx = data.get("data") or {}
        out_by_team: dict[str, list[dict]] = {}
        for s in fx.get("sidelined", []) or []:
            team_id = str(s.get("team_id"))
            out_by_team.setdefault(team_id, []).append(
                {
                    "name": s.get("player", {}).get("display_name"),
                    "category": s.get("category"),
                    "reason": s.get("type", {}).get("name"),
                    "expected_return": s.get("end_date"),
                }
            )
        home = next((p for p in fx.get("participants", []) if p["meta"]["location"] == "home"), None)
        away = next((p for p in fx.get("participants", []) if p["meta"]["location"] == "away"), None)
        return {
            "fixture_id": str(fx.get("id")),
            "home_team": home and {"team_id": str(home["id"]), "out": out_by_team.get(str(home["id"]), [])},
            "away_team": away and {"team_id": str(away["id"]), "out": out_by_team.get(str(away["id"]), [])},
            "source": "sportmonks",
        }
    except Exception as e:
        return _missing(f"sportmonks error: {e}")


async def list_today_fixtures(competition_ids: list[int] | None = None) -> dict:
    """For /v1/matches. Returns today's fixtures (UTC) as a flat list."""
    try:
        today = datetime.now(UTC).date().isoformat()
        params: dict[str, Any] = {
            "include": "participants;league",
            "per_page": 100,
        }
        if competition_ids:
            params["filters"] = f"fixtureLeagues:{','.join(map(str, competition_ids))}"
        data = await _get(f"/fixtures/date/{today}", **params)
        fixtures = []
        for fx in data.get("data", []):
            home = next((p for p in fx.get("participants", []) if p["meta"]["location"] == "home"), None)
            away = next((p for p in fx.get("participants", []) if p["meta"]["location"] == "away"), None)
            if not home or not away:
                continue
            fixtures.append(
                {
                    "id": str(fx["id"]),
                    "league": fx.get("league", {}).get("name"),
                    "league_short": fx.get("league", {}).get("short_code"),
                    "kickoff_utc": fx.get("starting_at"),
                    "status": fx.get("state", {}).get("short_name", "scheduled"),
                    "home": {"id": str(home["id"]), "name": home["name"], "short": home.get("short_code")},
                    "away": {"id": str(away["id"]), "name": away["name"], "short": away.get("short_code")},
                }
            )
        return {"fixtures": fixtures, "source": "sportmonks"}
    except Exception as e:
        return _missing(f"sportmonks error: {e}")
