# 12 — Production Maintenance Guide

[< Back to index](./00-index.md) | [Previous: Testing](./11-testing.md)

---

> This guide is for anyone responsible for keeping CauseFlow running in production.
> It covers: what to monitor, how to debug problems, and runbooks for common situations.

---

## What to Monitor

### 1. Health Checks

```bash
# Quick check
curl https://api.causeflow.ai/health
# → { "status": "ok" }

# Detailed check
curl https://api.causeflow.ai/health/detailed
# → { "status": "healthy",
#     "services": {
#       "dynamodb": { "status": "healthy", "latencyMs": 3 },
#       "redis": { "status": "healthy", "latencyMs": 1 },
#       "sqs": { "status": "healthy", "latencyMs": 5 }
#     }}
```

**Action if unhealthy:**
- `dynamodb: unhealthy` → Check AWS console, throttling limits
- `redis: unhealthy` → Check ElastiCache, memory, connections
- `sqs: unhealthy` → Check SQS console, IAM permissions

### 2. Critical Metrics

| Metric | Where to View | Alert Threshold |
|--------|--------------|-----------------|
| API P99 latency | CloudWatch | > 2s |
| 5xx error rate | CloudWatch/ALB | > 1% |
| SQS queue depth | SQS Console | > 100 messages |
| DLQ messages | SQS Console | > 0 (any message is a problem) |
| Redis memory | ElastiCache | > 80% |
| ECS CPU | ECS Metrics | > 80% |
| ECS Memory | ECS Metrics | > 80% |
| Claude API cost | Langfuse | > $X/day (define baseline) |
| Hindsight service availability (agent memory) | Health check / Hindsight dashboard | Unavailable > 2 min |
| Composio API availability | Composio status + health probe | Down > 1 min |
| Composio webhook delivery | Composio dashboard | Failure rate > 5% |
| Stripe webhook delivery success rate | Stripe dashboard | Success < 99% |
| Clerk auth failure rate | Clerk dashboard | > 2% |
| Memory/chat Redis cache hit rate | CloudWatch / Redis INFO | < 70% |
| Langfuse trace ingestion | Langfuse dashboard | Ingestion lag > 5 min or drop > 10% |

### 3. Logs

Logs are structured JSON (Pino) sent to CloudWatch:

```bash
# View recent logs in CloudWatch
aws logs tail /ecs/causeflow-staging --follow

# Search for errors
aws logs filter-log-events \
  --log-group-name /ecs/causeflow-staging \
  --filter-pattern "ERROR"

# Search for a specific incident
aws logs filter-log-events \
  --log-group-name /ecs/causeflow-staging \
  --filter-pattern '{ $.incidentId = "inc_xyz789" }'
```

### 4. Langfuse (LLM Observability)

Access the Langfuse dashboard to monitor:
- **Cost per trace** — how much each investigation is costing
- **Latency per agent** — which agents are slow
- **LLM error rate** — whether Claude is failing
- **Quality** — eval scores (if configured)

---

## Runbooks: Common Problems

### Problem: "DLQ has messages"

```
SYMPTOM: Messages appeared in the DLQ (Dead Letter Queue)
SEVERITY: MEDIUM-HIGH (incidents are not being processed)

DIAGNOSIS:
1. Identify WHICH DLQ has messages:
   - causeflow-{stage}-alerts-dlq → Alert ingestion/triage failing
   - causeflow-{stage}-investigation-dlq → Investigation failing
   - causeflow-{stage}-remediation-dlq → Remediation execution failing
   - causeflow-{stage}-progress-dlq → Investigation progress streaming failing (worker → API)

2. Read the message from the DLQ:
   aws sqs receive-message --queue-url <DLQ_URL> --max-number-of-messages 1

3. Read the logs using the incidentId from the message:
   aws logs filter-log-events --log-group-name /ecs/causeflow-{stage} \
     --filter-pattern '{ $.incidentId = "<ID>" }'

COMMON CAUSES:
- Claude API unavailable → Check status.anthropic.com
- STS credentials failing → Check tenant role ARN
- Timeout → Message too large or Claude is slow
- Parser bug → Unexpected alert format

FIX:
- If transient (Claude timeout): reprocess the message
  aws sqs send-message --queue-url <ORIGINAL_QUEUE_URL> \
    --message-body '<DLQ MESSAGE BODY>'
- If bug: fix it, deploy, then reprocess
```

