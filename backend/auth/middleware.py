"""FastAPI dependency for Supabase JWT verification.

Supabase signs access tokens with a shared HMAC secret (SUPABASE_JWT_SECRET)
using HS256. We verify locally; no round-trip needed per request.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from jose import JWTError, jwt

from backend.core.config import get_settings


@dataclass(frozen=True)
class AuthUser:
    user_id: str
    email: str | None
    role: str = "authenticated"
    raw_claims: dict | None = None

    @property
    def is_admin(self) -> bool:
        # Supabase app_metadata can carry a custom 'role' = 'admin'.
        meta = (self.raw_claims or {}).get("app_metadata") or {}
        return meta.get("role") == "admin" or self.role == "admin"


async def current_user(
    authorization: Annotated[str | None, Header()] = None,
) -> AuthUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing bearer token")

    token = authorization.split(" ", 1)[1].strip()
    secret = get_settings().supabase_jwt_secret
    if not secret:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "jwt secret not configured")

    try:
        claims = jwt.decode(token, secret, algorithms=["HS256"], audience="authenticated")
    except JWTError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"invalid token: {e}") from e

    return AuthUser(
        user_id=claims["sub"],
        email=claims.get("email"),
        role=claims.get("role", "authenticated"),
        raw_claims=claims,
    )


async def require_admin(user: Annotated[AuthUser, Depends(current_user)]) -> AuthUser:
    if not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "admin required")
    return user
