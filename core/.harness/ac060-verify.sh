#!/usr/bin/env bash
# AC-060 black-box: full investigation product loop on the local OSS stack.
# Test app (AC-058) → Ornith/DeepSeek connector (AC-059) → triage severity,
# investigation SSE progress, incident chat, root-cause + test-app evidence,
# remediation proposal. DeterministicLLMClient is not the happy-path proof.
set -euo pipefail

PORT="${PORT:-5171}"
TEST_PORT="${TEST_APP_PORT:-5192}"
BASE="${BASE_URL:-http://127.0.0.1:${PORT}}"
TEST_BASE="${TEST_APP_BASE_URL:-http://127.0.0.1:${TEST_PORT}}"
EVIDENCE="${EVIDENCE_LOG:-/tmp/wi-ac060-$$.log}"
TEST_PID=""
: >"$EVIDENCE"

log() { echo "$1" | tee -a "$EVIDENCE"; }
fail() { log "FAIL: $1"; exit 1; }

cleanup_test_app() {
  if [ -n "${TEST_PID:-}" ] && kill -0 "$TEST_PID" 2>/dev/null; then
    kill "$TEST_PID" 2>/dev/null || true
    wait "$TEST_PID" 2>/dev/null || true
  fi
}
trap cleanup_test_app EXIT

wait_health() {
  local url="$1"
  for _ in $(seq 1 30); do
    if curl -sS --max-time 1 "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.2
  done
  return 1
}

start_test_app() {
  if wait_health "$TEST_BASE/health"; then
    log "test app already healthy at $TEST_BASE"
    return 0
  fi
  setsid nohup env TEST_APP_PORT="$TEST_PORT" node test-app/server.mjs >>"$EVIDENCE" 2>&1 &
  TEST_PID=$!
  wait_health "$TEST_BASE/health" || fail "test app did not start on $TEST_BASE"
}

reset_ornith_connector() {
  # Clear stale Redis override from prior AC-059 runs (e.g. deepseek without mock).
  if command -v docker >/dev/null 2>&1; then
    docker exec core-redis-1 redis-cli SET causeflow:oss:llm-connector:active ornith >/dev/null 2>&1 \
      || docker exec "$(docker ps -qf name=redis)" redis-cli SET causeflow:oss:llm-connector:active ornith >/dev/null 2>&1 \
      || true
  fi
}

log "=== AC-060 verification BASE=$BASE TEST_APP=$TEST_BASE ==="

start_test_app
reset_ornith_connector

HEALTH=$(curl -sS --max-time 5 "$BASE/health" || true)
log "core_health=$HEALTH"
echo "$HEALTH" | grep -q '"postgres":"ok"' || fail "Core postgres not ok — start Core on PORT=$PORT (init.sh)"
echo "$HEALTH" | grep -q '"redis":"ok"' || fail "Core redis not ok"
echo "$HEALTH" | grep -qE '"llm":"ok"|"llm":"degraded"' || fail "unexpected llm health"

EMAIL="ac060-$(date +%s)@example.com"
PASS="testpass123"
REG=$(curl -sS -w '\n%{http_code}' -X POST "$BASE/v1/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"tenantName\":\"AC060 Golden Path\"}")
REG_BODY=$(echo "$REG" | sed '$d')
TOKEN=$(echo "$REG_BODY" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("token",""))')
TENANT_ID=$(echo "$REG_BODY" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("tenantId") or (d.get("tenant") or {}).get("id") or "")')
[ -n "$TOKEN" ] || fail "no JWT from register"
[ -n "$TENANT_ID" ] || fail "no tenantId from register"
log "tenantId=$TENANT_ID"

# Active connector — Ornith default (DeepSeek fallback configured via AC-059 env).
RESET=$(curl -sS -w '\n%{http_code}' -X PUT "$BASE/v1/oss/llm-connector" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"connector":"ornith"}')
RESET_CODE=$(echo "$RESET" | tail -1)
[ "$RESET_CODE" = "200" ] || fail "could not set active connector to ornith (code=$RESET_CODE)"

# 1. Connect test application (AC-058)
CONNECT=$(curl -sS -w '\n%{http_code}' -X POST "$BASE/v1/integrations/stub/connect" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"baseUrl\":\"$TEST_BASE\",\"coreBaseUrl\":\"$BASE\"}")
CONNECT_BODY=$(echo "$CONNECT" | sed '$d')
CONNECT_CODE=$(echo "$CONNECT" | tail -1)
log "stub/connect code=$CONNECT_CODE"
[ "$CONNECT_CODE" = "201" ] || fail "stub connect expected 201, got $CONNECT_CODE"
echo "$CONNECT_BODY" | grep -q 'stub-upstream' || fail "connect response missing stub-upstream"

# 2. Ingest incident from test app webhook
INGEST=$(curl -sS -w '\n%{http_code}' -X POST "$BASE/v1/integrations/stub/ingest" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"AC060 golden path alert","description":"order-service connection pool exhausted — causeflow-test-app evidence","priority":"P1"}')
INGEST_BODY=$(echo "$INGEST" | sed '$d')
INGEST_CODE=$(echo "$INGEST" | tail -1)
log "stub/ingest code=$INGEST_CODE body=$INGEST_BODY"
[ "$INGEST_CODE" = "202" ] || fail "stub ingest expected 202, got $INGEST_CODE"
INCIDENT_ID=$(echo "$INGEST_BODY" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("incidentId",""))')
[ -n "$INCIDENT_ID" ] || fail "no incidentId from test app ingest"
log "incidentId=$INCIDENT_ID"

