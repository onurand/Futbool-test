"""Futbool backend entry point.

Phase 1: auth + chat (with Claude tool-use loop against mock providers).
Phase 2: Stripe billing + token ledger + agent access gate.
Phase 3: admin routes.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.admin.routes import router as admin_router
from backend.auth.routes import router as auth_router
from backend.billing.routes import router as billing_router
from backend.chat.routes import router as chat_router
from backend.core.config import get_settings
from backend.matches.routes import router as matches_router

app = FastAPI(title="Futbool API", version="0.2.0")

_settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[_settings.web_base_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(matches_router)
app.include_router(chat_router)
app.include_router(billing_router)
app.include_router(admin_router)


@app.get("/healthz")
async def healthz() -> dict:
    return {"status": "ok", "phase": 2, "use_mock_providers": _settings.use_mock_providers}


@app.get("/v1/agents")
async def list_agents() -> dict:
    from agents.registry import REGISTRY
    return {
        "agents": [
            {
                "code": a.code,
                "display_name": a.display_name,
                "leagues": list(a.leagues),
                "status": a.status,
                "required_packages": list(a.required_packages),
            }
            for a in REGISTRY.values()
        ]
    }
