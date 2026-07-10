#!/usr/bin/env bash
# AC-022 verification: model swap via env + circuit-breaker health/investigation failure.
set -euo pipefail

PORT="${PORT:-3099}"
BASE="http://127.0.0.1:${PORT}"
LANGFUSE_BASE="${LANGFUSE_BASE_URL:-http://localhost:3001}"
LANGFUSE_PK="${LANGFUSE_PUBLIC_KEY:-pk-lf-054e9a5c-0a92-448c-9006-1ad01ed1ec8f}"
LANGFUSE_SK="${LANGFUSE_SECRET_KEY:-sk-lf-01942dd9-bf62-4a84-b4db-61ffd758db5e}"
TRIAGE_MODEL="${ANTHROPIC_TRIAGE_MODEL:-claude-haiku-4-5}"

fail() { echo "FAIL: $*"; exit 1; }

EMAIL="ac022-$(date +%s)@example.com"
REG=$(curl -sS -X POST "$BASE/v1/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"testpass123\",\"tenantName\":\"AC022 Verify\"}")
TOKEN=$(echo "$REG" | python3 -c 'import sys,json; print(json.load(sys.stdin)["token"])')

echo "=== AC-022 setup: trip API circuit breaker via triage (open incident, no severity) ==="
TRIP=$(curl -sS -X POST "$BASE/v1/incidents" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"AC022 triage model trace","description":"Open incident to exercise triage LLM path for AC-022."}')
TRIP_ID=$(echo "$TRIP" | python3 -c 'import sys,json; print(json.load(sys.stdin)["incidentId"])')
echo "triageIncidentId=$TRIP_ID"
sleep 4

echo "=== AC-022 check 1: health degrades after invalid-key LLM failure ==="
HEALTH=$(curl -sS "$BASE/health")
echo "health=$HEALTH"
python3 -c 'import json,sys; d=json.loads(sys.argv[1]); s=d.get("anthropic"); assert s=="degraded", f"expected anthropic=degraded, got {s!r}"' "$HEALTH" \
  || fail "anthropic health not degraded after invalid key triage failure"

echo "=== AC-022 check 2: investigation fails with circuit-breaker error ==="
INC=$(curl -sS -X POST "$BASE/v1/incidents" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"AC022 circuit breaker test","description":"Synthetic incident for AC-022 investigation failure.","severity":"critical"}')
INCIDENT_ID=$(echo "$INC" | python3 -c 'import sys,json; print(json.load(sys.stdin)["incidentId"])')
echo "incidentId=$INCIDENT_ID"

INV=""
for i in $(seq 1 90); do
  BODY=$(curl -sS -H "Authorization: Bearer $TOKEN" "$BASE/api/v1/investigation/${INCIDENT_ID}")
  FINAL_STATUS=$(echo "$BODY" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("status",""))')
  echo "poll $i status=$FINAL_STATUS"
  if [ "$FINAL_STATUS" = "failed" ] || [ "$FINAL_STATUS" = "succeeded" ] || [ "$FINAL_STATUS" = "resolved" ]; then
    INV="$BODY"
    break
  fi
  sleep 2
done

python3 - "$INV" <<'PY' || fail "investigation did not fail with circuit-breaker error"
import json, sys
inv = json.loads(sys.argv[1])
status = inv.get("status")
if status != "failed":
    raise SystemExit(f"expected investigation status=failed, got {status!r}")
text = json.dumps(inv).lower()
if "circuit breaker" not in text:
    raise SystemExit("expected circuit-breaker message in investigation payload")
print("investigation_failed_with_circuit_breaker=ok")
PY

echo "=== AC-022 check 3: Langfuse trace shows configured triage model ==="
sleep 3
TRACE_JSON=$(curl -sS -u "${LANGFUSE_PK}:${LANGFUSE_SK}" \
  "${LANGFUSE_BASE}/api/public/traces?limit=30" 2>/dev/null || echo '{"data":[]}')
python3 - "$TRACE_JSON" "$TRIAGE_MODEL" "$TRIP_ID" <<'PY' || fail "Langfuse trace missing configured triage model"
import json, sys
model = sys.argv[2]
incident_id = sys.argv[3]
payload = json.loads(sys.argv[1])
traces = payload.get("data") or payload.get("traces") or []
found = False
for t in traces:
    blob = json.dumps(t).lower()
    if incident_id.lower() in blob and model.lower() in blob:
        found = True
        break
if not found:
    for t in traces:
        if model.lower() in json.dumps(t).lower():
            found = True
            break
if not found:
    raise SystemExit(f"no Langfuse trace containing model {model!r}")
print(f"langfuse_model={model}")
PY

echo "PASS AC-022"