### Problem: "Rate limiting blocking a legitimate tenant"

```
SYMPTOM: Tenant receiving 429 Too Many Requests
SEVERITY: MEDIUM

DIAGNOSIS:
1. Check the tenant's plan:
   curl -H "Authorization: Bearer <admin-jwt>" \
     https://api.causeflow.ai/v1/tenants/<tenantId>
   → Check the "plan" field and corresponding rate limit

2. Check if Redis is UP:
   redis-cli ping → PONG

FIX:
- If the tenant needs more requests: upgrade the plan
  PATCH /v1/tenants/<tenantId> { "plan": "enterprise" }
- If Redis is DOWN: the in-memory fallback may have lower limits
  → Restart Redis
```

### Problem: "Investigation stuck in 'investigating'"

```
SYMPTOM: Incident stays in "investigating" status for more than 10 minutes
SEVERITY: HIGH (incident is not being resolved)

DIAGNOSIS:
1. Check if the message is in the investigation queue:
   aws sqs get-queue-attributes --queue-url <INVESTIGATION_QUEUE_URL> \
     --attribute-names ApproximateNumberOfMessages

2. Check consumer logs:
   aws logs filter-log-events --log-group-name /ecs/causeflow-staging \
     --filter-pattern '{ $.incidentId = "<ID>" && $.module = "investigation" }'

3. Check Langfuse → look for the investigation trace

COMMON CAUSES:
- Claude API slow or timing out
- STS AssumeRole failing (invalid tenant role ARN)
- Agent stuck in a tool call loop (rare)

FIX:
- If Claude is slow: wait (can take up to 5 minutes)
- If STS is failing: check role ARN in tenant settings
- If stuck: kill the process and restart the consumer
  → ECS: force new deployment
```

### Problem: "STS credentials failing"

```
SYMPTOM: Agents cannot access the tenant's AWS resources
SEVERITY: HIGH

DIAGNOSIS:
1. Check if the tenant has awsRoleArn configured:
   GET /v1/tenants/<tenantId> → settings.awsRoleArn

2. Test AssumeRole manually:
   aws sts assume-role \
     --role-arn <TENANT_ARN> \
     --role-session-name test \
     --external-id <TENANT_ID>

COMMON CAUSES:
- Incorrect role ARN
- Trust policy does not include the CauseFlow account
- Wrong ExternalId
- Role was deleted by the tenant

FIX:
- The tenant must fix the IAM Role in their account
- Document the correct trust policy for the tenant
```

### Problem: "Audit hash chain corrupted"

```
SYMPTOM: Audit trail integrity check fails
SEVERITY: CRITICAL (possible data tampering)

DIAGNOSIS:
1. Run verification:
   GET /v1/audit/verify?tenantId=<ID>

2. If it fails: identify WHICH entry is inconsistent

COMMON CAUSES:
- Code bug (entry written without previousHash)
- Race condition (two entries written simultaneously)
- Malicious tampering (rare, but possible)

FIX:
- If bug: fix it and rewrite the entry with the correct hash
- If race condition: add distributed lock (Redis SETNX)
- If tampering: escalate to security IMMEDIATELY
```

### Problem: "Composio integration failing"

