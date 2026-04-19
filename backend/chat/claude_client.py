"""Claude tool-use loop.

Given a user message and an agent (persona), this module:
1. Sends the conversation + tool schemas to Claude.
2. Whenever Claude returns a `tool_use` block, dispatches the named tool.
3. Feeds the `tool_result` back and continues until Claude stops.

Keeps transcripts of which tools fired and with what args, so downstream
validators can confirm every numeric claim in the final answer is backed by a
tool result (anti-hallucination guard, Phase 4).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from anthropic import AsyncAnthropic

from agents.registry import Agent
from backend.chat.tools import dispatch, load_tool_schemas
from backend.core.config import get_settings

MAX_TOOL_ITERATIONS = 8  # safety cap


@dataclass
class ToolCallRecord:
    name: str
    args: dict[str, Any]
    result: dict[str, Any]


@dataclass
class AgentReply:
    text: str
    tool_calls: list[ToolCallRecord] = field(default_factory=list)
    stop_reason: str = "end_turn"
    input_tokens: int = 0
    output_tokens: int = 0


async def run_agent(agent: Agent, user_message: str) -> AgentReply:
    s = get_settings()
    if not s.anthropic_api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not configured")

    client = AsyncAnthropic(api_key=s.anthropic_api_key)
    tools = load_tool_schemas()
    messages: list[dict[str, Any]] = [{"role": "user", "content": user_message}]
    record = AgentReply(text="")

    for _ in range(MAX_TOOL_ITERATIONS):
        resp = await client.messages.create(
            model=s.claude_model,
            max_tokens=2048,
            system=agent.system_prompt,
            tools=tools,
            messages=messages,
        )
        record.input_tokens += resp.usage.input_tokens
        record.output_tokens += resp.usage.output_tokens
        record.stop_reason = resp.stop_reason or "end_turn"

        if resp.stop_reason != "tool_use":
            # Final answer.
            record.text = "".join(
                block.text for block in resp.content if getattr(block, "type", None) == "text"
            )
            return record

        # Append the assistant's tool-use turn, run the tools, then reply with results.
        messages.append({"role": "assistant", "content": [b.model_dump() for b in resp.content]})

        tool_results = []
        for block in resp.content:
            if getattr(block, "type", None) != "tool_use":
                continue
            result = await dispatch(block.name, block.input or {})
            record.tool_calls.append(
                ToolCallRecord(name=block.name, args=block.input or {}, result=result)
            )
            tool_results.append(
                {
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": [{"type": "text", "text": _safe_dumps(result)}],
                }
            )
        messages.append({"role": "user", "content": tool_results})

    record.text = "[exceeded tool-use iteration cap]"
    record.stop_reason = "max_iterations"
    return record


def _safe_dumps(obj: Any) -> str:
    import json

    return json.dumps(obj, default=str)
