#!/usr/bin/env bash
# AC-046 black-box: full local-only pipeline regression (webhook → dedup → triage →
# investigation SSE → Postgres evidence/hypothesis → Hindsight runbook).
# Zero SaaS credentials required.
set -euo pipefail

PORT="${PORT:-5176}"
BASE="${BASE_URL:-http://127.0.0.1:${PORT}}"
WEBHOOK_SECRET="${WEBHOOK_SECRET:-oss-dev-webhook-secret}"
PGURL="${DATABASE_URL_HOST:-postgresql://causeflow:causeflow@127.0.0.1:5439/causeflow}"
HINDSIGHT="${HINDSIGHT_BASE_URL_HOST:-http://127.0.0.1:8888}"
EVIDENCE="${EVIDENCE_LOG:-/tmp/wi-ac046-$$.log}"
SSE_FILE="${SSE_FILE:-/tmp/wi-ac046-sse-$$.txt}"
: >"$EVIDENCE"
: >"$SSE_FILE"

log() { echo "$1" | tee -a "$EVIDENCE"; }
fail() { log "FAIL: $1"; exit 1; }

sign() {
  python3 - "$WEBHOOK_SECRET" "$1" <<'PY'
import hmac, hashlib, sys
secret, body = sys.argv[1], sys.argv[2]
print(hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest())
PY
}

log "=== AC-046 verification BASE=$BASE ==="

# 0. Health — local-only stack, anthropic may be skipped
HEALTH=$(curl -sS --max-time 5 "$BASE/health" || true)
log "health=$HEALTH"
echo "$HEALTH" | grep -q '"postgres":"ok"' || fail "postgres not ok"
echo "$HEALTH" | grep -q '"redis":"ok"' || fail "redis not ok"
echo "$HEALTH" | grep -q '"queues":"ok"' || fail "queues not ok"

# 1. Register tenant (for JWT polling / SSE / evidence APIs)
EMAIL="ac046-$(date +%s)@example.com"
PASS="testpass123"
TENANT_NAME="AC046 Tenant $(date +%s)"
REG=$(curl -sS -w '\n%{http_code}' -X POST "$BASE/v1/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"tenantName\":\"$TENANT_NAME\"}")
REG_BODY=$(echo "$REG" | sed '$d')
REG_CODE=$(echo "$REG" | tail -1)
log "register code=$REG_CODE body=$REG_BODY"
TOKEN=$(echo "$REG_BODY" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("token",""))')
TENANT_ID=$(echo "$REG_BODY" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("tenantId") or (d.get("tenant") or {}).get("id") or (d.get("tenant") or {}).get("tenantId") or (d.get("user") or {}).get("tenantId") or "")')
[ -n "$TOKEN" ] || fail "no JWT from register"
[ -n "$TENANT_ID" ] || fail "no tenantId from register"
log "tenantId=$TENANT_ID"

# Early SSE placeholder — incidentId filled after webhook1; replay covers fast completions.
SSE_PID=""
start_sse() {
  [ -n "${INCIDENT_ID:-}" ] || return 0
  curl -sS -N --max-time 180 \
    -H "Authorization: Bearer $TOKEN" \
    "$BASE/api/v1/investigation/${INCIDENT_ID}/stream" >"$SSE_FILE" 2>/dev/null &
  SSE_PID=$!
}

# 2. Datadog webhook with valid HMAC → creates incident (AC-014)
ALERT_ID="dd-ac046-$(date +%s)"
BODY=$(python3 - <<PY
import json
print(json.dumps({
  "id": "$ALERT_ID",
  "title": "AC046 pipeline regression high CPU order-service",
  "body": "Synthetic Datadog alert for AC-046 local-only pipeline. Database connection pool exhaustion suspected.",
  "priority": "P1",
  "tags": ["service:order-service", "env:local"],
  "date": 1710000000000,
  "org": {"id": 1, "name": "ac046"},
  "alert_type": "error",
}))
PY
)
SIG=$(sign "$BODY")
WH1=$(curl -sS -w '\n%{http_code}' -X POST "$BASE/v1/webhooks/${TENANT_ID}/datadog" \
  -H 'Content-Type: application/json' \
  -H "X-Webhook-Signature: $SIG" \
  -d "$BODY")
