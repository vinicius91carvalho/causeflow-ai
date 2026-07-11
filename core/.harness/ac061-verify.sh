#!/usr/bin/env bash
# AC-061 — Core-side delivery gate for the dashboard golden path.
#
# Single harness-QA entry point (also: `pnpm verify:ac061`).
# Flow: boot test app → connect integration → select Ornith (or DeepSeek
# fallback) → ingest incident → assert triage + chat + root cause +
# remediation in Postgres AND the HTTP API.
#
# Prerequisites: Core API + investigation worker healthy on $PORT
# (e.g. `PORT=5170 ./init.sh`), Postgres/Redis compose up, Ornith on :8081
# (or DeepSeek credentials for fallback). DeterministicLLMClient is not
# accepted as the happy-path proof.
#
# Invoked by harness QA / Goal Review. Web AC-061 depends on this contract.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PORT="${PORT:-5170}"
TEST_PORT="${TEST_APP_PORT:-5193}"
BASE="${BASE_URL:-http://127.0.0.1:${PORT}}"
TEST_BASE="${TEST_APP_BASE_URL:-http://127.0.0.1:${TEST_PORT}}"
EVIDENCE="${EVIDENCE_LOG:-/tmp/wi-ac061-$$.log}"
TEST_PID=""
ACTIVE_CONNECTOR="ornith"
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
  log "test app started pid=$TEST_PID at $TEST_BASE"
}

pg_sql() {
  local sql="$1"
  if command -v docker >/dev/null 2>&1; then
    docker compose exec -T causeflow-postgres psql -U causeflow -d causeflow -tAc "$sql" 2>/dev/null \
      | tr -d '[:space:]' \
      || docker exec core-causeflow-postgres-1 psql -U causeflow -d causeflow -tAc "$sql" 2>/dev/null \
      | tr -d '[:space:]' \
      || echo ""
  else
    echo ""
  fi
}

select_llm_connector() {
  local token="$1"
  # Prefer Ornith; fall back to DeepSeek when Ornith is unreachable / health not ok.
  local health
  health=$(curl -sS --max-time 5 "$BASE/health" || echo '{}')
  local llm
  llm=$(echo "$health" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("llm",""))' 2>/dev/null || true)

  local connector="ornith"
  if [ "$llm" != "ok" ]; then
    # Ornith down or degraded — try DeepSeek profiles (AC-059).
    for candidate in deepseek-opencode deepseek-nim; do
      local try
      try=$(curl -sS -w '\n%{http_code}' -X PUT "$BASE/v1/oss/llm-connector" \
        -H "Authorization: Bearer $token" \
        -H 'Content-Type: application/json' \
        -d "{\"connector\":\"$candidate\"}" || true)
      local code
      code=$(echo "$try" | tail -1)
      if [ "$code" = "200" ]; then
        connector="$candidate"
        log "selected DeepSeek fallback connector=$connector (llm health was '$llm')"
        ACTIVE_CONNECTOR="$connector"
        return 0
      fi
    done
    log "WARN: Ornith llm='$llm' and DeepSeek switch failed — continuing with ornith"
  fi

  local reset
  reset=$(curl -sS -w '\n%{http_code}' -X PUT "$BASE/v1/oss/llm-connector" \
    -H "Authorization: Bearer $token" \
    -H 'Content-Type: application/json' \
    -d '{"connector":"ornith"}')
  local reset_code
  reset_code=$(echo "$reset" | tail -1)
  [ "$reset_code" = "200" ] || fail "could not set active connector to ornith (code=$reset_code)"
  ACTIVE_CONNECTOR="ornith"
  log "selected connector=ornith (llm health='$llm')"
}

log "=== AC-061 delivery gate BASE=$BASE TEST_APP=$TEST_BASE ==="

# 1. Boot test application
start_test_app

