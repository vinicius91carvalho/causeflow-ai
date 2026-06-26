# Local Testing Guide

End-to-end testing of the CauseFlow backend without deploying to AWS.

## Prerequisites

- Docker (with compose)
- AWS CLI (for MiniStack resource creation)
- Python 3 with `requests` (for webhook simulation)
- Clerk Backend API secret key

## 1. Start Infrastructure

```bash
# Hindsight needs ANTHROPIC_API_KEY
export ANTHROPIC_API_KEY=<your-key>

docker compose up -d redis ministack hindsight
```

Wait for health checks:

```bash
docker compose ps  # all should be "healthy" or "Up"
curl http://localhost:4566/_ministack/health  # MiniStack
curl http://localhost:8888/health              # Hindsight
```

## 2. Create AWS Resources on MiniStack

```bash
export AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_DEFAULT_REGION=us-east-1

# DynamoDB table with GSIs
aws dynamodb create-table --endpoint-url http://localhost:4566 \
  --table-name causeflow-staging \
  --attribute-definitions \
    AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S \
    AttributeName=gsi1pk,AttributeType=S AttributeName=gsi1sk,AttributeType=S \
    AttributeName=gsi2pk,AttributeType=S AttributeName=gsi2sk,AttributeType=S \
  --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE \
  --global-secondary-indexes \
    '[{"IndexName":"gsi1","KeySchema":[{"AttributeName":"gsi1pk","KeyType":"HASH"},{"AttributeName":"gsi1sk","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"},"ProvisionedThroughput":{"ReadCapacityUnits":5,"WriteCapacityUnits":5}},
      {"IndexName":"gsi2","KeySchema":[{"AttributeName":"gsi2pk","KeyType":"HASH"},{"AttributeName":"gsi2sk","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"},"ProvisionedThroughput":{"ReadCapacityUnits":5,"WriteCapacityUnits":5}}]' \
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5

# SQS queues
for q in causeflow-staging-alerts causeflow-staging-investigation causeflow-staging-remediation; do
  aws sqs create-queue --endpoint-url http://localhost:4566 --queue-name "$q"
done
```

## 3. Start Backend

```bash
set -a && source .env.staging

# Override to point at local services
export NODE_ENV=staging
export DYNAMODB_ENDPOINT=http://localhost:4566
export SQS_ENDPOINT=http://localhost:4566
export SQS_ALERT_QUEUE_URL=http://localhost:4566/000000000000/causeflow-staging-alerts
export SQS_INVESTIGATION_QUEUE_URL=http://localhost:4566/000000000000/causeflow-staging-investigation
export SQS_REMEDIATION_QUEUE_URL=http://localhost:4566/000000000000/causeflow-staging-remediation
export HINDSIGHT_BASE_URL=http://localhost:8888
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_REGION=us-east-1

npx tsx src/main.ts
```

Verify: `curl http://localhost:3000/health` should return `{"status":"ok"}`.

## 4. Provision Tenant via Clerk Webhooks

Clerk sends webhooks signed with Svix. To simulate locally, sign the payload with the webhook secret.

### Python helper

```python
import hmac, hashlib, base64, time, json, requests

WEBHOOK_SECRET = "whsec_<your-clerk-webhook-secret>"
secret_bytes = base64.b64decode(WEBHOOK_SECRET.replace("whsec_", ""))

def send_webhook(payload: dict, msg_id: str) -> requests.Response:
    body = json.dumps(payload, separators=(',', ':'))
    ts = str(int(time.time()))
    sig = base64.b64encode(
        hmac.new(secret_bytes, f"{msg_id}.{ts}.{body}".encode(), hashlib.sha256).digest()
    ).decode()
    return requests.post(
        "http://localhost:3000/v1/auth/clerk-webhook",
        data=body,
        headers={
            "svix-id": msg_id,
            "svix-timestamp": ts,
            "svix-signature": f"v1,{sig}",
            "Content-Type": "application/json",
        },
    )
```

### Step 1: Create organization (tenant)

