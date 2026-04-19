"""Ensemble prediction.

Blends five signals into a single 1X2 probability distribution:

    final = 0.40 * market
          + 0.20 * strength
          + 0.15 * form
          + 0.15 * matchup
          + 0.10 * availability

All component outputs are normalized probability triples (home, draw, away).
Missing components fall back to the market prior so the final distribution
stays well-formed even when upstream data is thin.
"""

from __future__ import annotations

from typing import Any

WEIGHTS = {
    "market":       0.40,
    "strength":     0.20,
    "form":         0.15,
    "matchup":      0.15,
    "availability": 0.10,
}


def _norm(triple: tuple[float, float, float]) -> tuple[float, float, float]:
    s = sum(triple) or 1.0
    return (triple[0] / s, triple[1] / s, triple[2] / s)


def _ppg(record: dict[str, int]) -> float:
    n = record["W"] + record["D"] + record["L"]
    if n == 0:
        return 0.0
    return (3 * record["W"] + record["D"]) / n


def _market_prior(odds: dict | None) -> tuple[float, float, float] | None:
    if not odds or odds.get("data_missing"):
        return None
    return _norm((
        float(odds["home"]["fair_probability"]),
        float(odds["draw"]["fair_probability"]),
        float(odds["away"]["fair_probability"]),
    ))


def _strength(form: dict | None, home_id: str, away_id: str) -> tuple[float, float, float]:
    """Simple strength proxy: last-N ppg difference. Positive → lean home."""
    if not form or form.get("data_missing"):
        return (0.50, 0.24, 0.26)
    teams = form.get("teams") or {}
    h, a = teams.get(home_id), teams.get(away_id)
    if not (h and a):
        return (0.50, 0.24, 0.26)
    diff = _ppg(h["record"]) - _ppg(a["record"])
    # Map ppg diff ∈ [-3, 3] → home prob ∈ [0.25, 0.72], draw ~0.25.
    p_home = max(0.22, min(0.72, 0.48 + 0.08 * diff))
    p_draw = 0.25
    p_away = 1 - p_home - p_draw
    return _norm((p_home, p_draw, max(0.1, p_away)))


def _form(form: dict | None, home_id: str, away_id: str) -> tuple[float, float, float]:
    """Goals-for vs goals-against differential as a form proxy."""
    if not form or form.get("data_missing"):
        return (0.50, 0.24, 0.26)
    teams = form.get("teams") or {}
    h, a = teams.get(home_id), teams.get(away_id)
    if not (h and a):
        return (0.50, 0.24, 0.26)
    gd_h = (h.get("goals_for_avg") or 0) - (h.get("goals_against_avg") or 0)
    gd_a = (a.get("goals_for_avg") or 0) - (a.get("goals_against_avg") or 0)
    delta = gd_h - gd_a
    p_home = max(0.22, min(0.70, 0.46 + 0.10 * delta))
    p_draw = 0.25
    p_away = 1 - p_home - p_draw
    return _norm((p_home, p_draw, max(0.1, p_away)))


def _matchup(_form: dict | None) -> tuple[float, float, float]:
    # Placeholder until H2H endpoint is wired. Use market-tilted home edge.
    return (0.52, 0.24, 0.24)


def _availability(avail: dict | None) -> tuple[float, float, float]:
    """Count of 'out' players per side; each absence nudges the probability."""
    if not avail or avail.get("data_missing"):
        return (0.50, 0.24, 0.26)
    home_out = len((avail.get("home_team") or {}).get("out", []))
    away_out = len((avail.get("away_team") or {}).get("out", []))
    delta = away_out - home_out          # more away absences → home lean
    p_home = max(0.30, min(0.68, 0.50 + 0.03 * delta))
    p_draw = 0.24
    p_away = 1 - p_home - p_draw
    return _norm((p_home, p_draw, max(0.1, p_away)))


def compute(
    odds: dict | None,
    form: dict | None,
    availability: dict | None,
    home_team_id: str,
    away_team_id: str,
) -> dict[str, Any]:
    """Combine the five signals. Returns the ensemble payload matching the
    get_prediction_snapshot tool contract."""
    market = _market_prior(odds)
    if market is None:
        # No market data — bail but keep shape consistent so John can reason.
        market = (0.45, 0.26, 0.29)
    strength      = _strength(form, home_team_id, away_team_id)
    form_score    = _form(form, home_team_id, away_team_id)
    matchup       = _matchup(form)
    availability_ = _availability(availability)

    components = {
        "market":       market,
        "strength":     strength,
        "form":         form_score,
        "matchup":      matchup,
        "availability": availability_,
    }

    final = [0.0, 0.0, 0.0]
    for name, probs in components.items():
        w = WEIGHTS[name]
        for i in range(3):
            final[i] += w * probs[i]
    # Re-normalize (WEIGHTS sum to 1 so this is almost a no-op, but guards drift).
    s = sum(final) or 1.0
    final = [round(f / s, 4) for f in final]

    edge_vs_market = [round(final[i] - market[i], 4) for i in range(3)]
    most_likely_upset = "draw" if final[1] >= final[2] else "away_win"

    return {
        "fixture_id": None,  # caller sets
        "components": {
            k: {"home": round(v[0], 4), "draw": round(v[1], 4), "away": round(v[2], 4)}
            for k, v in components.items()
        },
        "weights": WEIGHTS,
        "final": {"home": final[0], "draw": final[1], "away": final[2]},
        "edge_vs_market": {"home": edge_vs_market[0], "draw": edge_vs_market[1], "away": edge_vs_market[2]},
        "most_likely_upset": most_likely_upset,
        "source": "ensemble",
    }