HEALTH=$(curl -sS --max-time 5 "$BASE/health" || true)
log "core_health=$HEALTH"
echo "$HEALTH" | grep -q '"postgres":"ok"' || fail "Core postgres not ok — start Core on PORT=$PORT (./init.sh)"
echo "$HEALTH" | grep -q '"redis":"ok"' || fail "Core redis not ok"
echo "$HEALTH" | grep -qE '"llm":"ok"|"llm":"degraded"' || fail "unexpected llm health — need Ornith or DeepSeek"

EMAIL="ac061-$(date +%s)@example.com"
PASS="testpass123"
REG=$(curl -sS -w '\n%{http_code}' -X POST "$BASE/v1/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"tenantName\":\"AC061 Golden Path Gate\"}")
REG_BODY=$(echo "$REG" | sed '$d')
TOKEN=$(echo "$REG_BODY" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("token",""))')
TENANT_ID=$(echo "$REG_BODY" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("tenantId") or (d.get("tenant") or {}).get("id") or "")')
[ -n "$TOKEN" ] || fail "no JWT from register"
[ -n "$TENANT_ID" ] || fail "no tenantId from register"
log "tenantId=$TENANT_ID"

# 2. Select Ornith (or DeepSeek fallback)
select_llm_connector "$TOKEN"

# Clear Redis override noise from prior AC-059 runs when staying on Ornith.
if [ "$ACTIVE_CONNECTOR" = "ornith" ] && command -v docker >/dev/null 2>&1; then
  docker exec core-redis-1 redis-cli SET causeflow:oss:llm-connector:active ornith >/dev/null 2>&1 \
    || docker exec "$(docker ps -qf name=redis)" redis-cli SET causeflow:oss:llm-connector:active ornith >/dev/null 2>&1 \
    || true
fi

# 3. Connect integration (test app)
CONNECT=$(curl -sS -w '\n%{http_code}' -X POST "$BASE/v1/integrations/stub/connect" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"baseUrl\":\"$TEST_BASE\",\"coreBaseUrl\":\"$BASE\"}")
CONNECT_BODY=$(echo "$CONNECT" | sed '$d')
CONNECT_CODE=$(echo "$CONNECT" | tail -1)
log "stub/connect code=$CONNECT_CODE"
[ "$CONNECT_CODE" = "201" ] || fail "stub connect expected 201, got $CONNECT_CODE"
echo "$CONNECT_BODY" | grep -qE 'stub-upstream|causeflow-test-app' || fail "connect response missing stub/test-app marker"

# 4. Ingest incident from test app
INGEST=$(curl -sS -w '\n%{http_code}' -X POST "$BASE/v1/integrations/stub/ingest" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"AC061 delivery-gate alert","description":"order-service connection pool exhausted — causeflow-test-app evidence","priority":"P1"}')
INGEST_BODY=$(echo "$INGEST" | sed '$d')
INGEST_CODE=$(echo "$INGEST" | tail -1)
log "stub/ingest code=$INGEST_CODE body=$INGEST_BODY"
[ "$INGEST_CODE" = "202" ] || fail "stub ingest expected 202, got $INGEST_CODE"
INCIDENT_ID=$(echo "$INGEST_BODY" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("incidentId",""))')
[ -n "$INCIDENT_ID" ] || fail "no incidentId from test app ingest"
log "incidentId=$INCIDENT_ID"

# SSE progress (contract for dashboard golden path)
SSE_LOG="/tmp/wi-ac061-sse-${INCIDENT_ID}.log"
: >"$SSE_LOG"
timeout 300 curl -sN -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/v1/investigation/${INCIDENT_ID}/stream" >"$SSE_LOG" 2>&1 &
SSE_PID=$!

# 5. Poll until triage + investigation complete
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
log "severity=$SEVERITY final_status=$FINAL_STATUS connector=$ACTIVE_CONNECTOR"

# 6. Incident chat completion (model-backed)
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

# Give chat persistence a moment
sleep 1

