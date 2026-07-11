#!/usr/bin/env bash
# AC-059 black-box: Ornith context overflow → switch to DeepSeek connector.
# Phase A: default ornith + context-too-large signal on overflow mock.
# Phase B: PUT /v1/oss/llm-connector deepseek-opencode → triage uses DeepSeek mock.
set -euo pipefail

PORT="${PORT:-5171}"
BASE="${BASE_URL:-http://127.0.0.1:${PORT}}"
ORNITH_PORT="${MOCK_ORNITH_PORT:-18081}"
DEEPSEEK_PORT="${MOCK_DEEPSEEK_PORT:-18082}"
EVIDENCE="${EVIDENCE_LOG:-/tmp/wi-ac059-$$.log}"
ORNITH_PID=""
DEEPSEEK_PID=""
: >"$EVIDENCE"

log() { echo "$1" | tee -a "$EVIDENCE"; }
fail() { log "FAIL: $1"; exit 1; }

cleanup_mocks() {
  for pid in "${ORNITH_PID:-}" "${DEEPSEEK_PID:-}"; do
    if [ -n "${pid:-}" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
    fi
  done
}
trap cleanup_mocks EXIT

start_mock_ornith_overflow() {
  if curl -sS --max-time 1 "http://127.0.0.1:${ORNITH_PORT}/v1/models" >/dev/null 2>&1; then
    log "mock Ornith already listening on :$ORNITH_PORT"
    return 0
  fi
  ORNITH_PORT="$ORNITH_PORT" node --input-type=module <<'NODE' &
import http from 'node:http';
const port = Number(process.env.ORNITH_PORT ?? 18081);
const server = http.createServer(async (req, res) => {
  if (req.url === '/v1/models' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: [{ id: 'Ornith-1.0-9B-code' }] }));
    return;
  }
  if (req.url === '/v1/chat/completions' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    const isTriage = body.includes('suggestedAgents') || body.includes('investigationMode');
    if (isTriage) {
      const content = JSON.stringify({
        priority: 'high',
        suggestedAgents: ['log_analyst', 'metric_analyst', 'change_detector', 'code_analyzer', 'infra_inspector', 'db_analyst'],
        summary: 'AC-059 mock ornith triage',
        confidence: 0.9,
        category: 'application',
        investigationMode: 'orchestrator',
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        model: 'Ornith-1.0-9B-code',
        choices: [{ message: { content } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }));
      return;
    }
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'maximum context length exceeded for Ornith-1.0-9B-code' } }));
    return;
  }
  res.writeHead(404);
  res.end('not found');
});
server.listen(port, '127.0.0.1');
NODE
  ORNITH_PID=$!
  for _ in $(seq 1 20); do
    curl -sS --max-time 1 "http://127.0.0.1:${ORNITH_PORT}/v1/models" >/dev/null 2>&1 && return 0
    sleep 0.2
  done
  fail "mock Ornith overflow server did not start"
}

start_mock_deepseek() {
  if curl -sS --max-time 1 "http://127.0.0.1:${DEEPSEEK_PORT}/v1/models" >/dev/null 2>&1; then
    log "mock DeepSeek already listening on :$DEEPSEEK_PORT"
    return 0
  fi
  DEEPSEEK_PORT="$DEEPSEEK_PORT" node --input-type=module <<'NODE' &
import http from 'node:http';
const port = Number(process.env.DEEPSEEK_PORT ?? 18082);
const server = http.createServer(async (req, res) => {
  if (req.url === '/v1/models' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: [{ id: 'deepseek-v4-flash-free' }] }));
    return;
  }
  if (req.url === '/v1/chat/completions' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    const isTriage = body.includes('suggestedAgents') || body.includes('investigationMode');
    const isSynthesis = body.includes('potentialRootCause') || body.includes('findings');
    let content;
    if (isTriage) {
      content = JSON.stringify({
        priority: 'high',
        suggestedAgents: ['log_analyst', 'metric_analyst'],
        summary: 'AC-059 DeepSeek triage',
        confidence: 0.9,
        category: 'application',
        investigationMode: 'orchestrator',
      });
    } else if (isSynthesis) {
      content = JSON.stringify({
        findings: [{ text: 'DeepSeek synthesis finding', evidenceIds: [] }],
        potentialRootCause: 'AC-059 DeepSeek root cause',
        recommendedActions: [],
        evidence: [],
      });
    } else {
      content = 'AC-059 DeepSeek completion';
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      model: 'deepseek-v4-flash-free',
      choices: [{ message: { content } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    }));
    return;
  }
  res.writeHead(404);
  res.end('not found');
});
server.listen(port, '127.0.0.1');
NODE
  DEEPSEEK_PID=$!
  for _ in $(seq 1 20); do
    curl -sS --max-time 1 "http://127.0.0.1:${DEEPSEEK_PORT}/v1/models" >/dev/null 2>&1 && return 0
    sleep 0.2
  done
  fail "mock DeepSeek server did not start"
}

