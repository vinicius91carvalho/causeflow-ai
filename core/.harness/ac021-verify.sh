#!/usr/bin/env bash
set -euo pipefail
PORT="${PORT:-3099}"
BASE="http://127.0.0.1:${PORT}"

EMAIL="ac021-$(date +%s)@example.com"
REG=$(curl -sS -X POST "$BASE/v1/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"testpass123\",\"tenantName\":\"AC021 Tenant\"}")
TOKEN=$(echo "$REG" | python3 -c 'import sys,json; print(json.load(sys.stdin)["token"])')

INC=$(curl -sS -X POST "$BASE/v1/incidents" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"AC021 chat boundary test","description":"Synthetic incident for AC-021 verification.","severity":"critical"}')
INCIDENT_ID=$(echo "$INC" | python3 -c 'import sys,json; print(json.load(sys.stdin)["incidentId"])')
echo "incidentId=$INCIDENT_ID"

for i in $(seq 1 90); do
  STATUS=$(curl -sS -H "Authorization: Bearer $TOKEN" "$BASE/api/v1/investigation/${INCIDENT_ID}" \
    | python3 -c 'import sys,json; print(json.load(sys.stdin).get("status",""))')
  echo "poll $i status=$STATUS"
  if [ "$STATUS" = "succeeded" ] || [ "$STATUS" = "failed" ] || [ "$STATUS" = "resolved" ]; then break; fi
  sleep 1
done

CHAT_HTTP=$(curl -sS -w "\nHTTP_CODE:%{http_code}" -X POST "$BASE/api/v1/investigation/${INCIDENT_ID}/chat" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"message":"What was the root cause of this incident?"}')
CHAT_BODY=$(echo "$CHAT_HTTP" | sed '/HTTP_CODE:/d')
CHAT_CODE=$(echo "$CHAT_HTTP" | sed -n 's/.*HTTP_CODE://p')
echo "chat_http=$CHAT_CODE"
echo "chat_body=$CHAT_BODY"

HIST=$(curl -sS -H "Authorization: Bearer $TOKEN" "$BASE/api/v1/investigation/${INCIDENT_ID}/chat")

python3 - "$CHAT_CODE" "$CHAT_BODY" "$HIST" <<'PY'
import json, sys
code = sys.argv[1]
chat = json.loads(sys.argv[2])
hist = json.loads(sys.argv[3])
messages = hist.get("messages", [])
fail = False
if code != "200":
    print(f"FAIL: POST /chat returned {code}")
    fail = True
if not chat.get("response"):
    print("FAIL: no agent response in POST body")
    fail = True
if not chat.get("chatId"):
    print("FAIL: no chatId in POST body")
    fail = True
roles = [m.get("role") for m in messages]
if "user" not in roles:
    print("FAIL: user ChatMessageEntity not persisted")
    fail = True
if "assistant" not in roles:
    print("FAIL: assistant ChatMessageEntity not persisted")
    fail = True
assistant = next((m for m in messages if m.get("role") == "assistant"), None)
if assistant and not assistant.get("slackThreadId"):
    print("FAIL: assistant message missing slackThreadId from chat platform mirror")
    fail = True
print("messages:", len(messages), "roles:", roles)
if assistant:
    print("slackThreadId:", assistant.get("slackThreadId"))
print("PASS" if not fail else "OVERALL FAIL")
sys.exit(1 if fail else 0)
PY
