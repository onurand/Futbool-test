# Futbool — Architecture

Multi-agent football analyst platform. First agent: **John** (Premier League + Championship). Designed to scale to multiple league-specific agents (Carlos / La Liga, Hans / Bundesliga, Emre / Süper Lig) sharing the same tool layer.

---

## Core principles

1. **No hallucination.** Every numeric claim (score, odds, injury, fixture date) must come from a tool result. If a tool returns empty, the agent must say "data missing", not guess.
2. **Final means final.** A finished match's score is immutable. The agent never rewrites historical results.
3. **Market-aware.** When the user asks about betting, odds, or surprises, the agent must call the odds tool first.
4. **Multi-agent ready.** John is one of N agents. Tools, MCP servers, and infra are shared.
5. **Mobile-ready backend.** REST + JSON, JWT auth, versioned API. Web first, APK later — no backend rewrite needed.

---

## High-level architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Clients                                      │
│   Web (Next.js)            Mobile (React Native or Capacitor)        │
└────────────────────┬─────────────────────────┬───────────────────────┘
                     │                         │
                     ▼                         ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Backend (FastAPI)                                 │
│   /v1/auth   /v1/chat   /v1/billing   /v1/admin                      │
│   - JWT auth (Supabase)                                              │
│   - Rate limit + token quota middleware                              │
│   - Stripe webhook handler                                           │
└──────┬─────────────────┬─────────────────┬─────────────────┬─────────┘
       │                 │                 │                 │
       ▼                 ▼                 ▼                 ▼
   Supabase         Claude API        MCP Servers        Stripe
   (Auth + Postgres) (tool use)        - football-core    (subscriptions
       │                                - odds-intel       + checkout)
       ▼                                - analysis-brain
   pgvector                                  │
   Redis (cache)                             ▼
                                       External providers:
                                       Sportmonks / Odds API /
                                       football-data.org / StatsBomb
