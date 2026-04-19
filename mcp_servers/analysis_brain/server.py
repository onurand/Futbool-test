"""analysis-brain MCP server entry point.

Phase 1: delegates to mock ensemble. Real ensemble (market + strength + form +
matchup + availability) lands in Phase 4.

Target weights:
    final = 0.40*market + 0.20*strength + 0.15*form + 0.15*matchup + 0.10*availability
"""

from __future__ import annotations

from backend.core.config import get_settings
from backend.providers import mock_analysis


async def get_prediction_snapshot(fixture_id: str) -> dict:
    if get_settings().use_mock_providers:
        return await mock_analysis.get_prediction_snapshot(fixture_id)
    return {"data_missing": True, "reason": "live ensemble not yet implemented"}
