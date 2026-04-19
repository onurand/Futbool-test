"""Mock odds provider. Stands in for The Odds API."""

from __future__ import annotations

from datetime import UTC, datetime
from statistics import mean, median

DEMO_FIXTURE_ID = "demo-mun-lee"


async def get_market_odds_consensus(
    fixture_id: str,
    market: str,
    bookmaker_filter: list[str] | None = None,
) -> dict:
    if fixture_id != DEMO_FIXTURE_ID:
        return {"data_missing": True, "reason": f"no odds for fixture_id: {fixture_id}"}
    if market != "h2h":
        return {"data_missing": True, "reason": f"mock only serves 'h2h', got '{market}'"}

    # Synthetic 1X2 quotes across 12 books.
    books = [
        ("pinnacle", 1.71, 3.90, 5.00),
        ("bet365",   1.72, 3.85, 5.00),
        ("williamhill", 1.73, 3.90, 4.95),
        ("betfair",  1.74, 3.90, 4.90),
        ("unibet",   1.73, 3.85, 5.00),
        ("bwin",     1.75, 3.80, 4.80),
        ("888",      1.73, 3.90, 4.95),
        ("betway",   1.74, 3.85, 5.00),
        ("ladbrokes", 1.72, 3.90, 5.00),
        ("coral",    1.73, 3.90, 4.95),
        ("dafabet",  1.74, 3.85, 5.00),
        ("skybet",   1.72, 3.90, 5.00),
    ]
    if bookmaker_filter:
        books = [b for b in books if b[0] in bookmaker_filter] or books

    h = [b[1] for b in books]
    d = [b[2] for b in books]
    a = [b[3] for b in books]

    # Vig-clean fair probability via inverse-odds normalization (per book, then averaged).
    fair_probs = []
    for bh, bd, ba in zip(h, d, a):
        ph, pd, pa = 1 / bh, 1 / bd, 1 / ba
        s = ph + pd + pa
        fair_probs.append((ph / s, pd / s, pa / s))
    fp_h = round(mean(p[0] for p in fair_probs), 4)
    fp_d = round(mean(p[1] for p in fair_probs), 4)
    fp_a = round(mean(p[2] for p in fair_probs), 4)

    return {
        "market": "h2h",
        "bookmakers_used": len(books),
        "snapshot_time_utc": datetime.now(UTC).isoformat(),
        "home": {
            "mean_odds": round(mean(h), 2),
            "median_odds": round(median(h), 2),
            "min_odds": min(h),
            "max_odds": max(h),
            "fair_probability": fp_h,
        },
        "draw": {
            "mean_odds": round(mean(d), 2),
            "median_odds": round(median(d), 2),
            "min_odds": min(d),
            "max_odds": max(d),
            "fair_probability": fp_d,
        },
        "away": {
            "mean_odds": round(mean(a), 2),
            "median_odds": round(median(a), 2),
            "min_odds": min(a),
            "max_odds": max(a),
            "fair_probability": fp_a,
        },
        "source": "mock",
    }


async def get_market_movement(fixture_id: str, market: str) -> dict:
    return {"data_missing": True, "reason": "market movement mock not implemented yet"}
