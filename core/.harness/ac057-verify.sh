#!/usr/bin/env bash
# AC-057 black-box: capstone local pipeline — stub connector + Ornith LLM + Hindsight.
# Exercises stub connect → probe → ingest (or POST /v1/incidents), triage → investigation,
# evidence attributable to stub-upstream and ≥1 Ornith completion, plus Hindsight retain.
set -euo pipefail

PORT="${PORT:-5171}"
STUB_PORT="${STUB_UPSTREAM_PORT:-5190}"
BASE="${BASE_URL:-http://127.0.0.1:${PORT}}"
STUB_BASE="${STUB_UPSTREAM_BASE_URL:-http://127.0.0.1:${STUB_PORT}}"
PGURL="${DATABASE_URL_HOST:-postgresql://causeflow:causeflow@127.0.0.1:5439/causeflow}"
HINDSIGHT="${HINDSIGHT_BASE_URL_HOST:-http://127.0.0.1:8888}"
EVIDENCE="${EVIDENCE_LOG:-/tmp/wi-ac057-$$.log}"
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

log "=== AC-057 verification BASE=$BASE STUB=$STUB_BASE ==="

start_stub_upstream

HEALTH=$(curl -sS --max-time 5 "$BASE/health" || true)
log "health=$HEALTH"
echo "$HEALTH" | grep -q '"postgres":"ok"' || fail "postgres not ok"
echo "$HEALTH" | grep -q '"redis":"ok"' || fail "redis not ok"
echo "$HEALTH" | grep -q '"llm":"ok"' || fail "expected llm=ok (Ornith must be reachable for AC-057)"

EMAIL="ac057-$(date +%s)@example.com"
PASS="testpass123"
REG=$(curl -sS -w '\n%{http_code}' -X POST "$BASE/v1/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"tenantName\":\"AC057 Capstone Tenant\"}")
REG_BODY=$(echo "$REG" | sed '$d')
TOKEN=$(echo "$REG_BODY" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("token",""))')
TENANT_ID=$(echo "$REG_BODY" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("tenantId") or (d.get("tenant") or {}).get("id") or "")')
[ -n "$TOKEN" ] || fail "no JWT from register"
[ -n "$TENANT_ID" ] || fail "no tenantId from register"
log "tenantId=$TENANT_ID"

# 1. Connect stub integration
CONNECT=$(curl -sS -w '\n%{http_code}' -X POST "$BASE/v1/integrations/stub/connect" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"baseUrl\":\"$STUB_BASE\",\"coreBaseUrl\":\"$BASE\"}")
CONNECT_CODE=$(echo "$CONNECT" | tail -1)
[ "$CONNECT_CODE" = "201" ] || fail "stub connect expected 201, got $CONNECT_CODE"

