# Futbool

Multi-agent football analyst platform. Market-aware, anti-hallucination,
league-specialised AI agents powered by Claude tool use over MCP servers.

**Agents**: John 🏴 Premier + Championship · Carlos 🇪🇸 La Liga · Hans 🇩🇪
Bundesliga · Emre 🇹🇷 Süper Lig. All four share one tool set and one
anti-hallucination contract; their voice is customised in the system prompt.

> Status: scaffold + end-to-end mock flow + live provider clients + Stripe
> billing + admin panel + mobile wrapper are all in. Flip the env to live
> keys and you have a real product.

---

## What's in the box

- **Backend** (FastAPI) — auth (Supabase JWT), chat (Claude tool-use loop),
  billing (Stripe + token ledger + agent access gate), admin (products,
  users, subscriptions, ledger, analytics), matches API.
- **MCP servers** — football-core, odds-intel, analysis-brain. Live
  clients for Sportmonks, The Odds API and football-data.org with
  retries and graceful `data_missing` fallback. Mock clients for
  development without keys.
- **Ensemble model** — market prior + team strength + form + matchup +
  availability blended per the 0.40 / 0.20 / 0.15 / 0.15 / 0.10 mix.
- **Web app** (Next.js 15 + Tailwind v4) — sportsbook-style UI with
  matches list, match analysis, pricing, account, admin, Supabase auth,
  password reset, Fast/Sharp mode toggle, TR/EN language toggle.
- **Mobile** — Capacitor config and scripts; ship the same web as an
  APK / IPA in either remote-view or bundled-static mode.
- **Supabase schema** — profiles, products, subscriptions, payments,
  token_balances, token_ledger, fixtures, odds_snapshots, pgvector,
  RLS policies, seed products.
- **Docs** — `ARCHITECTURE.md`, `docs/LIVE_SETUP.md`, `docs/MOBILE.md`.

---

## Layout

```
backend/
  auth/           Supabase JWT verification + /v1/auth
  billing/        Stripe client, checkout, webhook, token ledger
  chat/           Claude tool-use loop + /v1/chat
  matches/        /v1/matches (public fixtures read model)
  admin/          /v1/admin/* (role-gated)
  providers/      mock_* + sportmonks / the_odds_api / football_data_org / ensemble
  core/           config, supabase client, redis cache
agents/           Agent registry
prompts/          john.md / carlos.md / hans.md / emre.md
mcp_servers/      football-core / odds-intel / analysis-brain
tools/schemas.json   6 Claude tool definitions
supabase/migrations  schema + RLS + seeds
web/              Next.js app + Capacitor config
docs/             LIVE_SETUP.md, MOBILE.md, preview.html
scripts/          smoke_test.sh
```

---

## Run locally (mock providers)

```bash
cp .env.example .env                  # mostly fine with defaults + Supabase URL
docker compose up -d                  # postgres + redis
pip install -e .[dev]                 # or: uv pip install
uvicorn backend.main:app --reload     # backend at :8000

cd web
cp .env.local.example .env.local      # Supabase public values + API base
npm install
npm run dev                           # web at :3000
```

Mock mode gives you a working end-to-end demo with a Manchester United vs
Leeds fixture, synthetic 12-bookmaker consensus, and a full ensemble
answer from John — all without paid API keys.

## Go live

See **[docs/LIVE_SETUP.md](docs/LIVE_SETUP.md)** for the zero-to-live
checklist (Supabase migration, Anthropic key, Stripe products + webhook,
Sportmonks / Odds API keys, env files, smoke test).

## Ship mobile

See **[docs/MOBILE.md](docs/MOBILE.md)** — same Next.js codebase wraps
into Android + iOS via Capacitor.

---

## Key design docs

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — agents, tools, MCP layout,
  data, auth, Stripe, admin, phasing, anti-hallucination guarantees.
- [`prompts/john.md`](prompts/john.md) — John's identity, hard rules,
  output format.
- [`tools/schemas.json`](tools/schemas.json) — the 6 Claude tools.

---

## Phase status

| Phase | Scope                                                      | Status |
| ----- | ---------------------------------------------------------- | ------ |
| 0     | Repo scaffold, docs, schemas                               | ✅ |
| 1     | Supabase auth + 6 tool handlers + Claude loop              | ✅ |
| 2     | Stripe subscriptions + token ledger + quota middleware     | ✅ |
| 3     | Next.js web UI + admin panel                               | ✅ |
| 4     | Ensemble model + live providers + fast/sharp mode          | ✅ |
| 5     | Mobile wrapper (Capacitor, Android + iOS)                  | ✅ (config in, user runs `cap add`) |
| 6     | Carlos (La Liga), Hans (Bundesliga), Emre (Süper Lig)      | ✅ (prompts in, active) |
| 7+    | Streaming responses, push notifications, live H2H signal   | ⏳ |
