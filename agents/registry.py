"""Agent registry. Each agent maps a persona to a league scope and access policy.

Add new agents here as they come online. The backend resolves which agent to use
based on the user's question, the league scope, and the user's active subscription.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"


@dataclass(frozen=True)
class Agent:
    code: str                       # short id, e.g. "john"
    display_name: str               # "John"
    leagues: tuple[str, ...]        # e.g. ("Premier League", "Championship")
    prompt_file: str                # filename under prompts/
    required_packages: tuple[str, ...]  # subscription codes that unlock this agent
    status: str = "active"          # "active" | "planned"
    extra: dict = field(default_factory=dict)

    @property
    def system_prompt(self) -> str:
        return (PROMPTS_DIR / self.prompt_file).read_text(encoding="utf-8")


REGISTRY: dict[str, Agent] = {
    "john": Agent(
        code="john",
        display_name="John",
        leagues=("Premier League", "Championship"),
        prompt_file="john.md",
        required_packages=("england_pack", "all_leagues_pro"),
        status="active",
    ),
    # Planned — placeholders, no prompt files yet.
    "carlos": Agent(
        code="carlos",
        display_name="Carlos",
        leagues=("La Liga",),
        prompt_file="carlos.md",
        required_packages=("spain_pack", "all_leagues_pro"),
        status="planned",
    ),
    "hans": Agent(
        code="hans",
        display_name="Hans",
        leagues=("Bundesliga",),
        prompt_file="hans.md",
        required_packages=("germany_pack", "all_leagues_pro"),
        status="planned",
    ),
    "emre": Agent(
        code="emre",
        display_name="Emre",
        leagues=("Süper Lig",),
        prompt_file="emre.md",
        required_packages=("turkiye_pack", "all_leagues_pro"),
        status="planned",
    ),
}


def get_agent(code: str) -> Agent:
    if code not in REGISTRY:
        raise KeyError(f"Unknown agent: {code}")
    return REGISTRY[code]


def active_agents() -> list[Agent]:
    return [a for a in REGISTRY.values() if a.status == "active"]
