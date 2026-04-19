"""Auth endpoints. Supabase handles the hard parts; we expose thin wrappers
for clients that prefer going through our API, plus a /me helper.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr

from backend.auth.middleware import AuthUser, current_user
from backend.core.supabase_client import admin_client

router = APIRouter(prefix="/v1/auth", tags=["auth"])


class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: str | None = None


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    user_id: str
    email: EmailStr


@router.post("/signup", response_model=AuthResponse)
async def signup(body: SignupRequest) -> AuthResponse:
    client = admin_client()
    try:
        result = client.auth.sign_up({"email": body.email, "password": body.password})
    except Exception as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e

    if not result.session or not result.user:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "signup failed (check email confirmation)")

    return AuthResponse(
        access_token=result.session.access_token,
        refresh_token=result.session.refresh_token,
        user_id=result.user.id,
        email=result.user.email,  # type: ignore[arg-type]
    )


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest) -> AuthResponse:
    client = admin_client()
    try:
        result = client.auth.sign_in_with_password(
            {"email": body.email, "password": body.password}
        )
    except Exception as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(e)) from e

    if not result.session:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid credentials")

    return AuthResponse(
        access_token=result.session.access_token,
        refresh_token=result.session.refresh_token,
        user_id=result.user.id,
        email=result.user.email,  # type: ignore[arg-type]
    )


@router.get("/me")
async def me(user: Annotated[AuthUser, Depends(current_user)]) -> dict:
    return {
        "user_id": user.user_id,
        "email": user.email,
        "is_admin": user.is_admin,
    }
