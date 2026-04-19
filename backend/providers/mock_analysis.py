"""Mock ensemble prediction. Stands in for analysis-brain until Phase 4.

Weights reflect the target ensemble:
    final = 0.40*market + 0.20*strength + 0.15*form + 0.15*matchup + 0.10*availability
"""

from __future__ import annotations

from backend.providers.mock_football import DEMO_FIXTURE
from backend.providers.mock_odds import get_market_odds_consensus


async def get_prediction_snapshot(fixture_id: str) -> dict:
    if fixture_id != DEMO_FIXTURE["id"]:
        return {"data_missing": True, "reason": f"no prediction for fixture_id: {fixture_id}"}

    odds = await get_market_odds_consensus(fixture_id, "h2h")
    if odds.get("data_missing"):
        return odds

    market = (
        odds["home"]["fair_probability"],
        odds["draw"]["fair_probability"],
        odds["away"]["fair_probability"],
    )
    # Synthetic sub-model outputs for the MUN-LEE demo.
    strength = (0.57, 0.24, 0.19)
    form = (0.54, 0.25, 0.21)
    matchup = (0.56, 0.24, 0.20)
    availability = (0.55, 0.24, 0.21)

    weights = (0.40, 0.20, 0.15, 0.15, 0.10)
    combined = []
    for i in range(3):
        v = (
            weights[0] * market[i]
            + weights[1] * strength[i]
            + weights[2] * form[i]
            + weights[3] * matchup[i]
            + weights[4] * availability[i]
        )
        combined.append(round(v, 4))

    edge_vs_market = [round(combined[i] - market[i], 4) for i in range(3)]

    return {
        "fixture_id": fixture_id,
        "components": {
            "market_prior": {"home": market[0], "draw": market[1], "away": market[2]},
            "strength":     {"home": strength[0], "draw": strength[1], "away": strength[2]},
            "form":         {"home": form[0], "draw": form[1], "away": form[2]},
            "matchup":      {"home": matchup[0], "draw": matchup[1], "away": matchup[2]},
            "availability": {"home": availability[0], "draw": availability[1], "away": availability[2]},
        },
        "weights": {
            "market": weights[0],
            "strength": weights[1],
            "form": weights[2],
            "matchup": weights[3],
            "availability": weights[4],
        },
        "final": {"home": combined[0], "draw": combined[1], "away": combined[2]},
        "edge_vs_market": {
            "home": edge_vs_market[0],
            "draw": edge_vs_market[1],
            "away": edge_vs_market[2],
        },
        "most_likely_upset": "draw" if combined[1] > combined[2] else "away_win",
        "source": "mock",
    }