# 7. API — root cause + evidence + remediation
INV=$(curl -sS -H "Authorization: Bearer $TOKEN" "$BASE/api/v1/investigation/${INCIDENT_ID}")
ROOT=$(echo "$INV" | python3 -c 'import sys,json; d=json.load(sys.stdin); print((d.get("incident") or {}).get("rootCause") or d.get("finalSynthesis") or "")')
[ -n "$ROOT" ] || fail "missing root cause on investigation API"
echo "$ROOT" | grep -qi 'cannot be investigated' && fail "root cause is an error placeholder"
log "root_cause_preview=${ROOT:0:120}"

EV=$(curl -sS -H "Authorization: Bearer $TOKEN" "$BASE/api/v1/investigation/${INCIDENT_ID}/evidence")
echo "$EV" | grep -qi 'causeflow-test-app' || fail "API evidence missing causeflow-test-app reference"

REM=$(curl -sS -w '\n%{http_code}' -H "Authorization: Bearer $TOKEN" \
  "$BASE/v1/remediation/${INCIDENT_ID}")
REM_BODY=$(echo "$REM" | sed '$d')
REM_CODE=$(echo "$REM" | tail -1)
[ "$REM_CODE" = "200" ] || fail "remediation list expected 200, got $REM_CODE"
REM_COUNT=$(echo "$REM_BODY" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(len(d) if isinstance(d,list) else 0)')
[ "${REM_COUNT:-0}" -ge 1 ] || fail "expected ≥1 remediation proposal via API, got ${REM_COUNT:-0}"

# 8. Postgres — same artifacts (delivery-gate requirement)
PG_SEV=$(pg_sql "SELECT data->>'severity' FROM causeflow.incidents WHERE entity_id = '$INCIDENT_ID';")
[ -n "$PG_SEV" ] && [ "$PG_SEV" != "null" ] || fail "Postgres incident missing severity"
log "pg_severity=$PG_SEV"

PG_STATUS=$(pg_sql "SELECT data->>'status' FROM causeflow.incidents WHERE entity_id = '$INCIDENT_ID';")
echo "$PG_STATUS" | grep -qE 'awaiting_approval|resolved' \
  || fail "Postgres incident status not terminal (got '$PG_STATUS')"

PG_ROOT=$(pg_sql "SELECT COALESCE(NULLIF(data->>'rootCause',''),'') FROM causeflow.incidents WHERE entity_id = '$INCIDENT_ID';")
[ -n "$PG_ROOT" ] || fail "Postgres incident missing rootCause"
echo "$PG_ROOT" | grep -qi 'cannot be investigated' && fail "Postgres rootCause is error placeholder"

PG_HY=$(pg_sql "SELECT count(*) FROM causeflow.hypotheses WHERE data->>'incidentId' = '$INCIDENT_ID';")
[ "${PG_HY:-0}" -ge 1 ] || fail "expected ≥1 Postgres hypothesis row, got ${PG_HY:-0}"

PG_CHAT=$(pg_sql "SELECT count(*) FROM causeflow.chat_messages WHERE data->>'chatId' = 'investigation-$INCIDENT_ID' AND data->>'role' = 'assistant';")
[ "${PG_CHAT:-0}" -ge 1 ] || fail "expected ≥1 Postgres assistant chat row, got ${PG_CHAT:-0}"

PG_REM=$(pg_sql "SELECT count(*) FROM causeflow.remediation WHERE data->>'incidentId' = '$INCIDENT_ID';")
[ "${PG_REM:-0}" -ge 1 ] || fail "expected ≥1 Postgres remediation row, got ${PG_REM:-0}"

PG_EV=$(pg_sql "SELECT count(*) FROM causeflow.evidence WHERE data->>'incidentId' = '$INCIDENT_ID';")
[ "${PG_EV:-0}" -ge 1 ] || fail "expected ≥1 Postgres evidence row, got ${PG_EV:-0}"

log "PASS AC-061 delivery-gate incident=$INCIDENT_ID severity=$SEVERITY connector=$ACTIVE_CONNECTOR remediations=$REM_COUNT pg_hyp=$PG_HY pg_chat=$PG_CHAT pg_rem=$PG_REM pg_ev=$PG_EV"
echo "EVIDENCE_LOG=$EVIDENCE"
exit 0
