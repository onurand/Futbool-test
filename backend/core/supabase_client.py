"""Supabase client wrapper. Two clients:

- `user_client(jwt)`: acts as the signed-in user, respects RLS.
- `admin_client()`: service_role key, bypasses RLS. Use only in trusted server code.
"""

from __future__ import annotations

from functools import lru_cache

from supabase import Client, create_client

from backend.core.config import get_settings


@lru_cache
def admin_client() -> Client:
    s = get_settings()
    if not s.supabase_url or not s.supabase_service_role_key:
        raise RuntimeError("Supabase admin credentials missing in env.")
    return create_client(s.supabase_url, s.supabase_service_role_key)


def user_client(access_token: str) -> Client:
    s = get_settings()
    if not s.supabase_url or not s.supabase_anon_key:
        raise RuntimeError("Supabase anon credentials missing in env.")
    client = create_client(s.supabase_url, s.supabase_anon_key)
    client.postgrest.auth(access_token)
    return client
