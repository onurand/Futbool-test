# Live Setup — zero to a real John answer

This is the checklist to flip Futbool from the in-repo mock mode to a live
stack. Secrets never go in the repo — they live in your local `.env` files.

## 1. Supabase

1. https://supabase.com → open your project (`unhwcviaxflypgjrxusm` in this repo's notes).
2. **SQL Editor → New query** → paste the full contents of
   `supabase/migrations/0001_init.sql` → **Run**. This creates profiles,
   products, subscriptions, token ledger, fixtures, odds snapshots, pgvector,
   RLS policies, and seeds the default packages (free, england_pack,
   spain_pack, germany_pack, turkiye_pack, all_leagues_pro, top_up_500).
3. Settings → **API** → copy:
   - Project URL                  → `SUPABASE_URL`
   - `anon` / publishable key     → `SUPABASE_ANON_KEY`
   - `service_role` / secret key  → `SUPABASE_SERVICE_ROLE_KEY`
   - JWT Secret                   → `SUPABASE_JWT_SECRET`
4. Settings → **Database → Connection string → Transaction pooler** (port 6543)
   → URI → `DATABASE_URL`.
5. Flip yourself to admin (so the /admin panel works). In SQL Editor:
   ```sql
   update profiles set role = 'admin' where email = '<your email>';
   update auth.users
     set raw_app_meta_data = jsonb_set(
       coalesce(raw_app_meta_data, '{}'::jsonb),
       '{role}', '"admin"'
     )
     where email = '<your email>';
   ```

## 2. Anthropic

1. https://console.anthropic.com → API Keys → **Create Key**.
2. Copy the key → `ANTHROPIC_API_KEY` in the backend `.env`.
3. Model: `CLAUDE_MODEL=claude-opus-4-7` (the default).

## 3. Football data providers

Mock mode works end-to-end without these; turn them on later by flipping
`USE_MOCK_PROVIDERS=false` and wiring the live clients.

- `SPORTMONKS_API_KEY`     — primary feed
- `THE_ODDS_API_KEY`       — bookmaker consensus
- `FOOTBALL_DATA_ORG_KEY`  — fallback

## 4. Stripe

1. https://dashboard.stripe.com → Developers → **API keys** (test mode)
   → Secret key → `STRIPE_SECRET_KEY`.
2. Stripe Dashboard → **Products** → create one product per package and one
   Price per interval. Keep the package codes aligned with the seed in
   `0001_init.sql` (free, england_pack, spain_pack, germany_pack,
   turkiye_pack, all_leagues_pro, top_up_500).
3. Copy each Price ID into the admin panel at `/admin` → **Products** → Edit.
   This writes `products.stripe_price_id` in Postgres, which the checkout
   endpoint reads.
4. Developers → **Webhooks** → Add endpoint
   `https://<your-api-host>/v1/billing/webhook` → select events:
   - `checkout.session.completed`
   - `invoice.paid`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   Copy the **signing secret** → `STRIPE_WEBHOOK_SECRET`.

## 5. Environment files

Backend `.env` (repo root):
```
APP_ENV=development
APP_BASE_URL=http://localhost:8000
WEB_BASE_URL=http://localhost:3000

ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-opus-4-7

SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_JWT_SECRET=...
DATABASE_URL=postgresql+asyncpg://postgres:PASSWORD@db.xxxx.pooler.supabase.com:6543/postgres

REDIS_URL=redis://localhost:6379/0

STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

USE_MOCK_PROVIDERS=true
```

Frontend `web/.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

## 6. Run the stack

```bash
docker compose up -d                          # postgres + redis
pip install -e .[dev]                         # or uv pip install
uvicorn backend.main:app --reload --port 8000 # backend

cd web
npm install
npm run dev                                   # http://localhost:3000
```

## 7. Smoke test

With the web app open at http://localhost:3000:

1. `/signup` → create an account.
2. `/` → tap the Manchester United vs Leeds card.
3. The analysis loads with John's structured take against the mock
   providers. Tokens are debited (1 fast / 5 sharp) and the count
   updates in `/account`.
4. `/pricing` → tap **England Pack · Subscribe** → Stripe Checkout
   opens. Use test card `4242 4242 4242 4242`, any future expiry,
   any CVC. After success, `/account` shows the active package and
   a fresh 500-token grant.
5. `/admin` (once you've been flipped to admin in step 1.5) →
   Analytics tab to verify spend was recorded, Ledger tab for the
   append-only history.

## 8. Go fully live

Once the smoke test passes:

- Flip `USE_MOCK_PROVIDERS=false` after wiring the live Sportmonks /
  Odds API clients (`backend/providers/sportmonks.py` et al.).
- Switch Stripe to live keys, update the webhook to the production URL.
- Point DNS at the deployed backend and set `APP_BASE_URL` and
  `WEB_BASE_URL` to the real hostnames.
