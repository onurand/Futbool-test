"""analysis-brain MCP server entry point. Phase 0 stub.

Target ensemble (Phase 4):
    final = 0.40 * market + 0.20 * strength + 0.15 * form
            + 0.15 * matchup + 0.10 * availability
"""

from __future__ import annotations


def missing(reason: str) -> dict:
    return {"data_missing": True, "reason": reason}


async def get_prediction_snapshot(fixture_id: str) -> dict:
    return missing("analysis-brain ensemble not yet implemented")
