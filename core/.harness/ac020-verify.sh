#!/usr/bin/env bash
set -euo pipefail
PORT="${PORT:-3099}"
BASE="http://127.0.0.1:${PORT}"

EMAIL="ac020-$(date +%s)@example.com"
REG=$(curl -sS -X POST "$BASE/v1/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"testpass123\",\"tenantName\":\"AC020 Tenant\"}")
TOKEN=$(echo "$REG" | python3 -c 'import sys,json; print(json.load(sys.stdin)["token"])')

INC=$(curl -sS -X POST "$BASE/v1/incidents" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"AC020 boundary test","description":"Synthetic incident for AC-020 verification.","severity":"critical"}')
INCIDENT_ID=$(echo "$INC" | python3 -c 'import sys,json; print(json.load(sys.stdin)["incidentId"])')
echo "incidentId=$INCIDENT_ID"

for i in $(seq 1 90); do
  STATUS=$(curl -sS -H "Authorization: Bearer $TOKEN" "$BASE/api/v1/investigation/${INCIDENT_ID}" \
    | python3 -c 'import sys,json; print(json.load(sys.stdin).get("status",""))')
  echo "poll $i status=$STATUS"
  if [ "$STATUS" = "succeeded" ] || [ "$STATUS" = "failed" ]; then break; fi
  sleep 1
done

EVIDENCE=$(curl -sS -H "Authorization: Bearer $TOKEN" "$BASE/api/v1/investigation/${INCIDENT_ID}/evidence")
HYP=$(curl -sS -H "Authorization: Bearer $TOKEN" "$BASE/api/v1/investigation/${INCIDENT_ID}/hypotheses")
MAIN=$(curl -sS -H "Authorization: Bearer $TOKEN" "$BASE/api/v1/investigation/${INCIDENT_ID}")

python3 - "$EVIDENCE" "$HYP" "$MAIN" <<'PY'
import json, sys
evidence = json.loads(sys.argv[1])
hyp = json.loads(sys.argv[2])
main = json.loads(sys.argv[3])
agents = main.get("incident", {}).get("assignedAgents", [])
by_agent = evidence.get("evidenceByAgent", {})
hypotheses = hyp.get("hypotheses", [])
print("assigned_agents:", agents)
print("evidence_agents:", sorted(by_agent.keys()))
print("hypothesis_count:", len(hypotheses))
roots = [h for h in hypotheses if not h.get("parentId")]
children = [h for h in hypotheses if h.get("parentId")]
print("roots:", len(roots), "children:", len(children))
fail = False
for a in agents:
    items = by_agent.get(a, [])
    if not items:
        print(f"FAIL: no evidence for agent {a}")
        fail = True
    elif not any((i.get("metadata") or {}).get("confidence") is not None for i in items):
        print(f"FAIL: no confidence for agent {a}")
        fail = True
if len(hypotheses) < 1:
    print("FAIL: no hypotheses")
    fail = True
if len(roots) < 1 or len(children) < 1:
    print("FAIL: missing parent/child hypothesis links")
    fail = True
print("PASS" if not fail else "OVERALL FAIL")
sys.exit(1 if fail else 0)
PY
