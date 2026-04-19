"""Mock football data provider. Stands in for Sportmonks/football-data.org
until API keys are live. Returns plausible-looking data for a single demo
fixture so the end-to-end tool-use loop can be exercised.

The mock keeps the anti-hallucination contract: when asked about anything
outside the seeded fixture, it returns data_missing=True.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

DEMO_FIXTURE = {
    "id": "demo-mun-lee",
    "competition": "Premier League",
    "season": "2025/26",
    "kickoff_utc": (datetime.now(UTC) + timedelta(hours=4)).isoformat(),
    "home_team": {"id": "mun", "name": "Manchester United", "short_name": "MUN"},
    "away_team": {"id": "lee", "name": "Leeds United", "short_name": "LEE"},
    "venue": "Old Trafford",
    "status": "scheduled",
    "referee": "Michael Oliver",
}


def _is_mun_vs_lee(a: str, b: str) -> bool:
    a_l, b_l = a.lower(), b.lower()
    mu = ("manu", "man utd", "manchester united", "united", "mun")
    ld = ("leeds", "leeds united", "lee")
    return (any(x in a_l for x in mu) and any(x in b_l for x in ld)) or (
        any(x in b_l for x in mu) and any(x in a_l for x in ld)
    )


async def resolve_match_query(
    team_query_1: str,
    team_query_2: str,
    competition_scope: list[str] | None = None,
    date_hint: str | None = None,
) -> dict:
    if _is_mun_vs_lee(team_query_1, team_query_2):
        return {
            "fixture_id": DEMO_FIXTURE["id"],
            "competition": DEMO_FIXTURE["competition"],
            "home_team": DEMO_FIXTURE["home_team"],
            "away_team": DEMO_FIXTURE["away_team"],
            "kickoff_utc": DEMO_FIXTURE["kickoff_utc"],
            "source": "mock",
        }
    return {
        "data_missing": True,
        "reason": f"mock provider has only the demo MUN-LEE fixture; got '{team_query_1}' vs '{team_query_2}'",
    }


async def get_fixture_context(fixture_id: str) -> dict:
    if fixture_id != DEMO_FIXTURE["id"]:
        return {"data_missing": True, "reason": f"unknown fixture_id: {fixture_id}"}
    return {**DEMO_FIXTURE, "source": "mock"}


async def get_team_form(team_ids: list[str], lookback_matches: int = 5) -> dict:
    forms = {
        "mun": {
            "team_id": "mun",
            "name": "Manchester United",
            "last_n": lookback_matches,
            "record": {"W": 3, "D": 1, "L": 1},
            "home": {"W": 2, "D": 0, "L": 0},
            "away": {"W": 1, "D": 1, "L": 1},
            "goals_for_avg": 1.8,
            "goals_against_avg": 1.2,
            "xg_for": 9.1,
            "xg_against": 6.4,
        },
        "lee": {
            "team_id": "lee",
            "name": "Leeds United",
            "last_n": lookback_matches,
            "record": {"W": 2, "D": 1, "L": 2},
            "home": {"W": 2, "D": 0, "L": 1},
            "away": {"W": 0, "D": 1, "L": 1},
            "goals_for_avg": 1.4,
            "goals_against_avg": 1.6,
            "xg_for": 7.2,
            "xg_against": 7.8,
        },
    }
    out = {tid: forms[tid] for tid in team_ids if tid in forms}
    missing = [tid for tid in team_ids if tid not in forms]
    if missing:
        return {"data_missing": True, "reason": f"no mock form for team_ids: {missing}"}
    return {"teams": out, "source": "mock"}


async def get_player_availability(fixture_id: str) -> dict:
    if fixture_id != DEMO_FIXTURE["id"]:
        return {"data_missing": True, "reason": f"unknown fixture_id: {fixture_id}"}
    return {
        "fixture_id": fixture_id,
        "home_team": {
            "team_id": "mun",
            "out": [{"name": "Lisandro Martinez", "reason": "injury"}],
            "doubtful": [{"name": "Luke Shaw", "reason": "fitness"}],
            "suspended": [],
        },
        "away_team": {
            "team_id": "lee",
            "out": [],
            "doubtful": [{"name": "Patrick Bamford", "reason": "knock"}],
            "suspended": [],
        },
        "source": "mock",
    }
