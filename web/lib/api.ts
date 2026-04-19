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
  message: string,
  mode: "fast" | "sharp" = "fast"
): Promise<ChatResponse & { tokens_charged: number; tokens_balance: number }> {
  const res = await fetch(`${API_BASE}/v1/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeader()),
    },
    body: JSON.stringify({ agent_code: agent, message, mode }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`chat failed (${res.status}): ${text}`);
  }
  return res.json();
}

// -------------------- Matches --------------------

export type ApiTeam = { id: string; name: string; short?: string };
export type ApiMatch = {
  id: string;
  league: string;
  league_short?: string;
  kickoff_utc: string;
  status: string;
  home: ApiTeam;
  away: ApiTeam;
};

export async function listMatches(): Promise<{ fixtures: ApiMatch[]; source: string }> {
  const res = await fetch(`${API_BASE}/v1/matches`, { cache: "no-store" });
  if (!res.ok) throw new Error(`matches failed (${res.status})`);
  return res.json();
}

export async function getMatch(id: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}/v1/matches/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`match ${id} failed (${res.status})`);
  return res.json();
}

export async function getMatchOdds(id: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}/v1/matches/${id}/odds`, { cache: "no-store" });
  if (!res.ok) throw new Error(`match odds failed (${res.status})`);
  return res.json();
}

// -------------------- Billing --------------------

export type BillingMe = {
  balance: number;
  monthly_grant: number;
  last_reset_at: string | null;
  active_packages: string[];
};

export async function billingMe(): Promise<BillingMe> {
  const res = await fetch(`${API_BASE}/v1/billing/me`, {
    headers: { ...(await authHeader()) },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`billing/me failed (${res.status})`);
  return res.json();
}

export async function createCheckout(packageCode: string): Promise<{ url: string }> {
  const res = await fetch(`${API_BASE}/v1/billing/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeader()),
    },
    body: JSON.stringify({ package_code: packageCode }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`checkout failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function openCustomerPortal(): Promise<{ url: string }> {
  const res = await fetch(`${API_BASE}/v1/billing/portal`, {
    method: "POST",
    headers: { ...(await authHeader()) },
  });
  if (!res.ok) throw new Error(`portal failed (${res.status})`);
  return res.json();
}

// -------------------- Admin --------------------

export type AdminProduct = {
  id: string;
  code: string;
  name: string;
  leagues: string[];
  monthly_tokens: number;
  price_cents: number;
  interval: string;
  stripe_price_id: string | null;
  is_active: boolean;
};

export type AdminUser = {
  id: string;
  email: string;
  role: "user" | "admin";
  tier: string;
  created_at: string;
};

export type LedgerEntry = {
  id: number;
  user_id: string;
  delta: number;
  reason: string;
  agent_code: string | null;
  created_at: string;
};

export type AdminAnalytics = {
  total_users: number;
  active_subscriptions: number;
  recent_tokens_spent_by_agent: Record<string, number>;
  recent_spend_by_reason: Record<string, number>;
};

async function adminGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}/v1/admin${path}`, {
    headers: { ...(await authHeader()) },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`admin ${path} failed (${res.status})`);
  return res.json();
}

async function adminPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}/v1/admin${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`admin PATCH ${path} failed: ${text}`);
  }
  return res.json();
}

export async function adminListProducts() {
  return adminGet<{ products: AdminProduct[] }>("/products");
}
export async function adminUpdateProduct(code: string, body: Partial<AdminProduct>) {
  return adminPatch<{ product: AdminProduct }>(`/products/${code}`, body);
}
export async function adminListUsers(q?: string) {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  return adminGet<{ users: AdminUser[] }>(`/users${qs}`);
}
export async function adminListLedger() {
  return adminGet<{ ledger: LedgerEntry[] }>("/ledger");
}
export async function adminAnalytics() {
  return adminGet<AdminAnalytics>("/analytics");
}
