"""Billing routes.

- POST /v1/billing/checkout     — create a Stripe Checkout Session for a package.
- POST /v1/billing/portal       — create a Stripe Customer Portal session.
- POST /v1/billing/webhook      — Stripe webhook sink (subscription lifecycle).
- GET  /v1/billing/me           — current tier, balance, active packages.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from backend.auth.middleware import AuthUser, current_user
from backend.billing.stripe_client import stripe_client, verify_webhook
from backend.billing.tokens import (
    GrantReason,
    active_package_codes,
    ensure_balance_row,
    grant,
)
from backend.core.config import get_settings
from backend.core.supabase_client import admin_client

router = APIRouter(prefix="/v1/billing", tags=["billing"])


# --------------------------- /me ---------------------------

@router.get("/me")
async def billing_me(user: Annotated[AuthUser, Depends(current_user)]) -> dict:
    ensure_balance_row(user.user_id)
    client = admin_client()
    bal = (
        client.table("token_balances")
        .select("balance, monthly_grant, last_reset_at")
        .eq("user_id", user.user_id)
        .single()
        .execute()
    )
    return {
        "balance": bal.data["balance"] if bal.data else 0,
        "monthly_grant": bal.data["monthly_grant"] if bal.data else 0,
        "last_reset_at": bal.data["last_reset_at"] if bal.data else None,
        "active_packages": sorted(active_package_codes(user.user_id)),
    }


# --------------------------- checkout ---------------------------

class CheckoutRequest(BaseModel):
    package_code: str
    success_path: str = "/account?checkout=success"
    cancel_path: str = "/pricing?checkout=cancel"


@router.post("/checkout")
async def create_checkout(
    body: CheckoutRequest,
    user: Annotated[AuthUser, Depends(current_user)],
) -> dict:
    settings = get_settings()
    sc = stripe_client()

    # Look up Stripe Price ID for the requested package.
    client = admin_client()
    prod = (
        client.table("products")
        .select("stripe_price_id, interval")
        .eq("code", body.package_code)
        .single()
        .execute()
    )
    if not prod.data or not prod.data.get("stripe_price_id"):
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            f"No Stripe price configured for package '{body.package_code}'",
        )

    price_id = prod.data["stripe_price_id"]
    is_subscription = prod.data["interval"] in ("month", "year")

    session = sc.checkout.Session.create(
        mode="subscription" if is_subscription else "payment",
        line_items=[{"price": price_id, "quantity": 1}],
        customer_email=user.email,
        client_reference_id=user.user_id,
        success_url=f"{settings.web_base_url}{body.success_path}",
        cancel_url=f"{settings.web_base_url}{body.cancel_path}",
        automatic_tax={"enabled": True},
        metadata={"user_id": user.user_id, "package_code": body.package_code},
    )
    return {"id": session.id, "url": session.url}


# --------------------------- customer portal ---------------------------

@router.post("/portal")
async def create_portal(
    user: Annotated[AuthUser, Depends(current_user)],
) -> dict:
    settings = get_settings()
    sc = stripe_client()

    client = admin_client()
    sub = (
        client.table("subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", user.user_id)
        .not_.is_("stripe_customer_id", "null")
        .limit(1)
        .execute()
    )
    if not sub.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No Stripe customer on file")

    session = sc.billing_portal.Session.create(
        customer=sub.data[0]["stripe_customer_id"],
        return_url=f"{settings.web_base_url}/account",
    )
    return {"url": session.url}


# --------------------------- webhook ---------------------------

@router.post("/webhook")
async def stripe_webhook(request: Request) -> dict:
    payload = await request.body()
    signature = request.headers.get("stripe-signature")
    if not signature:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "missing signature")

    try:
        event = verify_webhook(payload, signature)
    except Exception as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"invalid signature: {e}") from e

    kind = event["type"]
    data = event["data"]["object"]
    client = admin_client()

    if kind == "checkout.session.completed":
        user_id = data.get("client_reference_id") or (data.get("metadata") or {}).get("user_id")
        package_code = (data.get("metadata") or {}).get("package_code")
        stripe_sub_id = data.get("subscription")
        stripe_cust_id = data.get("customer")

        if user_id and package_code:
            prod = (
                client.table("products")
                .select("id, monthly_tokens, interval")
                .eq("code", package_code)
                .single()
                .execute()
            )
            if prod.data:
                if prod.data["interval"] == "one_time":
                    # Top-up: grant tokens directly.
                    grant(
                        user_id,
                        int(prod.data["monthly_tokens"]),
                        GrantReason.TOP_UP,
                        metadata={"stripe_session_id": data.get("id")},
                    )
                else:
                    # Subscription: record + grant initial monthly allotment.
                    client.table("subscriptions").upsert(
                        {
                            "user_id": user_id,
                            "product_id": prod.data["id"],
                            "stripe_customer_id": stripe_cust_id,
                            "stripe_subscription_id": stripe_sub_id,
                            "status": "active",
                        },
                        on_conflict="stripe_subscription_id",
                    ).execute()
                    grant(
                        user_id,
                        int(prod.data["monthly_tokens"]),
                        GrantReason.MONTHLY_RESET,
                        metadata={"stripe_subscription_id": stripe_sub_id},
                    )

    elif kind == "invoice.paid":
        # Recurring billing: re-grant monthly allotment.
        stripe_sub_id = data.get("subscription")
        if stripe_sub_id:
            sub = (
                client.table("subscriptions")
                .select("user_id, products(monthly_tokens)")
                .eq("stripe_subscription_id", stripe_sub_id)
                .single()
                .execute()
            )
            if sub.data and sub.data.get("products"):
                grant(
                    sub.data["user_id"],
                    int(sub.data["products"]["monthly_tokens"]),
                    GrantReason.MONTHLY_RESET,
                    metadata={"stripe_subscription_id": stripe_sub_id},
                )

    elif kind in ("customer.subscription.updated", "customer.subscription.deleted"):
        stripe_sub_id = data.get("id")
        new_status = data.get("status", "canceled")
        if stripe_sub_id:
            client.table("subscriptions").update({"status": new_status}).eq(
                "stripe_subscription_id", stripe_sub_id
            ).execute()

    return {"received": True, "type": kind}
