# Futbool

Multi-agent football analyst platform. Market-aware, anti-hallucination, league-specialised AI agents (John for Premier + Championship; Carlos / Hans / Emre planned) powered by Claude tool use over MCP servers.

> Status: **Phase 0 — Scaffolding**. Architecture and structure only; no live integrations yet.

---

## Quick start (Phase 0)

```bash
cp .env.example .env
docker compose up -d   # Postgres + Redis
```

Backend, MCP servers, and frontend are placeholders at this phase. See `ARCHITECTURE.md` for the full plan.

---

## Layout

```
backend/        FastAPI app (auth, chat, billing, admin)
agents/         Agent registry (John, Carlos, ...)
prompts/        Per-agent system prompts
mcp_servers/    football-core, odds-intel, analysis-brain
tools/          Claude tool JSON schemas (6 tools)
docs/           Additional design docs
scripts/        Dev/ops scripts
```

---

## Key documents

- `ARCHITECTURE.md` — full design: agents, tools, MCP layout, data, auth, Stripe, admin, phasing.
- `prompts/john.md` — John's system prompt, rules, output format.
- `tools/schemas.json` — 6 tool definitions used by Claude.

---

## Phases

| Phase | Scope                                                      |
| ----- | ---------------------------------------------------------- |
| 0     | Repo scaffold, docs, schemas (this commit)                 |
| 1     | Supabase auth + 6 tool handlers + Claude loop              |
| 2     | Stripe subscriptions + token ledger + quota middleware     |
| 3     | Next.js web UI + admin panel                               |
| 4     | Ensemble model + fast/sharp modes                          |
| 5     | Mobile (React Native or Capacitor)                         |
| 6     | More agents (Carlos, Hans, Emre)                           |
