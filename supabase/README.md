# Supabase

Project infra for Futbool: schema migrations, RLS, seed data.

## Apply the initial migration

**Option A — dashboard (fastest)**
1. Supabase → your project → **SQL Editor** → **New query**
2. Paste the contents of `migrations/0001_init.sql`
3. Run.

**Option B — Supabase CLI**
```bash
supabase link --project-ref unhwcviaxflypgjrxusm
supabase db push
```

## What this creates

- `profiles` (1:1 with `auth.users`, auto-populated on signup)
- `products`, `subscriptions`, `payments` (Stripe mirror)
- `token_balances`, `token_ledger` (credit accounting)
- `teams`, `fixtures`, `lineups`, `injuries` (football domain)
- `odds_snapshots` (time-series odds)
- `rolling_team_metrics` (computed snapshots)
- `knowledge_chunks` (pgvector, Phase 4)
- RLS policies for own-row reads; service_role bypass
- Seed: all 7 default products (free, 4 league packs, pro, top-up)

## What it does NOT create

- Stripe Price IDs — filled in later via admin panel when products are linked.
- Any user data.
