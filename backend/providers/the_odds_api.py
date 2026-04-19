"""The Odds API live client.

Docs: https://the-odds-api.com/liveapi/guides/v4/
Supports h2h (1X2) market for football. Returns vig-clean fair probabilities
averaged across bookmakers.
"""

from __future__ import annotations

from datetime import UTC, datetime
from statistics import mean, median
from typing import Any

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential_jitter

from backend.core.config import get_settings

BASE = "https://api.the-odds-api.com/v4"
SPORT_KEY_EPL = "soccer_epl"
SPORT_KEY_EFL = "soccer_efl_champ"


def _missing(reason: str) -> dict:
    return {"data_missing": True, "reason": reason}


@retry(stop=stop_after_attempt(3), wait=wait_exponential_jitter(initial=0.5, max=4))
async def _get(path: str, **params: Any) -> Any:
    s = get_settings()
    if not s.the_odds_api_key:
        raise RuntimeError("THE_ODDS_API_KEY not configured")
    async with httpx.AsyncClient(base_url=BASE, timeout=10.0) as c:
        r = await c.get(path, params={"apiKey": s.the_odds_api_key, **params})
        r.raise_for_status()
        return r.json()


async def _find_odds(fixture_id: str, market: str) -> dict | None:
    """fixture_id here is an Odds API event id. Upstream (odds_intel) is
    expected to map Sportmonks → Odds API ids using team-name matching."""
    for sport in (SPORT_KEY_EPL, SPORT_KEY_EFL):
        try:
            events = await _get(
                f"/sports/{sport}/odds",
                regions="uk,eu",
                markets=market,
                oddsFormat="decimal",
            )
        except Exception:
            continue
        for ev in events:
            if ev.get("id") == fixture_id:
                return ev
    return None


async def get_market_odds_consensus(
    fixture_id: str,
    market: str,
    bookmaker_filter: list[str] | None = None,
) -> dict:
    try:
        if market != "h2h":
            return _missing(f"unsupported market '{market}' for live Odds API client")

        ev = await _find_odds(fixture_id, market)
        if not ev:
            return _missing(f"no odds for fixture_id: {fixture_id}")

        home_name = ev["home_team"]
        away_name = ev["away_team"]

        home_quotes, draw_quotes, away_quotes = [], [], []
        fair_probs: list[tuple[float, float, float]] = []
        used = 0

        for bk in ev.get("bookmakers", []):
            if bookmaker_filter and bk["key"] not in bookmaker_filter:
                continue
            h = next((m for m in bk.get("markets", []) if m["key"] == "h2h"), None)
            if not h:
                continue
            outcomes = {o["name"]: o["price"] for o in h.get("outcomes", [])}
            bh = outcomes.get(home_name)
            ba = outcomes.get(away_name)
            bd = outcomes.get("Draw")
            if not (bh and bd and ba):
                continue
            home_quotes.append(bh); draw_quotes.append(bd); away_quotes.append(ba)
            ph, pd, pa = 1 / bh, 1 / bd, 1 / ba
            s = ph + pd + pa
            fair_probs.append((ph / s, pd / s, pa / s))
            used += 1

        if used == 0:
            return _missing("no bookmaker h2h quotes available")

        return {
            "market": "h2h",
            "bookmakers_used": used,
            "snapshot_time_utc": datetime.now(UTC).isoformat(),
            "home": {
                "mean_odds": round(mean(home_quotes), 2),
                "median_odds": round(median(home_quotes), 2),
                "min_odds": min(home_quotes),
                "max_odds": max(home_quotes),
                "fair_probability": round(mean(p[0] for p in fair_probs), 4),
            },
            "draw": {
                "mean_odds": round(mean(draw_quotes), 2),
                "median_odds": round(median(draw_quotes), 2),
                "min_odds": min(draw_quotes),
                "max_odds": max(draw_quotes),
                "fair_probability": round(mean(p[1] for p in fair_probs), 4),
            },
            "away": {
                "mean_odds": round(mean(away_quotes), 2),
                "median_odds": round(median(away_quotes), 2),
                "min_odds": min(away_quotes),
                "max_odds": max(away_quotes),
                "fair_probability": round(mean(p[2] for p in fair_probs), 4),
            },
            "source": "the_odds_api",
        }
    except Exception as e:
        return _missing(f"odds api error: {e}")


async def get_market_movement(fixture_id: str, market: str) -> dict:
    # The Odds API has a historical endpoint on paid tiers; Phase 4 work.
    return _missing("market movement not yet implemented for live Odds API")
