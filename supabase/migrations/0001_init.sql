-- Futbool initial schema.
-- Run against a fresh Supabase project (auth.users already exists).
-- All app tables live in the public schema. RLS is enabled; permissive service-role
-- access is assumed (backend uses service_role key).

set search_path = public;

-- ============================================================================
-- Profiles (1:1 with auth.users)
-- ============================================================================

create table if not exists profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text not null unique,
    display_name text,
    role text not null default 'user' check (role in ('user', 'admin')),
    tier text not null default 'free',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_role on profiles(role);

-- Auto-create profile on signup.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    insert into public.profiles (id, email)
    values (new.id, new.email)
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function handle_new_user();

-- ============================================================================
-- Products / subscriptions / payments (Stripe mirror)
-- ============================================================================

create table if not exists products (
    id uuid primary key default gen_random_uuid(),
    code text not null unique,                  -- 'england_pack', 'all_leagues_pro', ...
    name text not null,
    leagues text[] not null default '{}',
    monthly_tokens integer not null default 0,
    price_cents integer not null default 0,
    interval text not null default 'month' check (interval in ('month', 'year', 'one_time')),
    stripe_price_id text unique,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

create table if not exists subscriptions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    product_id uuid not null references products(id),
    stripe_customer_id text,
    stripe_subscription_id text unique,
    status text not null,                       -- 'active','past_due','canceled','trialing'
    current_period_start timestamptz,
    current_period_end timestamptz,
    cancel_at_period_end boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_subs_user on subscriptions(user_id);
create index if not exists idx_subs_status on subscriptions(status);

create table if not exists payments (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    stripe_payment_intent_id text unique,
    stripe_invoice_id text,
    amount_cents integer not null,
    currency text not null default 'usd',
    kind text not null check (kind in ('subscription', 'top_up', 'refund')),
    created_at timestamptz not null default now()
);

-- ============================================================================
-- Token ledger
-- ============================================================================

create table if not exists token_balances (
    user_id uuid primary key references auth.users(id) on delete cascade,
    balance integer not null default 0,
    monthly_grant integer not null default 0,
    last_reset_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists token_ledger (
    id bigserial primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    delta integer not null,                     -- positive grant, negative spend
    reason text not null,                       -- 'fast_pundit', 'sharp_analysis', 'grant', 'top_up', 'reset'
    agent_code text,                            -- which agent consumed (nullable for grants)
    fixture_id text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_ledger_user on token_ledger(user_id, created_at desc);

-- ============================================================================
-- Football domain
-- ============================================================================

create table if not exists teams (
    id text primary key,                        -- provider id (Sportmonks/football-data)
    name text not null,
    short_name text,
    league text,
    country text default 'England',
    extra jsonb not null default '{}'::jsonb
);

create table if not exists fixtures (
    id text primary key,                        -- provider id
    competition text not null,
    season text,
    kickoff_utc timestamptz,
    home_team_id text references teams(id),
    away_team_id text references teams(id),
    venue text,
    status text not null default 'scheduled',   -- scheduled|in_play|finished|postponed|cancelled
    home_score integer,
    away_score integer,
    extra jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
);

create index if not exists idx_fixtures_kickoff on fixtures(kickoff_utc);
create index if not exists idx_fixtures_status on fixtures(status);
create index if not exists idx_fixtures_teams on fixtures(home_team_id, away_team_id);

create table if not exists lineups (
    fixture_id text not null references fixtures(id) on delete cascade,
    team_id text not null references teams(id),
    data jsonb not null,
    captured_at timestamptz not null default now(),
    primary key (fixture_id, team_id)
);

create table if not exists injuries (
    id bigserial primary key,
    team_id text not null references teams(id),
    player_name text not null,
    status text not null,                       -- 'out','doubtful','suspended'
    expected_return date,
    source text,
    captured_at timestamptz not null default now()
);

create index if not exists idx_injuries_team on injuries(team_id);

-- ============================================================================
-- Odds snapshots (time-series)
-- ============================================================================

create table if not exists odds_snapshots (
    id bigserial primary key,
    fixture_id text not null references fixtures(id) on delete cascade,
    market text not null,                       -- 'h2h','totals','btts'
    bookmaker text not null,
    home_odds numeric,
    draw_odds numeric,
    away_odds numeric,
    line numeric,
    over_odds numeric,
    under_odds numeric,
    snapshot_time_utc timestamptz not null default now(),
    raw jsonb not null default '{}'::jsonb
);

create index if not exists idx_odds_fixture_market_time on
    odds_snapshots(fixture_id, market, snapshot_time_utc desc);

-- ============================================================================
-- Rolling metrics (computed by analysis-brain)
-- ============================================================================

create table if not exists rolling_team_metrics (
    team_id text not null references teams(id),
    as_of timestamptz not null,
    lookback integer not null,                  -- 5, 10
    metrics jsonb not null,                     -- { xg_for, xg_against, ppg, home_ppg, ... }
    primary key (team_id, as_of, lookback)
);

-- ============================================================================
-- Retrieval / vector store (Phase 4)
-- ============================================================================

create extension if not exists vector;

create table if not exists knowledge_chunks (
    id uuid primary key default gen_random_uuid(),
    kind text not null,                         -- 'match_preview','tactical','press','form_narrative'
    league text,
    team_id text references teams(id),
    fixture_id text references fixtures(id),
    content text not null,
    embedding vector(1536),
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_chunks_kind on knowledge_chunks(kind);
create index if not exists idx_chunks_team on knowledge_chunks(team_id);
create index if not exists idx_chunks_fixture on knowledge_chunks(fixture_id);
-- IVFFlat index to be created after data loaded (needs rows to tune lists).

-- ============================================================================
-- RLS
-- ============================================================================

alter table profiles enable row level security;
alter table subscriptions enable row level security;
alter table payments enable row level security;
alter table token_balances enable row level security;
alter table token_ledger enable row level security;

-- Self-read for users (service_role bypasses RLS automatically).
create policy "own profile readable" on profiles
    for select using (auth.uid() = id);
create policy "own profile updatable" on profiles
    for update using (auth.uid() = id);

create policy "own subs readable" on subscriptions
    for select using (auth.uid() = user_id);
create policy "own payments readable" on payments
    for select using (auth.uid() = user_id);
create policy "own tokens readable" on token_balances
    for select using (auth.uid() = user_id);
create policy "own ledger readable" on token_ledger
    for select using (auth.uid() = user_id);

-- Admin bypass: role='admin' in profiles can read everything (enforced in app layer;
-- service_role already bypasses, so admin endpoints hit via service_role).

-- ============================================================================
-- Seed default products
-- ============================================================================

insert into products (code, name, leagues, monthly_tokens, price_cents, interval)
values
    ('free',             'Free',              '{}',                                       20,    0,      'month'),
    ('england_pack',     'England Pack',      '{"Premier League","Championship"}',        500,   999,    'month'),
    ('spain_pack',       'Spain Pack',        '{"La Liga"}',                              500,   999,    'month'),
    ('germany_pack',     'Germany Pack',      '{"Bundesliga"}',                           500,   999,    'month'),
    ('turkiye_pack',     'Türkiye Pack',      '{"Süper Lig"}',                            500,   799,    'month'),
    ('all_leagues_pro',  'All-Leagues Pro',   '{"Premier League","Championship","La Liga","Bundesliga","Süper Lig"}', 2000, 2499, 'month'),
    ('top_up_500',       'Top-up 500 tokens', '{}',                                       500,   499,    'one_time')
on conflict (code) do nothing;
