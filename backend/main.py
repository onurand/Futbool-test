"""Futbool backend entry point. Phase 0 placeholder.

Real wiring lands in Phase 1 (auth + tools) and Phase 2 (Stripe + tokens).
"""

from __future__ import annotations

from fastapi import FastAPI

app = FastAPI(title="Futbool API", version="0.0.1")


@app.get("/healthz")
async def healthz() -> dict:
    return {"status": "ok", "phase": 0}


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
