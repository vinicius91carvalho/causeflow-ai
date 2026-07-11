#!/usr/bin/env bash
# AC-056 black-box: OSS stub upstream connect + probe + ingest without Composio.
set -euo pipefail

PORT="${PORT:-5171}"
STUB_PORT="${STUB_UPSTREAM_PORT:-5190}"
BASE="${BASE_URL:-http://127.0.0.1:${PORT}}"
STUB_BASE="${STUB_UPSTREAM_BASE_URL:-http://127.0.0.1:${STUB_PORT}}"
EVIDENCE="${EVIDENCE_LOG:-/tmp/wi-ac056-$$.log}"
STUB_PID=""
: >"$EVIDENCE"

log() { echo "$1" | tee -a "$EVIDENCE"; }
fail() { log "FAIL: $1"; exit 1; }

cleanup_stub() {
  if [ -n "${STUB_PID:-}" ] && kill -0 "$STUB_PID" 2>/dev/null; then
    kill "$STUB_PID" 2>/dev/null || true
    wait "$STUB_PID" 2>/dev/null || true
  fi
}
trap cleanup_stub EXIT

start_stub_upstream() {
  STUB_UPSTREAM_PORT="$STUB_PORT" node stub-upstream/server.mjs >>"$EVIDENCE" 2>&1 &
  STUB_PID=$!
  for _ in $(seq 1 30); do
    if curl -sS --max-time 1 "$STUB_BASE/health" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.2
  done
  fail "stub upstream did not start on $STUB_BASE"
}

log "=== AC-056 verification BASE=$BASE STUB=$STUB_BASE ==="

start_stub_upstream

HEALTH=$(curl -sS --max-time 5 "$BASE/health" || true)
log "health=$HEALTH"
echo "$HEALTH" | grep -q '"postgres":"ok"' || fail "postgres not ok"

EMAIL="ac056-$(date +%s)@example.com"
PASS="testpass123"
REG=$(curl -sS -w '\n%{http_code}' -X POST "$BASE/v1/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"tenantName\":\"AC056 Tenant\"}")
REG_BODY=$(echo "$REG" | sed '$d')
TOKEN=$(echo "$REG_BODY" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("token",""))')
TENANT_ID=$(echo "$REG_BODY" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("tenantId") or (d.get("tenant") or {}).get("id") or "")')
[ -n "$TOKEN" ] || fail "no JWT from register"
[ -n "$TENANT_ID" ] || fail "no tenantId from register"
log "tenantId=$TENANT_ID"

# 1. Connect stub integration via Core (records tenant connection in Postgres)
CONNECT=$(curl -sS -w '\n%{http_code}' -X POST "$BASE/v1/integrations/stub/connect" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"baseUrl\":\"$STUB_BASE\",\"coreBaseUrl\":\"$BASE\"}")
CONNECT_BODY=$(echo "$CONNECT" | sed '$d')
CONNECT_CODE=$(echo "$CONNECT" | tail -1)
log "stub/connect code=$CONNECT_CODE body=$CONNECT_BODY"
[ "$CONNECT_CODE" = "201" ] || fail "stub connect expected 201, got $CONNECT_CODE"
echo "$CONNECT_BODY" | grep -q 'stub-upstream' || fail "connect response missing stub-upstream provider"

STUB_STATE=$(curl -sS --max-time 5 "$STUB_BASE/v1/state")
log "stub_state_after_connect=$STUB_STATE"
CONN_COUNT=$(echo "$STUB_STATE" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("connectionCount",0))')
[ "${CONN_COUNT:-0}" -ge 1 ] || fail "stub upstream missing connection after connect"

# 2. List integrations — tenant connection visible
LIST=$(curl -sS -H "Authorization: Bearer $TOKEN" "$BASE/v1/integrations")
log "integrations=$LIST"
echo "$LIST" | grep -q 'stub-upstream' || fail "integration list missing stub-upstream"

# 3. Probe stub upstream (observable in stub state)
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

STUB_STATE2=$(curl -sS --max-time 5 "$STUB_BASE/v1/state")
log "stub_state_after_probe=$STUB_STATE2"
PROBE_STATE_COUNT=$(echo "$STUB_STATE2" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("probeCount",0))')
[ "${PROBE_STATE_COUNT:-0}" -ge 1 ] || fail "stub upstream probeCount not observable"

# 4. Ingest via stub (webhook into Core)
INGEST=$(curl -sS -w '\n%{http_code}' -X POST "$BASE/v1/integrations/stub/ingest" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"AC056 stub connector alert","priority":"P1"}')
INGEST_BODY=$(echo "$INGEST" | sed '$d')
INGEST_CODE=$(echo "$INGEST" | tail -1)
log "stub/ingest code=$INGEST_CODE body=$INGEST_BODY"
[ "$INGEST_CODE" = "202" ] || fail "stub ingest expected 202, got $INGEST_CODE"
INCIDENT_ID=$(echo "$INGEST_BODY" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("incidentId",""))')
[ -n "$INCIDENT_ID" ] || fail "no incidentId from stub ingest"
log "incidentId=$INCIDENT_ID"

STUB_STATE3=$(curl -sS --max-time 5 "$STUB_BASE/v1/state")
log "stub_state_after_ingest=$STUB_STATE3"
INGEST_STATE_COUNT=$(echo "$STUB_STATE3" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("ingestCount",0))')
[ "${INGEST_STATE_COUNT:-0}" -ge 1 ] || fail "stub upstream ingestCount not observable"

log "PASS AC-056 probeCount=$PROBE_COUNT incidentId=$INCIDENT_ID"
echo "EVIDENCE_LOG=$EVIDENCE"
exit 0
