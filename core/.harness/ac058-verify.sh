#!/usr/bin/env bash
# AC-058 black-box: runnable test application for dashboard connect.
# Verifies compose-startable HTTP service: connect, probe, tool calls, webhook ingest.
set -euo pipefail

PORT="${PORT:-5171}"
TEST_PORT="${TEST_APP_PORT:-${STUB_UPSTREAM_PORT:-5190}}"
BASE="${BASE_URL:-http://127.0.0.1:${PORT}}"
TEST_BASE="${TEST_APP_BASE_URL:-${STUB_UPSTREAM_BASE_URL:-http://127.0.0.1:${TEST_PORT}}}"
EVIDENCE="${EVIDENCE_LOG:-/tmp/wi-ac058-$$.log}"
TEST_PID=""
COMPOSE_STARTED=0
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

start_test_app_node() {
  TEST_APP_PORT="$TEST_PORT" node test-app/server.mjs >>"$EVIDENCE" 2>&1 &
  TEST_PID=$!
  wait_health "$TEST_BASE/health" || fail "test app did not start on $TEST_BASE"
}

start_test_app_compose() {
  docker compose up -d causeflow-test-app >>"$EVIDENCE" 2>&1
  COMPOSE_STARTED=1
  wait_health "$TEST_BASE/health" || fail "compose test app did not become healthy on $TEST_BASE"
}

log "=== AC-058 verification BASE=$BASE TEST_APP=$TEST_BASE ==="

if [ "${AC058_USE_COMPOSE:-}" = "1" ]; then
  start_test_app_compose
else
  start_test_app_node
fi

HEALTH=$(curl -sS --max-time 5 "$TEST_BASE/health" || true)
log "test_app_health=$HEALTH"
echo "$HEALTH" | grep -q 'causeflow-test-app' || fail "health missing causeflow-test-app service id"

TOOLS=$(curl -sS --max-time 5 "$TEST_BASE/v1/tools")
log "tools=$TOOLS"
echo "$TOOLS" | grep -q 'query_logs' || fail "tools catalog missing query_logs"
echo "$TOOLS" | grep -q 'query_metrics' || fail "tools catalog missing query_metrics"

API_HEALTH=$(curl -sS --max-time 5 "$BASE/health" || true)
log "core_health=$API_HEALTH"
echo "$API_HEALTH" | grep -q '"postgres":"ok"' || fail "Core postgres not ok — start Core on PORT=$PORT"

EMAIL="ac058-$(date +%s)@example.com"
PASS="testpass123"
REG=$(curl -sS -w '\n%{http_code}' -X POST "$BASE/v1/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"tenantName\":\"AC058 Test App Tenant\"}")
REG_BODY=$(echo "$REG" | sed '$d')
TOKEN=$(echo "$REG_BODY" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("token",""))')
TENANT_ID=$(echo "$REG_BODY" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("tenantId") or (d.get("tenant") or {}).get("id") or "")')
[ -n "$TOKEN" ] || fail "no JWT from register"
[ -n "$TENANT_ID" ] || fail "no tenantId from register"
log "tenantId=$TENANT_ID"

# 1. Connect test app via Core stub integration routes
CONNECT=$(curl -sS -w '\n%{http_code}' -X POST "$BASE/v1/integrations/stub/connect" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"baseUrl\":\"$TEST_BASE\",\"coreBaseUrl\":\"$BASE\"}")
CONNECT_BODY=$(echo "$CONNECT" | sed '$d')
CONNECT_CODE=$(echo "$CONNECT" | tail -1)
log "stub/connect code=$CONNECT_CODE body=$CONNECT_BODY"
[ "$CONNECT_CODE" = "201" ] || fail "stub connect expected 201, got $CONNECT_CODE"
echo "$CONNECT_BODY" | grep -q 'stub-upstream' || fail "connect response missing stub-upstream provider"