# 3. SSE — investigation agent progress
SSE_LOG="/tmp/wi-ac060-sse-${INCIDENT_ID}.log"
: >"$SSE_LOG"
timeout 300 curl -sN -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/v1/investigation/${INCIDENT_ID}/stream" >"$SSE_LOG" 2>&1 &
SSE_PID=$!

# 4. Poll triage severity + investigation completion
SEVERITY=""
FINAL_STATUS=""
for i in $(seq 1 150); do
  ROW=$(curl -sS -H "Authorization: Bearer $TOKEN" "$BASE/v1/incidents/$INCIDENT_ID" || echo '{}')
  STATUS=$(echo "$ROW" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("status",""))' 2>/dev/null || true)
  SEV=$(echo "$ROW" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("severity",""))' 2>/dev/null || true)
  if [ -n "$SEV" ] && [ "$SEV" != "null" ]; then SEVERITY="$SEV"; fi
  log "poll $i status=$STATUS severity=$SEV"
  if [ "$STATUS" = "awaiting_approval" ] || [ "$STATUS" = "resolved" ]; then
    FINAL_STATUS="$STATUS"
    sleep 2
    break
  fi
  if [ "$STATUS" = "failed" ]; then
    RC=$(echo "$ROW" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("rootCause",""))' 2>/dev/null || true)
    kill "$SSE_PID" 2>/dev/null || true
    fail "investigation failed (rootCause=$RC)"
  fi
  sleep 2
done
kill "$SSE_PID" 2>/dev/null || true
wait "$SSE_PID" 2>/dev/null || true

[ -n "$SEVERITY" ] || fail "triage never assigned severity"
[ "$FINAL_STATUS" = "awaiting_approval" ] || [ "$FINAL_STATUS" = "resolved" ] \
  || fail "investigation did not complete (status=${FINAL_STATUS:-timeout})"
log "severity=$SEVERITY final_status=$FINAL_STATUS"

grep -q 'event: investigation_progress' "$SSE_LOG" \
  || fail "SSE stream missing investigation_progress events"
grep -qE 'event: investigation_completed|event: remediation_proposed' "$SSE_LOG" \
  || fail "SSE stream missing completion/remediation events"
log "sse_events=$(grep -c '^event:' "$SSE_LOG" || echo 0)"

# 5. Incident chat / ask completion (model-backed, not DeterministicLLMClient)
CHAT=$(curl -sS -w '\n%{http_code}' -X POST "$BASE/api/v1/investigation/${INCIDENT_ID}/chat" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"message":"What evidence from causeflow-test-app supports the root cause hypothesis?"}')
CHAT_BODY=$(echo "$CHAT" | sed '$d')
CHAT_CODE=$(echo "$CHAT" | tail -1)
log "chat code=$CHAT_CODE"
[ "$CHAT_CODE" = "200" ] || fail "incident chat expected 200, got $CHAT_CODE"
CHAT_RESPONSE=$(echo "$CHAT_BODY" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("response",""))')
[ -n "$CHAT_RESPONSE" ] || fail "chat returned empty response"
echo "$CHAT_RESPONSE" | grep -qi 'DeterministicLLMClient' && fail "chat used DeterministicLLMClient"
echo "$CHAT_RESPONSE" | grep -qi 'OSS stub — no Anthropic API key' && fail "chat fell back to OSS stub-only reply"
log "chat_response_len=${#CHAT_RESPONSE}"

# 6. Root-cause hypothesis + test-app evidence
INV=$(curl -sS -H "Authorization: Bearer $TOKEN" "$BASE/api/v1/investigation/${INCIDENT_ID}")
ROOT=$(echo "$INV" | python3 -c 'import sys,json; d=json.load(sys.stdin); print((d.get("incident") or {}).get("rootCause") or d.get("finalSynthesis") or "")')
[ -n "$ROOT" ] || fail "missing root cause on investigation"
echo "$ROOT" | grep -qi 'cannot be investigated' && fail "root cause is an error placeholder"
log "root_cause_preview=${ROOT:0:120}"

EV=$(curl -sS -H "Authorization: Bearer $TOKEN" "$BASE/api/v1/investigation/${INCIDENT_ID}/evidence")
log "evidence_bytes=$(echo "$EV" | wc -c)"
echo "$EV" | grep -qi 'causeflow-test-app' || fail "no evidence referencing causeflow-test-app"
echo "$EV" | grep -qiE 'Ornith-1\.0-9B-code|llm_completion|stub-upstream' \
  || fail "no Ornith/local LLM or test-app probe evidence"

# 7. Remediation proposal record
REM=$(curl -sS -w '\n%{http_code}' -H "Authorization: Bearer $TOKEN" \
  "$BASE/v1/remediation/${INCIDENT_ID}")
REM_BODY=$(echo "$REM" | sed '$d')
REM_CODE=$(echo "$REM" | tail -1)
log "remediation code=$REM_CODE body_preview=${REM_BODY:0:200}"
[ "$REM_CODE" = "200" ] || fail "remediation list expected 200, got $REM_CODE"
REM_COUNT=$(echo "$REM_BODY" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(len(d) if isinstance(d,list) else 0)')
[ "${REM_COUNT:-0}" -ge 1 ] || fail "expected ≥1 remediation proposal, got ${REM_COUNT:-0}"

log "PASS AC-060 golden-path incident=$INCIDENT_ID severity=$SEVERITY remediations=$REM_COUNT"
echo "EVIDENCE_LOG=$EVIDENCE"
exit 0
