#!/usr/bin/env bash
set -euo pipefail
PORT="${PORT:-5170}"
BASE="http://127.0.0.1:${PORT}"
EMAIL="ac024-$(date +%s)@example.com"

fail() { echo "FAIL: $1" >&2; exit 1; }

echo "=== Health ==="
curl -s "$BASE/health" | jq .

echo "=== Register ==="
REG=$(curl -sf -X POST "$BASE/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"testpass123\",\"tenantName\":\"ac024-tenant\"}")
TOKEN=$(echo "$REG" | jq -r .token)
test "$TOKEN" != "null" && test -n "$TOKEN" || fail "register did not return token"

echo "=== Create incident ==="
INC=$(curl -sf -X POST "$BASE/v1/admin/incidents" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"CPU spike order-service","description":"High CPU on order-service pods","severity":"critical"}')
INCIDENT_ID=$(echo "$INC" | jq -r .incidentId)
test -n "$INCIDENT_ID" || fail "incident id missing"
echo "incident=$INCIDENT_ID"

echo "=== Propose remediation ==="
REM=$(curl -sf -X POST "$BASE/api/v1/remediation" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"incidentId\":\"$INCIDENT_ID\",\"rootCause\":\"Memory leak\",\"recommendedActions\":[{\"action\":\"scale_horizontal\",\"label\":\"Scale Up\",\"description\":\"Increase instances\",\"riskLevel\":\"medium\",\"automated\":true,\"params\":{\"service\":\"order-service\",\"desiredCount\":5}},{\"action\":\"restart_service\",\"label\":\"Restart\",\"description\":\"Rolling restart\",\"riskLevel\":\"low\",\"automated\":true,\"params\":{\"service\":\"order-service\"}}]}")
REM_ID=$(echo "$REM" | jq -r .remediationId)
test -n "$REM_ID" || fail "remediation id missing"
echo "remediation=$REM_ID"

echo "=== Approve (auto-execute) ==="
APPROVE_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/v1/remediation/$REM_ID/approve" \
  -H "Authorization: Bearer $TOKEN")
test "$APPROVE_CODE" = "200" || fail "approve returned $APPROVE_CODE"

sleep 3

echo "=== Detail after approve/execute ==="
DETAIL=$(curl -sf "$BASE/api/v1/remediation/detail/$REM_ID" \
  -H "Authorization: Bearer $TOKEN")
echo "$DETAIL" | jq '{status, steps: [.steps[] | {action, status, beforeState, afterState, output}]}'

ORIG_STATUS=$(echo "$DETAIL" | jq -r .status)
test "$ORIG_STATUS" = "completed" || fail "expected completed status, got $ORIG_STATUS"

STEP_COUNT=$(echo "$DETAIL" | jq '[.steps[] | select(.automated != false)] | length')
SUCCEEDED_COUNT=$(echo "$DETAIL" | jq '[.steps[] | select(.status == "succeeded")] | length')
test "$SUCCEEDED_COUNT" -ge 1 || fail "expected at least one succeeded step, got $SUCCEEDED_COUNT"

HAS_BEFORE=$(echo "$DETAIL" | jq '[.steps[] | select(.beforeState != null)] | length')
HAS_AFTER=$(echo "$DETAIL" | jq '[.steps[] | select(.afterState != null)] | length')
test "$HAS_BEFORE" -ge 1 || fail "expected beforeState on steps"
test "$HAS_AFTER" -ge 1 || fail "expected afterState on steps"

ORIG_BEFORE=$(echo "$DETAIL" | jq -c '.steps[0].beforeState')
ORIG_AFTER=$(echo "$DETAIL" | jq -c '.steps[0].afterState')

echo "=== Rollback ==="
ROLLBACK=$(curl -sf -X POST "$BASE/api/v1/remediation/$REM_ID/rollback" \
  -H "Authorization: Bearer $TOKEN")
ROLLBACK_ID=$(echo "$ROLLBACK" | jq -r .remediationId)
test -n "$ROLLBACK_ID" || fail "rollback remediation id missing"
echo "rollback_remediation=$ROLLBACK_ID"
echo "$ROLLBACK" | jq '{remediationId, status, rollbackOf, steps: [.steps[] | {label, action, params}]}'

ROLLBACK_OF=$(echo "$ROLLBACK" | jq -r .rollbackOf)
test "$ROLLBACK_OF" = "$REM_ID" || fail "rollbackOf should point to original remediation"

echo "=== Approve rollback (auto-execute) ==="
RB_APPROVE_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/v1/remediation/$ROLLBACK_ID/approve" \
  -H "Authorization: Bearer $TOKEN")
test "$RB_APPROVE_CODE" = "200" || fail "rollback approve returned $RB_APPROVE_CODE"

sleep 3

echo "=== Rollback detail after execute ==="
RB_DETAIL=$(curl -sf "$BASE/api/v1/remediation/detail/$ROLLBACK_ID" \
  -H "Authorization: Bearer $TOKEN")
echo "$RB_DETAIL" | jq '{status, steps: [.steps[] | {action, status, beforeState, afterState}]}'

RB_STATUS=$(echo "$RB_DETAIL" | jq -r .status)
test "$RB_STATUS" = "completed" || fail "expected rollback completed, got $RB_STATUS"

RB_AFTER=$(echo "$RB_DETAIL" | jq -c '.steps[-1].afterState // .steps[0].afterState')
test "$RB_AFTER" = "$ORIG_BEFORE" || fail "rollback afterState ($RB_AFTER) should match original beforeState ($ORIG_BEFORE)"

echo "=== Audit tail ==="
AUDIT=$(curl -sf "$BASE/v1/audit?limit=10" \
  -H "Authorization: Bearer $TOKEN")
echo "$AUDIT" | jq '[.items[] | {action, resourceId}]'

HAS_PROPOSED=$(echo "$AUDIT" | jq --arg id "$ROLLBACK_ID" '[.items[] | select(.action == "remediation.proposed" and .resourceId == $id)] | length')
HAS_EXECUTED=$(echo "$AUDIT" | jq --arg id "$ROLLBACK_ID" '[.items[] | select(.action == "remediation.executed" and .resourceId == $id)] | length')
test "$HAS_PROPOSED" -ge 1 || fail "audit missing remediation.proposed for rollback"
test "$HAS_EXECUTED" -ge 1 || fail "audit missing remediation.executed for rollback"

echo "=== AC-024 verify PASSED ==="
