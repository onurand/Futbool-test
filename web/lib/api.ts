import { supabaseBrowser } from "@/lib/supabase";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

async function authHeader(): Promise<Record<string, string>> {
  const supa = supabaseBrowser();
  const { data } = await supa.auth.getSession();
  return data.session?.access_token
    ? { Authorization: `Bearer ${data.session.access_token}` }
    : {};
}

export type AgentCode = "john" | "carlos" | "hans" | "emre";

export type ToolCall = {
  name: string;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
};

export type ChatResponse = {
  agent: string;
  text: string;
  tool_calls: ToolCall[];
  stop_reason: string;
  usage: { input_tokens: number; output_tokens: number };
};

export type AgentInfo = {
  code: AgentCode;
  display_name: string;
  leagues: string[];
  status: "active" | "planned";
  required_packages: string[];
};

export async function listAgents(): Promise<AgentInfo[]> {
  const res = await fetch(`${API_BASE}/v1/agents`, { cache: "no-store" });
  if (!res.ok) throw new Error(`agents fetch failed: ${res.status}`);
  const json = await res.json();
  return json.agents;
}

export async function sendChat(
  agent: AgentCode,
  message: string
): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/v1/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeader()),
    },
    body: JSON.stringify({ agent_code: agent, message }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`chat failed (${res.status}): ${text}`);
  }
  return res.json();
}