STATE=$(curl -sS --max-time 5 "$TEST_BASE/v1/state")
log "state_after_connect=$STATE"
echo "$STATE" | grep -q 'causeflow-test-app' || fail "state missing causeflow-test-app app id"
CONN_COUNT=$(echo "$STATE" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("connectionCount",0))')
[ "${CONN_COUNT:-0}" -ge 1 ] || fail "test app missing connection after connect"

# 2. Probe — deterministic evidence
PROBE=$(curl -sS -w '\n%{http_code}' -X POST "$BASE/v1/integrations/stub/probe" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{}')
PROBE_BODY=$(echo "$PROBE" | sed '$d')
PROBE_CODE=$(echo "$PROBE" | tail -1)
log "stub/probe code=$PROBE_CODE body=$PROBE_BODY"
[ "$PROBE_CODE" = "200" ] || fail "stub probe expected 200, got $PROBE_CODE"
PROBE_COUNT=$(echo "$PROBE_BODY" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("probeCount",0))')
[ "${PROBE_COUNT:-0}" -ge 1 ] || fail "probeCount not incremented"

DIRECT_PROBE=$(curl -sS --max-time 5 -X POST "$TEST_BASE/v1/probe" \
  -H 'Content-Type: application/json' \
  -d "{\"tenantId\":\"$TENANT_ID\"}")
log "direct_probe=$DIRECT_PROBE"
echo "$DIRECT_PROBE" | grep -q 'order-service' || fail "probe evidence missing order-service"
echo "$DIRECT_PROBE" | grep -q 'causeflow-test-app' || fail "probe evidence missing causeflow-test-app"

# 3. Investigation tool call — deterministic evidence from test app
TOOL=$(curl -sS -w '\n%{http_code}' -X POST "$TEST_BASE/v1/tools/call" \
  -H 'Content-Type: application/json' \
  -d "{\"tenantId\":\"$TENANT_ID\",\"tool\":\"query_logs\",\"input\":{\"service\":\"order-service\"}}")
TOOL_BODY=$(echo "$TOOL" | sed '$d')
TOOL_CODE=$(echo "$TOOL" | tail -1)
log "tools/call code=$TOOL_CODE body=$TOOL_BODY"
[ "$TOOL_CODE" = "200" ] || fail "tool call expected 200, got $TOOL_CODE"
echo "$TOOL_BODY" | grep -q 'causeflow-test-app' || fail "tool evidence missing causeflow-test-app source"
echo "$TOOL_BODY" | grep -q 'Connection pool exhausted' || fail "tool output not deterministic"

STATE2=$(curl -sS --max-time 5 "$TEST_BASE/v1/state")
TOOL_COUNT=$(echo "$STATE2" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("toolCallCount",0))')
[ "${TOOL_COUNT:-0}" -ge 1 ] || fail "test app toolCallCount not observable"

# 4. Webhook ingest into Core
INGEST=$(curl -sS -w '\n%{http_code}' -X POST "$BASE/v1/integrations/stub/ingest" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"AC058 test application alert","description":"Golden path incident from causeflow-test-app","priority":"P1"}')
INGEST_BODY=$(echo "$INGEST" | sed '$d')
INGEST_CODE=$(echo "$INGEST" | tail -1)
log "stub/ingest code=$INGEST_CODE body=$INGEST_BODY"
[ "$INGEST_CODE" = "202" ] || fail "stub ingest expected 202, got $INGEST_CODE"
INCIDENT_ID=$(echo "$INGEST_BODY" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("incidentId",""))')
[ -n "$INCIDENT_ID" ] || fail "no incidentId from test app ingest"
log "incidentId=$INCIDENT_ID"

STATE3=$(curl -sS --max-time 5 "$TEST_BASE/v1/state")
INGEST_COUNT=$(echo "$STATE3" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("ingestCount",0))')
[ "${INGEST_COUNT:-0}" -ge 1 ] || fail "test app ingestCount not observable"

log "PASS AC-058 test-app connect probe tools ingest incidentId=$INCIDENT_ID toolCalls=$TOOL_COUNT"
echo "EVIDENCE_LOG=$EVIDENCE"
exit 0