# 2. Probe stub (observable upstream state)
PROBE=$(curl -sS -w '\n%{http_code}' -X POST "$BASE/v1/integrations/stub/probe" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{}')
PROBE_CODE=$(echo "$PROBE" | tail -1)
[ "$PROBE_CODE" = "200" ] || fail "stub probe expected 200"

# 3. Ingest via stub connector → incident
INGEST=$(curl -sS -w '\n%{http_code}' -X POST "$BASE/v1/integrations/stub/ingest" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"AC057 capstone stub alert","description":"Capstone OSS pipeline with Ornith and stub upstream","priority":"P1"}')
INGEST_BODY=$(echo "$INGEST" | sed '$d')
INGEST_CODE=$(echo "$INGEST" | tail -1)
[ "$INGEST_CODE" = "202" ] || fail "stub ingest expected 202, got $INGEST_CODE"
INCIDENT_ID=$(echo "$INGEST_BODY" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("incidentId",""))')
[ -n "$INCIDENT_ID" ] || fail "no incidentId from stub ingest"
log "incidentId=$INCIDENT_ID (stub ingest path)"

# 4. Poll triage + investigation completion
SEVERITY=""
FINAL_STATUS=""
for i in $(seq 1 150); do
  RESP=$(curl -sS -H "Authorization: Bearer $TOKEN" "$BASE/api/v1/investigation/${INCIDENT_ID}" || echo '{}')
  STATUS=$(echo "$RESP" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("status",""))' 2>/dev/null || true)
  INC_STATUS=$(echo "$RESP" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("incident",{}).get("status",""))' 2>/dev/null || true)
  SEV=$(echo "$RESP" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("incident",{}).get("severity",""))' 2>/dev/null || true)
  if [ -n "$SEV" ] && [ "$SEV" != "null" ]; then SEVERITY="$SEV"; fi
  log "poll $i run_status=$STATUS incident_status=$INC_STATUS severity=$SEV"
  if [ "$STATUS" = "succeeded" ] || [ "$INC_STATUS" = "resolved" ] || [ "$INC_STATUS" = "awaiting_approval" ]; then
    FINAL_STATUS="${STATUS:-$INC_STATUS}"
    sleep 3
    break
  fi
  if [ "$STATUS" = "failed" ] || [ "$INC_STATUS" = "failed" ]; then
    log "investigation response=$RESP"
    fail "investigation failed before completion"
  fi
  sleep 2
done

[ -n "$SEVERITY" ] || fail "triage never set severity"
log "severity_set=$SEVERITY final_status=$FINAL_STATUS"

# 5. Evidence: stub-upstream attribution
EV=$(curl -sS -H "Authorization: Bearer $TOKEN" "$BASE/api/v1/investigation/${INCIDENT_ID}/evidence")
log "evidence_api=$EV"
echo "$EV" | grep -qi 'stub-upstream' || fail "no stub-upstream attributable evidence"

# 6. Evidence: ≥1 Ornith / local LLM completion
echo "$EV" | grep -qiE 'Ornith-1\.0-9B-code|llm_completion' || fail "no Ornith/local LLM completion attributable evidence"
ORNITH_OK=$(EV_JSON="$EV" python3 -c '
import json, os
d = json.loads(os.environ["EV_JSON"])
items = []
if isinstance(d, dict):
    for arr in d.get("evidenceByAgent", {}).values():
        items.extend(arr or [])
for ev in items:
    meta = ev.get("metadata") or {}
    model = str(meta.get("llmModel", ""))
    source = str(meta.get("source", ""))
    content = str(ev.get("content", ""))
    if "Ornith" in model or source == "llm_completion" or "Ornith" in content:
        print("yes")
        break
')
[ -n "${ORNITH_OK:-}" ] || fail "could not find Ornith completion in evidence metadata"

# 7. Postgres rows for evidence
PG_EV=$(docker compose exec -T causeflow-postgres psql -U causeflow -d causeflow -tAc \
  "SELECT count(*) FROM causeflow.evidence WHERE data->>'incidentId' = '$INCIDENT_ID';" 2>/dev/null | tr -d '[:space:]' || echo 0)
[ "${PG_EV:-0}" -ge 2 ] || fail "expected ≥2 evidence rows (stub + Ornith), got ${PG_EV:-0}"

# 8. Hindsight write (AC-052)
BANK="causeflow-${TENANT_ID}"
RECALL=$(curl -sS -X POST "$HINDSIGHT/v1/default/banks/${BANK}/memories/recall" \
  -H 'Content-Type: application/json' \
  -d "{\"query\":\"AC057 capstone stub alert order-service root cause runbook\",\"budget\":\"mid\"}" || echo '{}')
log "hindsight_recall=$RECALL"
echo "$RECALL" | grep -qiE 'root cause|investigation|AC057|order-service|runbook|Findings|capstone' \
  || fail "Hindsight recall did not return investigation/runbook content"

log "PASS AC-057 stub+ornith+hindsight incident=$INCIDENT_ID severity=$SEVERITY evidence_rows=$PG_EV"
echo "EVIDENCE_LOG=$EVIDENCE"
exit 0
