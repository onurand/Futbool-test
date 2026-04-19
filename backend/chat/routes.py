"""Chat endpoint.

Gates every request with:
1. Supabase JWT auth (current_user).
2. Agent access: user must hold a subscription that unlocks the agent,
   or the agent must be free-tier.
3. Token quota: debit tokens per call (1 fast / 5 sharp). Cache hits are
   free — the chat loop surfaces them via a `cache_hit` flag, but for
   simplicity Phase 2 charges based on the declared mode.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from agents.registry import REGISTRY, get_agent
from backend.auth.middleware import AuthUser, current_user
from backend.billing.tokens import (
    SpendReason,
    ensure_balance_row,
    require_spend,
    user_can_access_agent,
)
from backend.chat.claude_client import AgentReply, run_agent

router = APIRouter(prefix="/v1/chat", tags=["chat"])


class ChatRequest(BaseModel):
    agent_code: str = Field(default="john")
    message: str
    mode: str = Field(default="fast", pattern="^(fast|sharp)$")


class ToolCallOut(BaseModel):
    name: str
    args: dict
    result: dict


class ChatResponse(BaseModel):
    agent: str
    text: str
    tool_calls: list[ToolCallOut]
    stop_reason: str
    usage: dict
    tokens_charged: int
    tokens_balance: int


@router.post("", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    user: Annotated[AuthUser, Depends(current_user)],
) -> ChatResponse:
    if body.agent_code not in REGISTRY:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"unknown agent: {body.agent_code}")

    agent = get_agent(body.agent_code)
    if agent.status != "active":
        raise HTTPException(status.HTTP_409_CONFLICT, f"agent '{agent.code}' not active yet")

    ensure_balance_row(user.user_id)

    if not user_can_access_agent(user.user_id, agent.required_packages):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail={
                "code": "agent_locked",
                "agent": agent.code,
                "required_packages": list(agent.required_packages),
                "message": f"'{agent.display_name}' requires a subscription.",
            },
        )

    reason = SpendReason.SHARP_ANALYSIS if body.mode == "sharp" else SpendReason.FAST_PUNDIT
    new_balance = require_spend(user.user_id, reason, agent_code=agent.code)

    reply: AgentReply = await run_agent(agent, body.message)

    from backend.billing.tokens import COSTS
    return ChatResponse(
        agent=agent.code,
        text=reply.text,
        tool_calls=[
            ToolCallOut(name=tc.name, args=tc.args, result=tc.result)
            for tc in reply.tool_calls
        ],
        stop_reason=reply.stop_reason,
        usage={"input_tokens": reply.input_tokens, "output_tokens": reply.output_tokens},
        tokens_charged=COSTS[reason],
        tokens_balance=new_balance,
    )
