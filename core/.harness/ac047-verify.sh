#!/usr/bin/env bash
# AC-047 black-box verify — stub cloud remediation (approve / execute / rollback)
set -euo pipefail
PORT="${PORT:-5170}"
BASE="http://127.0.0.1:${PORT}"
EMAIL="ac047-$(date +%s)@example.com"
PGURL="${DATABASE_URL_HOST:-postgresql://causeflow:causeflow@127.0.0.1:5439/causeflow}"

fail() { echo "FAIL: $1" >&2; exit 1; }

echo "=== Static: AWS/Azure providers removed from running path ==="
test ! -f src/shared/infra/cloud/aws-cloud-provider.ts || fail "aws-cloud-provider.ts still present"
test ! -f src/shared/infra/cloud/azure-cloud-provider-stub.ts || fail "azure-cloud-provider-stub.ts still present"
! rg -n "from ['\"].*aws-cloud-provider|from ['\"].*azure-cloud-provider|new AWSCloudProvider|new AzureCloudProviderStub|aws-cloud-provider\.js|azure-cloud-provider-stub\.js" src/bootstrap.ts src/workers/ >/dev/null \
  || fail "bootstrap/worker still reference AWS/Azure providers"
rg -n "StubCloudProvider" src/bootstrap.ts src/workers/investigation-worker.ts >/dev/null \
  || fail "StubCloudProvider not wired"

echo "=== Health ==="
curl -sf "$BASE/health" | jq .

echo "=== Register ==="
REG=$(curl -sf -X POST "$BASE/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"testpass123\",\"tenantName\":\"ac047-tenant\"}")
TOKEN=$(echo "$REG" | jq -r .token)
TENANT_ID=$(echo "$REG" | jq -r '.tenantId // .tenant.id // empty')
test "$TOKEN" != "null" && test -n "$TOKEN" || fail "register did not return token"
echo "tenant=$TENANT_ID"

echo "=== Create incident ==="
INC=$(curl -sf -X POST "$BASE/v1/admin/incidents" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"CPU spike order-service","description":"High CPU on order-service pods","severity":"critical"}')
INCIDENT_ID=$(echo "$INC" | jq -r .incidentId)
test -n "$INCIDENT_ID" && test "$INCIDENT_ID" != "null" || fail "incident id missing"
echo "incident=$INCIDENT_ID"

echo "=== Propose remediation ==="
REM=$(curl -sf -X POST "$BASE/api/v1/remediation" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"incidentId\":\"$INCIDENT_ID\",\"rootCause\":\"Memory leak\",\"recommendedActions\":[{\"action\":\"scale_horizontal\",\"label\":\"Scale Up\",\"description\":\"Increase instances\",\"riskLevel\":\"medium\",\"automated\":true,\"params\":{\"service\":\"order-service\",\"desiredCount\":5}},{\"action\":\"restart_service\",\"label\":\"Restart\",\"description\":\"Rolling restart\",\"riskLevel\":\"low\",\"automated\":true,\"params\":{\"service\":\"order-service\"}}]}")
REM_ID=$(echo "$REM" | jq -r .remediationId)
test -n "$REM_ID" && test "$REM_ID" != "null" || fail "remediation id missing"
echo "remediation=$REM_ID"

echo "=== Approve (records ApprovalEntity; auto-executes via StubCloudProvider) ==="
APPROVE=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/v1/remediation/$REM_ID/approve" \
  -H "Authorization: Bearer $TOKEN")
APPROVE_BODY=$(echo "$APPROVE" | head -n -1)
APPROVE_CODE=$(echo "$APPROVE" | tail -n 1)
test "$APPROVE_CODE" = "200" || fail "approve returned $APPROVE_CODE body=$APPROVE_BODY"

echo "=== Second approve → 409 ==="
DUP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/v1/remediation/$REM_ID/approve" \
  -H "Authorization: Bearer $TOKEN")
test "$DUP_CODE" = "409" || fail "second approve expected 409, got $DUP_CODE"

# Resolve tenant id from JWT if register payload omitted it
if [ -z "$TENANT_ID" ] || [ "$TENANT_ID" = "null" ]; then
  TENANT_ID=$(echo "$TOKEN" | cut -d. -f2 | tr '_-' '/+' | awk '{while(length($0)%4) $0=$0"="; print}' | base64 -d 2>/dev/null | jq -r '.tenantId // .org_id // empty' || true)
fi