```

---

## Agents

| Agent  | League              | Status   |
| ------ | ------------------- | -------- |
| John   | Premier + Championship | active (MVP) |
| Carlos | La Liga             | planned  |
| Hans   | Bundesliga          | planned  |
| Emre   | Süper Lig           | planned  |

Each agent has:
- a system prompt under `prompts/<agent>.md`
- access policy (which subscription packages unlock it)
- the same shared tool set

---

## Tools (6 — Claude tool use)

| Tool                          | Purpose                                                         | Source         | Cache TTL |
| ----------------------------- | --------------------------------------------------------------- | -------------- | --------- |
| `resolve_match_query`         | Resolve "Manu - Leeds tonight" → fixture_id                     | football-core  | 5 min     |
| `get_fixture_context`         | Competition, venue, kickoff, officials                          | football-core  | 10–30 min |
| `get_team_form`               | Last N matches, home/away splits, rolling metrics               | football-core  | 10 min    |
| `get_player_availability`     | Injuries, suspensions, expected lineup impact                   | football-core  | 5–10 min  |
| `get_market_odds_consensus`   | Mean/median odds across N bookmakers + vig-clean fair prob.     | odds-intel     | 30–120 s  |
| `get_prediction_snapshot`     | Ensemble: market prior + form + matchup + availability          | analysis-brain | 2–5 min   |

Schemas live in `tools/schemas.json`. The agent calls them via Claude's tool use loop.

---

## Tool call orchestration (example)

User: *"Manu - Leeds tonight, what's the bookmaker average and what could the surprise be?"*

1. `resolve_match_query` → fixture_id
2. `get_market_odds_consensus` (market questions → odds first, always)
3. `get_team_form`
4. `get_player_availability`
5. `get_prediction_snapshot`
6. Claude composes the answer in John's output format.

---

## MCP servers

Three logical servers (deployable as one or three depending on scale):

1. **football-core** — wraps Sportmonks + football-data.org (fallback). Tools: resolve, fixture, form, availability.
2. **odds-intel** — wraps The Odds API. Tools: market consensus, line movement.
3. **analysis-brain** — wraps Postgres/pgvector + ensemble model. Tool: prediction snapshot.

MVP can ship as a single MCP server; split later for independent scaling and rate limit isolation.

---

## Data layer

### PostgreSQL (Supabase)
- `users`, `sessions` — Supabase Auth
- `subscriptions`, `products`, `payments` — Stripe sync
- `token_balances`, `token_ledger` — credit accounting
- `agents` — registry
- `fixtures`, `teams`, `players`, `lineups`, `injuries`, `suspensions`
- `odds_snapshots` — historical odds for line movement analysis
- `rolling_team_metrics`, `rolling_player_metrics`

### pgvector
- Match previews, tactical notes, press conference summaries, form narratives

### Redis
- Tool result cache (TTLs above)
- Rate limit counters

---

## Auth & subscriptions

- **Supabase Auth**: email/password, Google, Apple. JWT for both web and mobile.
- **Stripe**: Subscriptions per league pack + one-time top-ups.
- **Tier resolution**: backend middleware reads active `subscriptions`, decides which agents user can access.

### Default packages

| Package           | Agents      | Monthly | Tokens / mo | Mode                  |
| ----------------- | ----------- | ------- | ----------- | --------------------- |
| Free              | limited     | $0      | 20          | fast pundit only      |
| England Pack      | John        | $9.99   | 500         | fast + sharp          |
| Spain Pack        | Carlos      | $9.99   | 500         | fast + sharp          |
| Germany Pack      | Hans        | $9.99   | 500         | fast + sharp          |
| Türkiye Pack      | Emre        | $7.99   | 500         | fast + sharp          |
| All-Leagues Pro   | all         | $24.99  | 2000        | fast + sharp + extras |
| Top-up            | —           | $4.99   | +500        | one-time              |

### Token cost per call
- Fast pundit answer: **1 token**
- Sharp analysis (multi-tool + ensemble): **5 tokens**
- `get_market_movement` add-on: **+3 tokens**
- Cache hit: **0 tokens**

---

## Admin panel

Routes under `/admin` (frontend) + `/v1/admin/*` (backend), gated by `role = admin` in Supabase.

- Product / package CRUD (mapped to Stripe Price IDs)
- User search, role/tier change, manual token grant, ban
- Subscription view (active/cancelled/refunded, link to Stripe dashboard)
- Token ledger inspection (anomaly detection)
- Agent / league usage analytics
- System health: cache hit rate, provider API spend, error rates

---

## Anti-hallucination guarantees

1. System prompt: explicit "never invent scores, odds, injuries, dates" rule.
2. Tool handlers return `{ "data_missing": true, "reason": "..." }` rather than empty defaults.
3. Numeric values in answers must include source metadata: `bookmakers_used`, `snapshot_time_utc`, etc.
4. Finished fixtures are read-only — model cannot rewrite past scores.
5. Dev-mode validator: post-process model output, flag any number not present in the tool transcript.

---

## Phased delivery

### Phase 0 — Scaffold (this commit)
Repo, env, docker-compose, prompts, tool schemas, placeholders.

### Phase 1 — Backend MVP
Supabase auth, 6 tool handlers, Sportmonks + Odds API integration, Claude tool-use loop, Redis cache.

### Phase 2 — Stripe + token system
Products, checkout, customer portal, webhook handler, token ledger, quota middleware, agent access gate.

### Phase 3 — Web UI + Admin Panel
Next.js: chat, pricing, account, admin.

### Phase 4 — Smarter John
Ensemble model, retrieval indexes, fast pundit + sharp analysis modes.

### Phase 5 — Mobile (APK / iOS)
React Native or Capacitor. Apple IAP consideration for App Store.

### Phase 6 — More agents
Carlos, Hans, Emre — same tools, new prompts, new packages.
