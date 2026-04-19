"""football-data.org fallback client.

Free tier coverage includes Premier League (2021) and Championship (2016)
— used when Sportmonks returns data_missing or is not configured.
Docs: https://www.football-data.org/documentation/api
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential_jitter

from backend.core.config import get_settings

BASE = "https://api.football-data.org/v4"


def _missing(reason: str) -> dict:
    return {"data_missing": True, "reason": reason}


@retry(stop=stop_after_attempt(3), wait=wait_exponential_jitter(initial=0.5, max=4))
async def _get(path: str, **params: Any) -> Any:
    s = get_settings()
    if not s.football_data_org_key:
        raise RuntimeError("FOOTBALL_DATA_ORG_KEY not configured")
    async with httpx.AsyncClient(
        base_url=BASE,
        timeout=10.0,
        headers={"X-Auth-Token": s.football_data_org_key},
    ) as c:
        r = await c.get(path, params=params)
        r.raise_for_status()
        return r.json()


async def list_today_fixtures() -> dict:
    try:
        today = datetime.now(UTC).date().isoformat()
        data = await _get("/matches", dateFrom=today, dateTo=today, competitions="PL,ELC")
        fixtures = []
        for m in data.get("matches", []):
            fixtures.append(
                {
                    "id": f"fd-{m['id']}",
                    "league": m["competition"]["name"],
                    "league_short": m["competition"].get("code", "")[:3].upper(),
                    "kickoff_utc": m.get("utcDate"),
                    "status": m.get("status", "scheduled").lower(),
                    "home": {
                        "id": f"fd-{m['homeTeam']['id']}",
                        "name": m["homeTeam"]["name"],
                        "short": m["homeTeam"].get("tla") or m["homeTeam"]["shortName"][:3].upper(),
                    },
                    "away": {
                        "id": f"fd-{m['awayTeam']['id']}",
                        "name": m["awayTeam"]["name"],
                        "short": m["awayTeam"].get("tla") or m["awayTeam"]["shortName"][:3].upper(),
                    },
                }
            )
        return {"fixtures": fixtures, "source": "football_data_org"}
    except Exception as e:
        return _missing(f"football-data.org error: {e}")