```
SYMPTOM: Agents cannot invoke 3rd-party tools (GitHub, Slack, Jira, etc.);
         triggers from Composio sources stop firing
SEVERITY: HIGH (degraded investigation capability, missed triggers)
IMPACT: No 3rd-party tools available for agents; trigger-based alerts stop entering the pipeline

DIAGNOSIS:
1. Check Composio status page and /health/detailed → composio block
2. Check logs for Composio errors:
   aws logs filter-log-events --log-group-name /ecs/causeflow-staging \
     --filter-pattern '{ $.module = "composio" && $.level = "error" }'
3. Check Composio dashboard → webhook delivery failures + connection status
4. Verify API token validity:
   curl -H "Authorization: Bearer <COMPOSIO_API_KEY>" https://backend.composio.dev/api/v1/connectedAccounts

COMMON CAUSES:
- Tenant OAuth tokens expired (user revoked access or token TTL elapsed)
- Composio API outage
- CauseFlow Composio API key rotated without updating secret
- Rate limiting from Composio side

FIX:
- Expired tenant tokens: notify tenant to re-authorize the integration in the UI
- Composio outage: wait; degrade gracefully (agents continue without 3rd-party tools)
- Rotated key: update COMPOSIO_API_KEY in secrets manager + restart ECS service
- Rate limit: back off and retry; escalate to Composio support if persistent
```

### Problem: "Hindsight disconnected"

```
SYMPTOM: Agent memory service (Hindsight) unreachable;
         no known-solution short-circuit, no pattern recall
SEVERITY: MEDIUM (agents still run, but lose prior learning benefits)
IMPACT: Investigations restart from zero each time — higher cost, higher latency,
        no reuse of previously validated solutions. Agents remain functional.

DIAGNOSIS:
1. Check /health/detailed → hindsight block
2. Check logs:
   aws logs filter-log-events --log-group-name /ecs/causeflow-{stage} \
     --filter-pattern '{ $.module = "hindsight" }'
3. Probe Hindsight directly:
   curl https://hindsight.causeflow.com/health
4. Check circuit breaker state (if implemented) — may be open after repeated failures

COMMON CAUSES:
- Hindsight service down or deploying
- Network/DNS issue between CauseFlow and Hindsight
- Auth token for Hindsight expired
- Hindsight internal storage (vector DB) degraded

FIX:
- Service down: restart Hindsight; agents auto-degrade to no-memory mode
- Auth: rotate HINDSIGHT_API_KEY + redeploy
- If prolonged: confirm graceful degradation is active (agents run without memory)
- Once Hindsight returns: circuit breaker auto-closes; no manual replay needed
```

### Problem: "Stripe webhooks not firing"

```
SYMPTOM: Subscription status in CauseFlow drifts from Stripe
         (tenant upgraded/downgraded/cancelled but quota not updated)
SEVERITY: HIGH (quota enforcement stale — possible over- or under-billing)
IMPACT: Tenants may be blocked despite paying, or continue consuming while cancelled

DIAGNOSIS:
1. Stripe Dashboard → Developers → Webhooks → view recent deliveries
   Look for failed or pending deliveries to the CauseFlow endpoint
2. Check CauseFlow logs for webhook receipt:
   aws logs filter-log-events --log-group-name /ecs/causeflow-staging \
     --filter-pattern '{ $.route = "/webhooks/stripe" }'
3. Verify webhook endpoint is reachable:
   curl -X POST https://api.causeflow.ai/webhooks/stripe → expect 400 (no signature)
4. Confirm STRIPE_WEBHOOK_SECRET matches the endpoint's signing secret

COMMON CAUSES:
- CauseFlow endpoint returned 5xx (triggering Stripe backoff/disable)
- STRIPE_WEBHOOK_SECRET mismatch after rotation
- Endpoint disabled in Stripe dashboard after repeated failures
- Firewall / ALB rule blocking Stripe IPs

FIX:
- MITIGATION: In Stripe dashboard, select failed events and click "Resend"
  (re-delivers webhook; CauseFlow will reconcile subscription state)
- Re-enable the endpoint if Stripe disabled it
- Fix signature mismatch and redeploy
- For bulk drift: run subscription reconciliation job
  (pulls current state from Stripe API and updates local records)
```

### Problem: "Clerk webhook drops"