log "=== AC-059 verification BASE=$BASE ORNITH=$ORNITH_PORT DEEPSEEK=$DEEPSEEK_PORT ==="

EMAIL="ac059-$(date +%s)@example.com"
PASS="testpass123"
REG=$(curl -sS -w '\n%{http_code}' -X POST "$BASE/v1/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"tenantName\":\"AC059 Tenant\"}")
REG_BODY=$(echo "$REG" | sed '$d')
TOKEN=$(echo "$REG_BODY" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("token",""))')
[ -n "$TOKEN" ] || fail "no JWT from register"

# Reset to Ornith default (clears any prior Redis override from earlier runs)
RESET=$(curl -sS -w '\n%{http_code}' -X PUT "$BASE/v1/oss/llm-connector" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"connector":"ornith"}')
RESET_CODE=$(echo "$RESET" | tail -1)
[ "$RESET_CODE" = "200" ] || fail "could not reset connector to ornith (code=$RESET_CODE)"

# Connector API — default ornith
CONN=$(curl -sS --max-time 5 -H "Authorization: Bearer $TOKEN" "$BASE/v1/oss/llm-connector" || true)
log "connector(default)=$CONN"
echo "$CONN" | grep -q '"id":"ornith"' || fail "expected default active connector ornith"
echo "$CONN" | grep -q 'deepseek-opencode' || fail "expected deepseek-opencode option"
echo "$CONN" | grep -q 'LLM_CONTEXT_TOO_LARGE' || fail "missing context overflow code"

# Phase A: overflow mock ornith — triage fails with documented code
start_mock_ornith_overflow
log "NOTE: Phase A expects Core running with LLM_BASE_URL=http://127.0.0.1:${ORNITH_PORT}/v1 LLM_CONNECTOR=ornith"

INC=$(curl -sS -w '\n%{http_code}' -X POST "$BASE/v1/incidents" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"AC059 overflow","description":"Context overflow regression","severity":"critical"}')
INC_BODY=$(echo "$INC" | sed '$d')
INCIDENT_ID=$(echo "$INC_BODY" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("incidentId",""))')
[ -n "$INCIDENT_ID" ] || fail "missing incidentId"

STATUS=""
for _ in $(seq 1 30); do
  ROW=$(curl -sS --max-time 5 -H "Authorization: Bearer $TOKEN" \
    "$BASE/v1/incidents/$INCIDENT_ID" || true)
  STATUS=$(echo "$ROW" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("status",""))' 2>/dev/null || true)
  log "poll status=$STATUS"
  if [ "$STATUS" = "failed" ]; then break; fi
  sleep 1
done
[ "$STATUS" = "failed" ] || fail "expected failed status after ornith context overflow, got '$STATUS'"