WH1_BODY=$(echo "$WH1" | sed '$d')
WH1_CODE=$(echo "$WH1" | tail -1)
log "webhook1 code=$WH1_CODE body=$WH1_BODY"
[ "$WH1_CODE" = "202" ] || [ "$WH1_CODE" = "200" ] || fail "webhook1 expected 202, got $WH1_CODE"
INCIDENT_ID=$(echo "$WH1_BODY" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("incidentId") or d.get("id") or "")')
[ -n "$INCIDENT_ID" ] || fail "no incidentId from webhook"
log "incidentId=$INCIDENT_ID"

# Subscribe SSE immediately after incident exists (before dedup + polling)
start_sse
sleep 1

# 3. Identical POST within dedup window → same incident (AC-015)
WH2=$(curl -sS -w '\n%{http_code}' -X POST "$BASE/v1/webhooks/${TENANT_ID}/datadog" \
  -H 'Content-Type: application/json' \
  -H "X-Webhook-Signature: $SIG" \
  -d "$BODY")
WH2_BODY=$(echo "$WH2" | sed '$d')
WH2_CODE=$(echo "$WH2" | tail -1)
log "webhook2 code=$WH2_CODE body=$WH2_BODY"
INCIDENT_ID2=$(echo "$WH2_BODY" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("incidentId") or d.get("id") or "")')
[ "$INCIDENT_ID2" = "$INCIDENT_ID" ] || fail "dedup failed: $INCIDENT_ID vs $INCIDENT_ID2"
DEDUPED=$(echo "$WH2_BODY" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("deduplicated") or d.get("duplicate") or "")')
log "dedup ok incidentId=$INCIDENT_ID2 deduplicated=$DEDUPED"

# 4. Poll until triage sets severity + investigation completes (AC-017 / AC-019 / AC-020)
SEVERITY=""
FINAL_STATUS=""
for i in $(seq 1 120); do
  RESP=$(curl -sS -H "Authorization: Bearer $TOKEN" "$BASE/api/v1/investigation/${INCIDENT_ID}" || echo '{}')
  STATUS=$(echo "$RESP" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("status",""))' 2>/dev/null || true)
  INC_STATUS=$(echo "$RESP" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("incident",{}).get("status",""))' 2>/dev/null || true)
  SEV=$(echo "$RESP" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("incident",{}).get("severity",""))' 2>/dev/null || true)
  if [ -n "$SEV" ] && [ "$SEV" != "null" ]; then SEVERITY="$SEV"; fi
  log "poll $i run_status=$STATUS incident_status=$INC_STATUS severity=$SEV"
  if [ "$STATUS" = "succeeded" ] || [ "$STATUS" = "failed" ] || [ "$INC_STATUS" = "resolved" ] || [ "$INC_STATUS" = "failed" ]; then
    FINAL_STATUS="$STATUS"
    sleep 3
    break
  fi
  sleep 2
done

[ -n "$SEVERITY" ] || fail "triage never set severity"
log "severity_set=$SEVERITY"

# 5. SSE: 6+ agent roles (AC-019)
sleep 2
[ -n "${SSE_PID:-}" ] && kill "$SSE_PID" 2>/dev/null || true
[ -n "${SSE_PID:-}" ] && wait "$SSE_PID" 2>/dev/null || true
log "SSE bytes=$(wc -c <"$SSE_FILE")"
log "SSE content (head):"
head -c 4000 "$SSE_FILE" | tee -a "$EVIDENCE"
echo | tee -a "$EVIDENCE"

