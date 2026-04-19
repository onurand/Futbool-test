"""Chat endpoint. Phase 1: auth-gated, runs the Claude tool-use loop.

Phase 2 will add: token debit (quota middleware), agent access control based on
active subscription, and persisting the conversation to `conversations` /
`messages` tables.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from agents.registry import REGISTRY, get_agent
from backend.auth.middleware import AuthUser, current_user
from backend.chat.claude_client import AgentReply, run_agent

router = APIRouter(prefix="/v1/chat", tags=["chat"])


class ChatRequest(BaseModel):
    agent_code: str = Field(default="john")
    message: str


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

    reply: AgentReply = await run_agent(agent, body.message)

    return ChatResponse(
        agent=agent.code,
        text=reply.text,
        tool_calls=[
            ToolCallOut(name=tc.name, args=tc.args, result=tc.result)
            for tc in reply.tool_calls
        ],
        stop_reason=reply.stop_reason,
        usage={"input_tokens": reply.input_tokens, "output_tokens": reply.output_tokens},
    )
