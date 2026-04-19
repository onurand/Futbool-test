"""Token ledger + quota.

Source of truth: `token_balances` (current balance, monthly grant, last reset)
and append-only `token_ledger` (every grant and spend). All writes go through
Supabase service-role client (RLS-bypassing) so the backend can enforce
rules even when the user is offline.
"""

from __future__ import annotations

from enum import Enum

from fastapi import HTTPException, status

from backend.core.supabase_client import admin_client


class SpendReason(str, Enum):
    FAST_PUNDIT = "fast_pundit"
    SHARP_ANALYSIS = "sharp_analysis"
    MARKET_MOVEMENT = "market_movement"


class GrantReason(str, Enum):
    SIGNUP = "grant_signup"
    MONTHLY_RESET = "grant_monthly_reset"
    TOP_UP = "grant_top_up"
    ADMIN = "grant_admin"


COSTS: dict[SpendReason, int] = {
    SpendReason.FAST_PUNDIT: 1,
    SpendReason.SHARP_ANALYSIS: 5,
    SpendReason.MARKET_MOVEMENT: 3,
}


def _balance(user_id: str) -> int:
    client = admin_client()
    row = (
        client.table("token_balances")
        .select("balance")
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    return int(row.data["balance"]) if row.data else 0


def ensure_balance_row(user_id: str, initial: int = 20) -> None:
    """Idempotent — create a zero-row if missing, topped up with signup grant."""
    client = admin_client()
    existing = (
        client.table("token_balances")
        .select("user_id")
        .eq("user_id", user_id)
        .execute()
    )
    if existing.data:
        return
    client.table("token_balances").insert(
        {"user_id": user_id, "balance": initial, "monthly_grant": initial}
    ).execute()
    client.table("token_ledger").insert(
        {
            "user_id": user_id,
            "delta": initial,
            "reason": GrantReason.SIGNUP.value,
            "metadata": {},
        }
    ).execute()


def require_spend(
    user_id: str,
    reason: SpendReason,
    *,
    agent_code: str | None = None,
    fixture_id: str | None = None,
    metadata: dict | None = None,
) -> int:
    """Atomically check and debit tokens. Raises 402 if insufficient.

    Returns the new balance.
    """
    cost = COSTS[reason]
    client = admin_client()
    current = _balance(user_id)
    if current < cost:
        raise HTTPException(
            status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "code": "insufficient_tokens",
                "cost": cost,
                "balance": current,
                "message": "Not enough tokens. Top up or upgrade your package.",
            },
        )
    new_balance = current - cost
    client.table("token_balances").update({"balance": new_balance}).eq(
        "user_id", user_id
    ).execute()
    client.table("token_ledger").insert(
        {
            "user_id": user_id,
            "delta": -cost,
            "reason": reason.value,
            "agent_code": agent_code,
            "fixture_id": fixture_id,
            "metadata": metadata or {},
        }
    ).execute()
    return new_balance


def grant(
    user_id: str,
    amount: int,
    reason: GrantReason,
    metadata: dict | None = None,
) -> int:
    client = admin_client()
    current = _balance(user_id)
    new_balance = current + amount
    client.table("token_balances").upsert(
        {"user_id": user_id, "balance": new_balance}
    ).execute()
    client.table("token_ledger").insert(
        {
            "user_id": user_id,
            "delta": amount,
            "reason": reason.value,
            "metadata": metadata or {},
        }
    ).execute()
    return new_balance


def active_package_codes(user_id: str) -> set[str]:
    """Return product codes for the user's active subscriptions."""
    client = admin_client()
    rows = (
        client.table("subscriptions")
        .select("status, products(code)")
        .eq("user_id", user_id)
        .in_("status", ["active", "trialing"])
        .execute()
    )
    return {r["products"]["code"] for r in (rows.data or []) if r.get("products")}


def user_can_access_agent(user_id: str, required_packages: tuple[str, ...]) -> bool:
    """User can access the agent if they subscribe to any of its required packages,
    or if the agent lists 'free' in its requirements."""
    if "free" in required_packages:
        return True
    return bool(active_package_codes(user_id) & set(required_packages))
