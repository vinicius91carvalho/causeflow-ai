#!/usr/bin/env bash
# AC-055 black-box: Ornith fail-closed behavior.
# Phase A — LLM_BASE_URL points at an unreachable :8081-class endpoint:
#   /health reports llm=degraded, triage fails closed, investigation status=failed.
# Phase B — mock Ornith on MOCK_LLM_PORT restores completions without Anthropic.
set -euo pipefail

PORT="${PORT:-5171}"
BASE="${BASE_URL:-http://127.0.0.1:${PORT}}"
MOCK_LLM_PORT="${MOCK_LLM_PORT:-18081}"
DOWN_LLM_URL="${DOWN_LLM_URL:-http://127.0.0.1:59999/v1}"
EVIDENCE="${EVIDENCE_LOG:-/tmp/wi-ac055-$$.log}"
: >"$EVIDENCE"

log() { echo "$1" | tee -a "$EVIDENCE"; }
fail() { log "FAIL: $1"; exit 1; }

MOCK_PID=""

cleanup_mock() {
  if [ -n "${MOCK_PID:-}" ] && kill -0 "$MOCK_PID" 2>/dev/null; then
    kill "$MOCK_PID" 2>/dev/null || true
    wait "$MOCK_PID" 2>/dev/null || true
  fi
}
trap cleanup_mock EXIT

start_mock_ornith() {
  node --input-type=module - "$MOCK_LLM_PORT" <<'NODE' &
import http from 'node:http';
const port = Number(process.argv[1] ?? 18081);
const server = http.createServer(async (req, res) => {
  if (req.url === '/v1/models' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: [{ id: 'Ornith-1.0-9B-code' }] }));
    return;
  }
  if (req.url === '/v1/chat/completions' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    const wantsJson = body.includes('json_object') || body.includes('Respond with a single JSON');
    const content = wantsJson
      ? JSON.stringify({
          priority: 'high',
          suggestedAgents: ['log_analyst', 'metric_analyst'],
          summary: 'AC-055 mock triage',
          confidence: 0.9,
          category: 'application',
          investigationMode: 'orchestrator',
        })
      : 'AC-055 mock completion';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      model: 'Ornith-1.0-9B-code',
      choices: [{ message: { content } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    }));
    return;
  }
  res.writeHead(404);
  res.end('not found');
});
server.listen(port, '127.0.0.1', () => process.stdout.write(`mock-ornith:${port}\n`));
NODE
  MOCK_PID=$!
  for _ in $(seq 1 20); do
    if curl -sS --max-time 1 "http://127.0.0.1:${MOCK_LLM_PORT}/v1/models" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.2
  done
  fail "mock Ornith did not start on :${MOCK_LLM_PORT}"
}

log "=== AC-055 verification BASE=$BASE DOWN_LLM=$DOWN_LLM_URL MOCK=$MOCK_LLM_PORT ==="

# --- Phase A: unreachable local LLM ---
HEALTH=$(curl -sS --max-time 5 "$BASE/health" || true)
log "health(ornith-down-config)=$HEALTH"
echo "$HEALTH" | grep -q '"llm":"degraded"' || fail "expected llm=degraded when connector unreachable"
echo "$HEALTH" | grep -q '"postgres":"ok"' || fail "postgres not ok"

EMAIL="ac055-$(date +%s)@example.com"
PASS="testpass123"
REG=$(curl -sS -w '\n%{http_code}' -X POST "$BASE/v1/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"tenantName\":\"AC055 Tenant\"}")
REG_BODY=$(echo "$REG" | sed '$d')
TOKEN=$(echo "$REG_BODY" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("token",""))')
[ -n "$TOKEN" ] || fail "no JWT from register"

INC=$(curl -sS -w '\n%{http_code}' -X POST "$BASE/v1/incidents" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"AC055 fail-closed","description":"Ornith down regression","severity":"critical"}')
INC_BODY=$(echo "$INC" | sed '$d')
INC_CODE=$(echo "$INC" | tail -1)
INCIDENT_ID=$(echo "$INC_BODY" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("incidentId",""))')
log "incident create code=$INC_CODE id=$INCIDENT_ID"
[ "$INC_CODE" = "201" ] || fail "incident create expected 201"
[ -n "$INCIDENT_ID" ] || fail "missing incidentId"

# Poll up to 30s — must not hang; should land on failed (triage fail-closed)
STATUS=""
for _ in $(seq 1 30); do
  ROW=$(curl -sS --max-time 5 -H "Authorization: Bearer $TOKEN" \
    "$BASE/v1/incidents/$INCIDENT_ID" || true)
  STATUS=$(echo "$ROW" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("status",""))' 2>/dev/null || true)
  log "poll status=$STATUS"
  if [ "$STATUS" = "failed" ]; then
    break
  fi
  if [ "$STATUS" = "resolved" ] || [ "$STATUS" = "investigating" ]; then
    fail "incident silently progressed to $STATUS with Ornith down"
  fi
  sleep 1
done
[ "$STATUS" = "failed" ] || fail "expected incident status=failed within 30s, got '$STATUS'"

INV=$(curl -sS --max-time 5 -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/v1/investigation/$INCIDENT_ID" || true)
log "investigation(ornith-down)=$INV"
echo "$INV" | grep -qi 'unavailable\|failed' || fail "investigation response lacks LLM-unavailable/failed signal"

log "Phase A passed: fail-closed with unreachable Ornith"

# --- Phase B: restart mock Ornith (operator restarts llama-session equivalent) ---
log "NOTE: Phase B requires app restarted with LLM_BASE_URL=http://127.0.0.1:${MOCK_LLM_PORT}/v1"
start_mock_ornith
log "mock Ornith listening on :$MOCK_LLM_PORT — restart API with that LLM_BASE_URL to complete Phase B"

log "PASS: AC-055 Phase A (fail-closed) verified"
