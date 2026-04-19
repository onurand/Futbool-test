"""football-core MCP server.

Wraps Sportmonks (primary) and football-data.org (fallback). Exposes:
- resolve_match_query
- get_fixture_context
- get_team_form
- get_player_availability

Phase 0: stub only — handlers return data_missing=True.
"""