```python
send_webhook({
    "data": {
        "id": "org_<clerk-org-id>",
        "name": "My Company",
        "slug": "my-company",
        "created_at": 1700000000000,
        "created_by": "user_<clerk-user-id>",
    },
    "type": "organization.created",
    "object": "event",
    "timestamp": 1700000000000,
    "instance_id": "ins_<clerk-instance-id>",
}, "msg_org_001")
# Expected: 200 {"received": true}
```

### Step 2: Add member (user)

```python
send_webhook({
    "data": {
        "id": "orgmem_001",
        "organization": {"id": "org_<clerk-org-id>", "name": "My Company"},
        "public_user_data": {
            "user_id": "user_<clerk-user-id>",
            "first_name": "John",
            "last_name": "Doe",
            "identifier": "john@example.com",
        },
        "role": "org:admin",
    },
    "type": "organizationMembership.created",
    "object": "event",
    "timestamp": 1700000000001,
    "instance_id": "ins_<clerk-instance-id>",
}, "msg_member_001")
# Expected: 200 {"received": true}
```

## 5. Get a Session JWT

Clerk session tokens are the auth mechanism for all API routes. Generate one via the Clerk Backend API:

```bash
# List active sessions for a user
curl -s "https://api.clerk.com/v1/sessions?user_id=user_<id>&status=active" \
  -H "Authorization: Bearer sk_test_<clerk-secret-key>"

# Create a session JWT (expires in 60s)
curl -s "https://api.clerk.com/v1/sessions/<session-id>/tokens" \
  -X POST \
  -H "Authorization: Bearer sk_test_<clerk-secret-key>" \
  -H "Content-Type: application/json"
# Returns: { "jwt": "eyJ..." }
```

**Note:** Session tokens expire in 60 seconds. Generate a fresh one before each test batch.

## 6. Test Authenticated Routes

```bash
TOKEN=<jwt-from-step-5>

# Auth context
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/v1/auth/me
# → { "tenantId": "org_...", "userId": "user_...", "roles": ["admin"] }

# Tenant
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/v1/tenants/<org-id>
# → { "name": "...", "plan": "starter", "creditsTotal": 15, ... }

# Users
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/v1/users
# → { "items": [{ "email": "...", "role": "admin", ... }] }

# Incidents (empty initially)
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/v1/incidents
# → { "items": [] }

# Integrations
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/v1/integrations
# → { "integrations": [] }  (or Composio connections if configured)

# AWS setup (trust policy for customer)
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/v1/integrations/aws-setup
# → { "accountId": "...", "externalId": "<org-id>", "trustPolicy": {...} }

# Connect a provider via Composio OAuth
curl -X POST http://localhost:3000/v1/integrations/connect \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"provider":"github","redirectUrl":"http://localhost:3001/integrations/callback"}'
# → { "authUrl": "https://connect.composio.dev/link/..." }

# Test AWS connection
curl -X POST http://localhost:3000/v1/integrations/test-connection \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"aws","roleArn":"arn:aws:iam::123456789:role/CauseflowRole"}'
# → { "success": true/false, "message": "..." }
```

## Supported Composio Providers

| Provider | Category |
|----------|----------|
| `github`, `gitlab`, `bitbucket` | Code |
| `slack`, `teams`, `discord` | Communication |
| `jira`, `linear`, `trello`, `shortcut`, `clickup`, `asana` | Project Management |
| `datadog`, `sentry`, `pagerduty`, `newrelic` | Monitoring |
| `notion`, `confluence` | Knowledge |
| `hubspot`, `zendesk`, `intercom` | CRM & Support |

## Architecture Notes

- **tenantId** always comes from the JWT `o.id` claim (Clerk org_id), never from request body/params
- **MiniStack** replaces LocalStack — single port 4566, supports DynamoDB, SQS, ECS, Secrets Manager, STS, KMS
- **Hindsight** is the agent memory engine — always enabled, no feature flag
- **Composio** handles all third-party OAuth flows and token management
- **AWS STS Assume Role** and **Relay** are the only non-Composio integrations