AGENTS=$(python3 - "$SSE_FILE" <<'PY'
import json, sys
text = open(sys.argv[1], encoding='utf-8', errors='replace').read()
roles = set()
for block in text.split('\n\n'):
    for line in block.splitlines():
        if line.startswith('data:'):
            raw = line[5:].strip()
            try:
                data = json.loads(raw)
            except Exception:
                continue
            if isinstance(data, dict):
                role = data.get('agentRole')
                if role:
                    roles.add(str(role))
print(','.join(sorted(roles)))
print(len(roles), file=sys.stderr)
PY
)
AGENT_COUNT=$(echo "$AGENTS" | python3 -c 'import sys; print(len([x for x in sys.stdin.read().strip().split(",") if x]))')
log "sse_agent_roles=$AGENTS count=$AGENT_COUNT"
[ "$AGENT_COUNT" -ge 6 ] || fail "expected 6+ agent SSE roles, got $AGENT_COUNT ($AGENTS)"

# 6. Evidence + Hypothesis via API and Postgres (AC-020)
EV=$(curl -sS -H "Authorization: Bearer $TOKEN" "$BASE/api/v1/investigation/${INCIDENT_ID}/evidence")
HY=$(curl -sS -H "Authorization: Bearer $TOKEN" "$BASE/api/v1/investigation/${INCIDENT_ID}/hypotheses")
log "evidence_api=$EV"
log "hypotheses_api=$HY"
EV_COUNT=$(echo "$EV" | python3 -c 'import sys,json; d=json.load(sys.stdin); 
items=d if isinstance(d,list) else d.get("evidence") or d.get("items")
if items is None and isinstance(d.get("evidenceByAgent"), dict):
  items=[e for arr in d["evidenceByAgent"].values() for e in (arr or [])]
print(len(items or []))')
HY_COUNT=$(echo "$HY" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(len(d if isinstance(d,list) else d.get("hypotheses") or d.get("items") or []))')
[ "$EV_COUNT" -ge 1 ] || fail "no EvidenceEntity via API"
[ "$HY_COUNT" -ge 1 ] || fail "no HypothesisEntity via API"

PG_EV=$(docker compose exec -T causeflow-postgres psql -U causeflow -d causeflow -tAc "SELECT count(*) FROM causeflow.evidence WHERE data->>'incidentId' = '$INCIDENT_ID';" 2>/dev/null | tr -d '[:space:]' || echo 0)
PG_HY=$(docker compose exec -T causeflow-postgres psql -U causeflow -d causeflow -tAc "SELECT count(*) FROM causeflow.hypotheses WHERE data->>'incidentId' = '$INCIDENT_ID';" 2>/dev/null | tr -d '[:space:]' || echo 0)
log "postgres evidence=$PG_EV hypotheses=$PG_HY"
[ "${PG_EV:-0}" -ge 1 ] || fail "no evidence rows in Postgres"
[ "${PG_HY:-0}" -ge 1 ] || fail "no hypothesis rows in Postgres"

# 7. Hindsight bank runbook (AC-026)
BANK="causeflow-${TENANT_ID}"
RECALL=$(curl -sS -X POST "$HINDSIGHT/v1/default/banks/${BANK}/memories/recall" \
  -H 'Content-Type: application/json' \
  -d '{"query":"AC046 pipeline regression high CPU order-service root cause runbook","budget":"mid"}' || echo '{}')
log "hindsight_recall=$RECALL"
echo "$RECALL" | grep -qiE 'root cause|investigation|AC046|order-service|Unable to determine|runbook|Findings' \
  || fail "Hindsight recall did not return investigation/runbook content"

log "PASS AC-046 final_status=$FINAL_STATUS severity=$SEVERITY agents=$AGENT_COUNT evidence=$EV_COUNT hypotheses=$HY_COUNT"
echo "EVIDENCE_LOG=$EVIDENCE"
exit 0
