"""Admin API. All endpoints gated by require_admin (Supabase role='admin').

Scope kept minimal: products (map to Stripe Price IDs), users (tier + token
grants), subscriptions (read-only), token ledger (inspection), and a usage
analytics digest.
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from backend.auth.middleware import AuthUser, require_admin
from backend.billing.tokens import GrantReason, grant
from backend.core.supabase_client import admin_client

router = APIRouter(
    prefix="/v1/admin",
    tags=["admin"],
    dependencies=[Depends(require_admin)],
)


# --------------------------- products ---------------------------

class ProductUpdate(BaseModel):
    name: str | None = None
    stripe_price_id: str | None = None
    monthly_tokens: int | None = None
    price_cents: int | None = None
    is_active: bool | None = None


@router.get("/products")
async def list_products() -> dict:
    rows = admin_client().table("products").select("*").order("price_cents").execute()
    return {"products": rows.data or []}


@router.patch("/products/{code}")
async def update_product(code: str, body: ProductUpdate) -> dict:
    payload = {k: v for k, v in body.model_dump().items() if v is not None}
    if not payload:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "no fields to update")
    rows = (
        admin_client()
        .table("products")
        .update(payload)
        .eq("code", code)
        .execute()
    )
    if not rows.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"unknown package: {code}")
    return {"product": rows.data[0]}


# --------------------------- users ---------------------------

@router.get("/users")
async def list_users(q: str | None = None, limit: int = 50) -> dict:
    query = admin_client().table("profiles").select(
        "id, email, role, tier, created_at"
    ).order("created_at", desc=True).limit(min(limit, 200))
    if q:
        query = query.ilike("email", f"%{q}%")
    rows = query.execute()
    return {"users": rows.data or []}


class UserPatch(BaseModel):
    role: str | None = None
    tier: str | None = None
    ban: bool | None = None


@router.patch("/users/{user_id}")
async def update_user(user_id: str, body: UserPatch) -> dict:
    payload: dict[str, Any] = {}
    if body.role is not None:
        if body.role not in ("user", "admin"):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "role must be user|admin")
        payload["role"] = body.role
    if body.tier is not None:
        payload["tier"] = body.tier
    if not payload:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "no fields to update")
    rows = (
        admin_client()
        .table("profiles")
        .update(payload)
        .eq("id", user_id)
        .execute()
    )
    if not rows.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "user not found")
    return {"user": rows.data[0]}


class TokenGrant(BaseModel):
    amount: int
    note: str | None = None


@router.post("/users/{user_id}/tokens")
async def admin_grant_tokens(user_id: str, body: TokenGrant) -> dict:
    if body.amount <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "amount must be positive")
    new_balance = grant(
        user_id,
        body.amount,
        GrantReason.ADMIN,
        metadata={"note": body.note} if body.note else {},
    )
    return {"balance": new_balance}


# --------------------------- subscriptions ---------------------------

@router.get("/subscriptions")
async def list_subscriptions(status_filter: str | None = None, limit: int = 100) -> dict:
    query = (
        admin_client()
        .table("subscriptions")
        .select(
            "id, user_id, status, current_period_end, stripe_subscription_id, "
            "stripe_customer_id, products(code, name)"
        )
        .order("created_at", desc=True)
        .limit(min(limit, 500))
    )
    if status_filter:
        query = query.eq("status", status_filter)
    rows = query.execute()
    return {"subscriptions": rows.data or []}


# --------------------------- ledger ---------------------------

@router.get("/ledger")
async def list_ledger(
    user_id: str | None = None, limit: int = 100
) -> dict:
    query = (
        admin_client()
        .table("token_ledger")
        .select("id, user_id, delta, reason, agent_code, fixture_id, metadata, created_at")
        .order("created_at", desc=True)
        .limit(min(limit, 500))
    )
    if user_id:
        query = query.eq("user_id", user_id)
    rows = query.execute()
    return {"ledger": rows.data or []}


# --------------------------- analytics ---------------------------

@router.get("/analytics")
async def analytics_summary() -> dict:
    client = admin_client()

    users = client.table("profiles").select("id", count="exact").execute()
    subs = (
        client.table("subscriptions")
        .select("id", count="exact")
        .in_("status", ["active", "trialing"])
        .execute()
    )
    recent_spend = (
        client.table("token_ledger")
        .select("delta, reason, agent_code")
        .lt("delta", 0)
        .order("created_at", desc=True)
        .limit(500)
        .execute()
    )

    by_agent: dict[str, int] = {}
    by_reason: dict[str, int] = {}
    for r in recent_spend.data or []:
        agent = r.get("agent_code") or "unknown"
        by_agent[agent] = by_agent.get(agent, 0) + abs(int(r["delta"]))
        by_reason[r["reason"]] = by_reason.get(r["reason"], 0) + 1

    return {
        "total_users": users.count or 0,
        "active_subscriptions": subs.count or 0,
        "recent_tokens_spent_by_agent": by_agent,
        "recent_spend_by_reason": by_reason,
    }


# --------------------------- current admin ---------------------------

@router.get("/me")
async def admin_me(user: Annotated[AuthUser, Depends(require_admin)]) -> dict:
    return {"user_id": user.user_id, "email": user.email, "is_admin": True}
