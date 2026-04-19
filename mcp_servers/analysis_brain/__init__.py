"""analysis-brain MCP server.

Hosts the ensemble prediction model. Reads Postgres / pgvector for context,
combines a market prior with form, matchup, and availability signals.

Exposes:
- get_prediction_snapshot

Phase 0: stub only — handler returns data_missing=True.
"""