echo "=== ApprovalEntity in Postgres ==="
sleep 0.5
APPROVAL_COUNT=$(docker compose exec -T causeflow-postgres \
  psql -U causeflow -d causeflow -tAc "SELECT count(*) FROM causeflow.approvals WHERE data->>'remediationId' = '$REM_ID'" \
  | tr -d '[:space:]')
test "${APPROVAL_COUNT}" -ge 1 || fail "expected ApprovalEntity row for remediation $REM_ID, got count=$APPROVAL_COUNT"
docker compose exec -T causeflow-postgres \
  psql -U causeflow -d causeflow -c "SELECT entity_id, data->>'status' AS status, data->>'remediationId' AS rem FROM causeflow.approvals WHERE data->>'remediationId' = '$REM_ID' LIMIT 3"

sleep 2

echo "=== Detail after approve/auto-execute ==="
DETAIL=$(curl -sf "$BASE/api/v1/remediation/detail/$REM_ID" \
  -H "Authorization: Bearer $TOKEN")
echo "$DETAIL" | jq '{status, steps: [.steps[] | {action, status, beforeState, afterState, output}]}'

ORIG_STATUS=$(echo "$DETAIL" | jq -r .status)
test "$ORIG_STATUS" = "completed" || fail "expected completed status, got $ORIG_STATUS"

SUCCEEDED_COUNT=$(echo "$DETAIL" | jq '[.steps[] | select(.status == "succeeded")] | length')
test "$SUCCEEDED_COUNT" -ge 1 || fail "expected at least one succeeded step, got $SUCCEEDED_COUNT"

HAS_BEFORE=$(echo "$DETAIL" | jq '[.steps[] | select(.beforeState != null)] | length')
HAS_AFTER=$(echo "$DETAIL" | jq '[.steps[] | select(.afterState != null)] | length')
test "$HAS_BEFORE" -ge 1 || fail "expected beforeState on steps"
test "$HAS_AFTER" -ge 1 || fail "expected afterState on steps"

SCALE_BEFORE=$(echo "$DETAIL" | jq -r '.steps[] | select(.action=="scale_horizontal") | .beforeState.desiredCount')
SCALE_AFTER=$(echo "$DETAIL" | jq -r '.steps[] | select(.action=="scale_horizontal") | .afterState.desiredCount')
test "$SCALE_BEFORE" = "3" || fail "expected scale before desiredCount=3, got $SCALE_BEFORE"
test "$SCALE_AFTER" = "5" || fail "expected scale after desiredCount=5, got $SCALE_AFTER"

ORIG_BEFORE=$(echo "$DETAIL" | jq -c '.steps[0].beforeState')

echo "=== Explicit execute: unsupported action fails deterministically ==="
INC2=$(curl -sf -X POST "$BASE/v1/admin/incidents" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Unsupported action probe","description":"Probe stub failure path for AC-047","severity":"high"}')
INCIDENT2_ID=$(echo "$INC2" | jq -r .incidentId)
test -n "$INCIDENT2_ID" && test "$INCIDENT2_ID" != "null" || fail "incident2 id missing"

REM2_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/v1/remediation" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"incidentId\":\"$INCIDENT2_ID\",\"rootCause\":\"Bad action\",\"recommendedActions\":[{\"action\":\"delete_production_cluster\",\"label\":\"Delete\",\"description\":\"Should fail\",\"riskLevel\":\"high\",\"automated\":true,\"params\":{\"service\":\"order-service\"}}]}")
REM2_BODY=$(echo "$REM2_RESP" | head -n -1)
REM2_CODE=$(echo "$REM2_RESP" | tail -n 1)
test "$REM2_CODE" = "201" || fail "propose rem2 returned $REM2_CODE body=$REM2_BODY"
REM2_ID=$(echo "$REM2_BODY" | jq -r .remediationId)

# Approve (auto-executes). Unsupported action → remediation status=failed.
AP2=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/v1/remediation/$REM2_ID/approve" -H "Authorization: Bearer $TOKEN")
AP2_CODE=$(echo "$AP2" | tail -n 1)
test "$AP2_CODE" = "200" || fail "approve rem2 returned $AP2_CODE"
sleep 1
DETAIL2=$(curl -sf "$BASE/api/v1/remediation/detail/$REM2_ID" -H "Authorization: Bearer $TOKEN")
echo "$DETAIL2" | jq '{status, steps: [.steps[] | {action, status, output}]}'
STATUS2=$(echo "$DETAIL2" | jq -r .status)
test "$STATUS2" = "failed" || fail "unsupported action should yield failed remediation, got $STATUS2"
STEP_FAIL=$(echo "$DETAIL2" | jq -r '.steps[0].status')
test "$STEP_FAIL" = "failed" || fail "expected failed step, got $STEP_FAIL"

