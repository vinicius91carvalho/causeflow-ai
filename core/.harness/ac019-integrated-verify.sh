#!/usr/bin/env bash
set -euo pipefail
PORT="${PORT:-5175}"
BASE="http://127.0.0.1:${PORT}"
EVIDENCE="/tmp/wi-ac019-integrated-$$.log"
SSE_FILE="/tmp/wi-ac019-sse-$$.txt"
: >"$EVIDENCE"
: >"$SSE_FILE"

log() { echo "$1" | tee -a "$EVIDENCE"; }

EMAIL="ac019-$(date +%s)@example.com"
PASS="testpass123"
TENANT="AC019 Tenant $(date +%s)"

log "=== AC-019 integrated verification PORT=$PORT ==="

REG=$(curl -sS -w '\n%{http_code}' -X POST "$BASE/v1/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"tenantName\":\"$TENANT\"}")
REG_BODY=$(echo "$REG" | sed '$d')
REG_CODE=$(echo "$REG" | tail -1)
log "register code=$REG_CODE"
TOKEN=$(echo "$REG_BODY" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("token",""))')

INC=$(curl -sS -w '\n%{http_code}' -X POST "$BASE/v1/incidents" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"title\":\"AC019 integrated test incident\",\"description\":\"Synthetic incident for AC-019 integrated verification boundary test.\",\"severity\":\"critical\"}")
INC_BODY=$(echo "$INC" | sed '$d')
INC_CODE=$(echo "$INC" | tail -1)
log "create incident code=$INC_CODE body=$INC_BODY"
INCIDENT_ID=$(echo "$INC_BODY" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("incidentId",""))')
log "created incidentId=$INCIDENT_ID"

# Poll once immediately — fast OSS runs can finish before SSE subscription connects.
RUNNING_SEEN=0
FINAL_BODY=""
IMMEDIATE=$(curl -sS -H "Authorization: Bearer $TOKEN" "$BASE/api/v1/investigation/${INCIDENT_ID}")
IMM_STATUS=$(echo "$IMMEDIATE" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("status",""))')
log "immediate poll run_status=$IMM_STATUS"
if [ "$IMM_STATUS" = "running" ]; then RUNNING_SEEN=1; fi

# Subscribe SSE on the real incident id (replay buffer covers fast completions)
curl -sS -N --max-time 120 \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/v1/investigation/${INCIDENT_ID}/stream" >"$SSE_FILE" 2>/dev/null &
SSE_PID=$!

for i in $(seq 1 90); do
  RESP=$(curl -sS -H "Authorization: Bearer $TOKEN" "$BASE/api/v1/investigation/${INCIDENT_ID}")
  STATUS=$(echo "$RESP" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("status",""))')
  INC_STATUS=$(echo "$RESP" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("incident",{}).get("status",""))')
  log "poll $i run_status=$STATUS incident_status=$INC_STATUS"
  if [ "$STATUS" = "running" ]; then RUNNING_SEEN=1; fi
  if [ "$STATUS" = "succeeded" ] || [ "$STATUS" = "failed" ]; then
    FINAL_BODY="$RESP"
    sleep 5
    break
  fi
  sleep 1
done

sleep 3
kill "$SSE_PID" 2>/dev/null || true
wait "$SSE_PID" 2>/dev/null || true

log "SSE bytes=$(wc -c <"$SSE_FILE")"
log "SSE content:"
cat "$SSE_FILE" | tee -a "$EVIDENCE"

AGENTS=$(python3 - "$SSE_FILE" <<'PY'
import json, sys
text = open(sys.argv[1], encoding='utf-8', errors='replace').read()
roles = set()
progress = 0
for block in text.split('\n\n'):
    if 'investigation_progress' in block or 'agentRole' in block:
        progress += 1
    for line in block.splitlines():
        if not line.startswith('data:'):
            continue
        raw = line[5:].strip()
        if not raw:
            continue
        try:
            d = json.loads(raw)
        except Exception:
            continue
        if isinstance(d, dict):
            if d.get('agentRole'):
                roles.add(d['agentRole'])
            inner = d.get('data')
            if isinstance(inner, dict) and inner.get('agentRole'):
                roles.add(inner['agentRole'])
print(','.join(sorted(roles)))
print('PROGRESS_EVENTS=' + str(progress), file=sys.stderr)
PY
2>&1 | tee -a "$EVIDENCE" | head -1)

FINAL_STATUS=$(echo "$FINAL_BODY" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("status",""))')
FINAL_SYNTH=$(echo "$FINAL_BODY" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("finalSynthesis",""))')
ASSIGNED=$(echo "$FINAL_BODY" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(",".join(d.get("incident",{}).get("assignedAgents",[])))')
log "final_status=$FINAL_STATUS"
log "final_synthesis=$FINAL_SYNTH"
log "assigned_agents=$ASSIGNED"
log "sse_agent_roles=$AGENTS"
log "running_seen=$RUNNING_SEEN"

REQUIRED="change_detector,code_analyzer,db_analyst,infra_inspector,log_analyst,metric_analyst"
FAIL=0
for a in ${REQUIRED//,/ }; do
  if ! echo "$ASSIGNED" | grep -q "$a"; then
    log "FAIL missing assigned agent: $a"
    FAIL=1
  fi
done
if [ "$RUNNING_SEEN" != "1" ]; then log "FAIL never saw status=running"; FAIL=1; fi
if [ "$FINAL_STATUS" != "succeeded" ]; then log "FAIL final status not succeeded"; FAIL=1; fi
if [ -z "$FINAL_SYNTH" ]; then log "FAIL finalSynthesis empty"; FAIL=1; fi
AGENT_COUNT=$(echo "$AGENTS" | tr ',' '\n' | grep -c . || true)
if [ "$AGENT_COUNT" -lt 6 ]; then log "FAIL fewer than 6 SSE agent roles ($AGENTS)"; FAIL=1; fi

if [ "$FAIL" = "0" ]; then
  log "PASS"
  echo "$EVIDENCE"
  exit 0
else
  log "OVERALL FAIL"
  echo "$EVIDENCE"
  exit 2
fi