```
SYMPTOM: User lifecycle events (user.created, user.updated, user.deleted) not synced;
         orphan users in CauseFlow or missing users for logged-in sessions
SEVERITY: MEDIUM (user experience degraded, no data loss)
IMPACT: Orphan users in DB; new Clerk users missing from CauseFlow tenant;
        deleted users still present; profile updates not propagated

DIAGNOSIS:
1. Clerk Dashboard → Webhooks → view recent deliveries and failures
2. Check CauseFlow logs for webhook receipt:
   aws logs filter-log-events --log-group-name /ecs/causeflow-staging \
     --filter-pattern '{ $.route = "/webhooks/clerk" }'
3. Verify CLERK_WEBHOOK_SECRET matches Clerk's signing secret
4. Check Clerk auth failure rate (see metrics table) — spike may indicate related issue

COMMON CAUSES:
- Endpoint 5xx during Clerk delivery (Clerk backs off)
- Signature verification failure after secret rotation
- Webhook endpoint disabled in Clerk after repeated failures
- Event handler throwing on unknown event type

FIX:
- MITIGATION: In Clerk dashboard, resync users via "Resend" on failed events,
  or trigger a full user resync job via the Clerk admin API
- Fix signature mismatch and redeploy
- For orphan cleanup: run user reconciliation job
  (compares Clerk user list vs CauseFlow users; deletes/creates as needed)
- Re-enable the webhook endpoint in Clerk if disabled
```

---

## Periodic Maintenance Tasks

### Daily
- [ ] Check detailed health check
- [ ] Check DLQs (zero messages = healthy)
- [ ] Review Claude API costs in Langfuse

### Weekly
- [ ] Check performance metrics (P99 latency, error rate)
- [ ] Check DynamoDB size (storage)
- [ ] Check Redis memory
- [ ] Review patterns in Knowledge (new patterns learned?)

### Monthly
- [ ] Check audit hash chain integrity
- [ ] Review and rotate secrets (JWT_SECRET, WEBHOOK_SECRET)
- [ ] Update dependencies (pnpm update)
- [ ] Run LLM quality eval (pnpm eval:triage)
- [ ] Review AWS costs (DynamoDB, SQS, ECS, Redis)

### Quarterly
- [ ] Review IAM roles and permissions
- [ ] Security audit (OWASP top 10)
- [ ] Review rate limits per plan
- [ ] Backup verification

---

## Deploy

### How to Deploy

CauseFlow is deployed via CI/CD (automated pipeline):

```
1. Create branch: git checkout -b feat/my-change
2. Make changes + local tests (pnpm typecheck && pnpm test:run && pnpm lint-invariants)
3. Push: git push origin feat/my-change
4. Open PR on GitHub
5. CI runs: typecheck + unit tests + lint-invariants
6. Review + merge to main
7. CI automatically:
   a. Builds and pushes Docker images to ECR (API + worker, tagged by git SHA)
   b. Deploys to staging via CDK (cdk deploy causeflow-staging)
   c. Verifies staging deploy (verify-deploy script checks running SHA matches expected)
   d. Deploys to production via CDK (cdk deploy causeflow-production) — requires passing staging verify
   e. Verifies production deploy
```

### Rollback

If something goes wrong after a deploy:

```bash
# Rollback via CDK redeploy with a previous image SHA
cd infra/cdk
npx cdk deploy causeflow-staging \
  --require-approval never \
  -c stage=staging \
  -c imageTag=<PREVIOUS_SHA> \
  -c deployServices=true

# Production rollback (same pattern)
npx cdk deploy causeflow-production \
  --require-approval never \
  -c stage=production \
  -c imageTag=<PREVIOUS_SHA> \
  -c deployServices=true

# Find previous SHA from ECR image list
aws ecr describe-images --repository-name causeflow-staging \
  --region us-east-2 \
  --query 'sort_by(imageDetails, &imagePushedAt)[-10:].imageTags' \
  --output json
```

---

## Useful Production Commands

```bash
# View logs in real time
aws logs tail /ecs/causeflow-staging --follow

# View queue status
aws sqs get-queue-attributes --queue-url <URL> \
  --attribute-names All

# Force a new deployment (without code change)
aws ecs update-service --cluster causeflow-staging --service causeflow-staging \
  --force-new-deployment

# View running tasks
aws ecs list-tasks --cluster causeflow-staging --service-name causeflow-staging

# View logs for a specific task
aws ecs describe-tasks --cluster causeflow-staging --tasks <TASK_ID>
```

> **Note:** For production, replace `causeflow-staging` with `causeflow-production`.

[< Back to index](./00-index.md)
