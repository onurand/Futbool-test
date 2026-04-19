"""Stripe client + package → Price ID resolution.

Package codes are mirrored in `products.code` in Postgres. Stripe Price IDs
are stored in `products.stripe_price_id`. This module wraps the Stripe SDK,
resolves the Price ID for a given package at checkout time, and verifies
webhook signatures.
"""

from __future__ import annotations

import stripe

from backend.core.config import get_settings


def stripe_client() -> type[stripe]:
    s = get_settings()
    if not s.stripe_secret_key:
        raise RuntimeError("STRIPE_SECRET_KEY not configured")
    stripe.api_key = s.stripe_secret_key
    return stripe


def verify_webhook(payload: bytes, signature: str) -> stripe.Event:
    s = get_settings()
    if not s.stripe_webhook_secret:
        raise RuntimeError("STRIPE_WEBHOOK_SECRET not configured")
    return stripe.Webhook.construct_event(
        payload=payload,
        sig_header=signature,
        secret=s.stripe_webhook_secret,
    )
