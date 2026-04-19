#!/usr/bin/env bash
# Minimal end-to-end smoke test against a running backend.
# Requires: jq, curl, a Supabase access token for a signed-in user.
# Usage:
#   export BACKEND=http://localhost:8000
#   export TOKEN=eyJ...  # Supabase access token (see /v1/auth/login)
#   ./scripts/smoke_test.sh

set -euo pipefail

: "${BACKEND:=http://localhost:8000}"
: "${TOKEN:?set TOKEN to a Supabase access token}"

hdr=(-H "Authorization: Bearer ${TOKEN}")

echo "==> /healthz"
curl -s "${BACKEND}/healthz" | jq .

echo "==> /v1/agents"
curl -s "${BACKEND}/v1/agents" | jq .

echo "==> /v1/auth/me"
curl -s "${BACKEND}/v1/auth/me" "${hdr[@]}" | jq .

echo "==> /v1/billing/me (before)"
curl -s "${BACKEND}/v1/billing/me" "${hdr[@]}" | jq .

echo "==> /v1/chat (fast)"
curl -s -X POST "${BACKEND}/v1/chat" "${hdr[@]}" \
  -H 'content-type: application/json' \
  -d '{"agent_code":"john","mode":"fast","message":"Manu - Leeds tonight, market read and upset path?"}' | jq .

echo "==> /v1/billing/me (after)"
curl -s "${BACKEND}/v1/billing/me" "${hdr[@]}" | jq .