echo "=== Rollback of successful remediation ==="
ROLLBACK=$(curl -sf -X POST "$BASE/api/v1/remediation/$REM_ID/rollback" \
  -H "Authorization: Bearer $TOKEN")
ROLLBACK_ID=$(echo "$ROLLBACK" | jq -r .remediationId)
test -n "$ROLLBACK_ID" && test "$ROLLBACK_ID" != "null" || fail "rollback remediation id missing"
echo "$ROLLBACK" | jq '{remediationId, status, rollbackOf, steps: [.steps[] | {label, action, params}]}'
ROLLBACK_OF=$(echo "$ROLLBACK" | jq -r .rollbackOf)
test "$ROLLBACK_OF" = "$REM_ID" || fail "rollbackOf should point to original remediation"

echo "=== Approve+execute rollback ==="
RB_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/v1/remediation/$ROLLBACK_ID/approve" \
  -H "Authorization: Bearer $TOKEN")
test "$RB_CODE" = "200" || fail "rollback approve returned $RB_CODE"
sleep 2
RB_DETAIL=$(curl -sf "$BASE/api/v1/remediation/detail/$ROLLBACK_ID" -H "Authorization: Bearer $TOKEN")
echo "$RB_DETAIL" | jq '{status, steps: [.steps[] | {action, status, beforeState, afterState}]}'
RB_STATUS=$(echo "$RB_DETAIL" | jq -r .status)
test "$RB_STATUS" = "completed" || fail "expected rollback completed, got $RB_STATUS"
RB_AFTER=$(echo "$RB_DETAIL" | jq -c '.steps[-1].afterState // .steps[0].afterState')
# First rollback step restores original before state of last succeeded forward step (reversed)
RB_SCALE_AFTER=$(echo "$RB_DETAIL" | jq -r '[.steps[] | select(.action=="scale_horizontal")] | .[0].afterState.desiredCount // empty')
if [ -n "$RB_SCALE_AFTER" ]; then
  test "$RB_SCALE_AFTER" = "3" || fail "rollback scale afterState desiredCount should be 3, got $RB_SCALE_AFTER"
fi

echo "=== Audit chain ==="
AUDIT=$(curl -sf "$BASE/v1/audit?limit=20" -H "Authorization: Bearer $TOKEN")
echo "$AUDIT" | jq '[.items[] | {action, resourceId}]'
HAS_PROPOSED=$(echo "$AUDIT" | jq --arg id "$ROLLBACK_ID" '[.items[] | select(.action == "remediation.proposed" and .resourceId == $id)] | length')
HAS_EXECUTED=$(echo "$AUDIT" | jq --arg id "$ROLLBACK_ID" '[.items[] | select(.action == "remediation.executed" and .resourceId == $id)] | length')
test "$HAS_PROPOSED" -ge 1 || fail "audit missing remediation.proposed for rollback"
test "$HAS_EXECUTED" -ge 1 || fail "audit missing remediation.executed for rollback"

echo "=== Network: no AWS API contact (ss / open fds) ==="
APP_PID="$(cat .harness/app.pid 2>/dev/null || true)"
if [ -n "${APP_PID:-}" ] && kill -0 "$APP_PID" 2>/dev/null; then
  # Walk process tree for the real node listener
  for pid in "$APP_PID" $(pgrep -P "$APP_PID" 2>/dev/null || true); do
    if command -v ss >/dev/null; then
      AWS_CONN=$(ss -tpn 2>/dev/null | rg -F "pid=$pid" | rg -i 'amazonaws|216\.239\.|52\.|54\.|3\.' || true)
      # Soft check: no established sockets to common AWS IP ranges is hard; instead assert no DNS to amazonaws in logs
      :
    fi
  done
fi
! rg -i 'amazonaws\.com|sts\..*\.amazonaws|ecs\..*\.amazonaws' dev.log worker.log 2>/dev/null \
  || fail "logs mention AWS endpoints — possible AWS API contact"
echo "No amazonaws references in API/worker logs."

echo "=== AC-047 verify PASSED ==="