INV=$(curl -sS --max-time 5 -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/v1/investigation/$INCIDENT_ID" || true)
ROW=$(curl -sS --max-time 5 -H "Authorization: Bearer $TOKEN" \
  "$BASE/v1/incidents/$INCIDENT_ID" || true)
log "investigation(overflow)=$INV"
log "incident(overflow)=$ROW"
echo "$INV$ROW" | grep -qi 'LLM_CONTEXT_TOO_LARGE\|context window\|DeepSeek' \
  || fail "missing context-too-large / switch guidance in incident or investigation response"

log "Phase A passed: ornith overflow surfaced documented signal"

# Phase B: switch to DeepSeek mock — requires OPENCODE_API_KEY + OPENCODE_BASE_URL mock
start_mock_deepseek
SWITCH=$(curl -sS -w '\n%{http_code}' -X PUT "$BASE/v1/oss/llm-connector" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"connector":"deepseek-opencode"}')
SWITCH_BODY=$(echo "$SWITCH" | sed '$d')
SWITCH_CODE=$(echo "$SWITCH" | tail -1)
log "switch=$SWITCH_BODY code=$SWITCH_CODE"
if [ "$SWITCH_CODE" = "400" ]; then
  log "SKIP Phase B live switch — OPENCODE_API_KEY not configured (set OPENCODE_API_KEY=test OPENCODE_BASE_URL=http://127.0.0.1:${DEEPSEEK_PORT}/v1 and restart Core)"
  log "PASS AC-059 Phase A only (overflow signal + connector API)"
  exit 0
fi
[ "$SWITCH_CODE" = "200" ] || fail "connector switch expected 200, got $SWITCH_CODE"
echo "$SWITCH_BODY" | grep -q 'deepseek-v4-flash' || fail "switch response missing deepseek model"

EMAIL2="ac059b-$(date +%s)@example.com"
REG2=$(curl -sS -X POST "$BASE/v1/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL2\",\"password\":\"$PASS\",\"tenantName\":\"AC059 DeepSeek Tenant\"}")
TOKEN2=$(echo "$REG2" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("token",""))')

INC2=$(curl -sS -w '\n%{http_code}' -X POST "$BASE/v1/incidents" \
  -H "Authorization: Bearer $TOKEN2" \
  -H 'Content-Type: application/json' \
  -d '{"title":"AC059 deepseek","description":"Post-switch triage","severity":"high"}')
INC2_BODY=$(echo "$INC2" | sed '$d')
INCIDENT2=$(echo "$INC2_BODY" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("incidentId",""))')
[ -n "$INCIDENT2" ] || fail "missing second incidentId"

SEV=""
STATUS=""
for _ in $(seq 1 40); do
  ROW=$(curl -sS -H "Authorization: Bearer $TOKEN2" "$BASE/v1/incidents/$INCIDENT2" || true)
  SEV=$(echo "$ROW" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("severity",""))' 2>/dev/null || true)
  STATUS=$(echo "$ROW" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("status",""))' 2>/dev/null || true)
  log "poll2 severity=$SEV status=$STATUS"
  if [ "$STATUS" = "failed" ]; then fail "triage/investigation failed after DeepSeek switch"; fi
  if [ "$STATUS" = "investigating" ] || [ "$STATUS" = "triaged" ] || [ "$STATUS" = "awaiting_approval" ]; then break; fi
  sleep 1
done
[ "$STATUS" = "investigating" ] || [ "$STATUS" = "triaged" ] || [ "$STATUS" = "awaiting_approval" ] \
  || fail "DeepSeek path did not progress past triage (status=$STATUS)"

INV2=""
for _ in $(seq 1 30); do
  INV2=$(curl -sS -H "Authorization: Bearer $TOKEN2" "$BASE/api/v1/investigation/${INCIDENT2}" || true)
  echo "$INV2" | grep -qi 'log_analyst\|metric_analyst' && break
  sleep 1
done
log "investigation(deepseek)=$INV2"
echo "$INV2" | grep -qi 'LLM_CONTEXT_TOO_LARGE' && fail "post-switch investigation still reports Ornith context overflow"
echo "$INV2" | grep -qi 'log_analyst\|metric_analyst' || fail "investigation did not progress after DeepSeek switch"

ACTIVE=$(curl -sS -H "Authorization: Bearer $TOKEN2" "$BASE/v1/oss/llm-connector")
echo "$ACTIVE" | grep -q '"id":"deepseek-opencode"' || fail "active connector is not deepseek-opencode after switch"

log "PASS AC-059 ornith overflow + DeepSeek switch incident=$INCIDENT2"
echo "EVIDENCE_LOG=$EVIDENCE"
exit 0
