# Staging Deploy Guide

Manual/emergency deploy guide for `causeflow-staging` ECS.

**Normal deploys:** push to `main` → GitHub Actions runs the full CI/CD pipeline automatically (`test → build-and-push → CDK deploy staging → verify → CDK deploy production → verify`). No manual steps needed.

**This guide covers manual and emergency deploys only** — use it when CI is broken, for hotfixes that can't wait for CI, or when applying env var / secret changes outside a normal code push.

## Prerequisites

- AWS CLI configured with access to account `409171461008` (us-east-2)
- Docker installed
- ECR login cached (step 1 below)

## Environment

| Resource | Value |
|---|---|
| ECR Repo | `409171461008.dkr.ecr.us-east-2.amazonaws.com/causeflow-staging` |
| ECS Cluster | `causeflow-staging` |
| ECS Service | `causeflow-staging` |
| API URL | `https://api-staging.causeflow.ai` |
| Region | `us-east-2` |

## Deploy Steps

### 1. Build

```bash
docker build -t causeflow-staging:latest .
```

### 2. Push to ECR

```bash
ECR=409171461008.dkr.ecr.us-east-2.amazonaws.com/causeflow-staging

# Login (cached for 12h)
aws ecr get-login-password --region us-east-2 | docker login --username AWS --password-stdin $ECR

# Tag and push
docker tag causeflow-staging:latest $ECR:<tag-name>
docker push $ECR:<tag-name>
```

Use a descriptive tag (e.g. `billing-refactor`, `dedup-fix`). Avoid `latest` to track what's deployed.

### 3. Deploy via CDK

> ⚠️ CDK owns all task definitions. NEVER use `aws ecs register-task-definition` directly —
> it conflicts with CDK state. To change a task definition, modify `infra/cdk/lib/causeflow-stack.ts`
> and redeploy via CDK.

```bash
cd infra/cdk
pnpm install --frozen-lockfile
npx cdk deploy causeflow-staging \
  --require-approval never \
  -c stage=staging \
  -c imageTag=<tag-name> \
  -c deployServices=true
```

### 4. Monitor rollout

```bash
# Poll until COMPLETED
aws ecs describe-services --cluster causeflow-staging --services causeflow-staging --region us-east-2 \
  --query 'services[0].deployments[*].{status: status, running: runningCount, rollout: rolloutState}' \
  --output table
```

### 5. Verify

```bash
curl https://api-staging.causeflow.ai/health
# Expected: {"status":"ok","service":"causeflow","version":"0.1.0",...}
```

### 6. Check logs

```bash
# Find current task log stream
TASK_ID=$(aws ecs list-tasks --cluster causeflow-staging --service-name causeflow-staging \
  --region us-east-2 --query 'taskArns[0]' --output text | rev | cut -d/ -f1 | rev)

aws logs get-log-events --log-group-name /ecs/causeflow-staging \
  --log-stream-name "ecs/causeflow/$TASK_ID" \
  --region us-east-2 --limit 30 --no-start-from-head --output text
```

## Worker Task Definition

The investigation worker (`causeflow-staging-worker`) uses the **same Docker image** as the API server but with a different entrypoint. It must be updated alongside the API server.

### Update worker after push

> ⚠️ The `causeflow-staging-worker` task definition is CDK-managed. NEVER use `aws ecs register-task-definition` directly. To update the worker image, push the new image to ECR and redeploy via CDK (see step 3 above) — CDK picks up the new `imageTag` and updates both the API and worker task definitions atomically.

The worker is **not a long-running service** — it's launched as a one-off Fargate task per investigation via `dispatchFargateTask()`. The API server references `causeflow-staging-worker` (no version) which resolves to the latest active revision.

### Key differences: API server vs Worker

| | API Server | Worker |
|---|---|---|
| Task def | `causeflow-staging` | `causeflow-staging-worker` |
| Entrypoint | `node dist/main.js` (default) | `node dist/workers/investigation-worker.js` |
| Lifecycle | Long-running ECS service | One-off Fargate task (exits after investigation) |
| Dispatched by | ECS service | `task-dispatcher.ts` via SQS consumer |
| Log stream prefix | `ecs/causeflow/` | `worker/investigation-worker/` |

### Worker log streams

```bash
# Find latest worker log stream
aws logs describe-log-streams --log-group-name /ecs/causeflow-staging --region us-east-2 \
  --order-by LastEventTime --descending --limit 10 \
  --query 'logStreams[*].logStreamName' --output text | tr '\t' '\n' | grep worker
```

## Quick deploy (build + push + deploy API + worker)

API and worker use **separate Docker images** with separate tags:

```bash
ECR=409171461008.dkr.ecr.us-east-2.amazonaws.com/causeflow-staging

# 1. Login to ECR
aws ecr get-login-password --region us-east-2 | docker login --username AWS --password-stdin $ECR

# 2. Build both images
docker build -t causeflow-staging:latest -f Dockerfile .
docker build -t causeflow-staging:worker-latest -f Dockerfile.worker .

# 3. Tag and push
docker tag causeflow-staging:latest $ECR:latest
docker tag causeflow-staging:worker-latest $ECR:worker-latest
docker push $ECR:latest
docker push $ECR:worker-latest

# 4. Deploy via CDK (updates both API and worker task definitions)
cd infra/cdk
pnpm install --frozen-lockfile
npx cdk deploy causeflow-staging \
  --require-approval never \
  -c stage=staging \
  -c imageTag=latest \
  -c deployServices=true

# 5. Verify
aws ecs describe-services --cluster causeflow-staging --services causeflow-staging --region us-east-2 \
  --query 'services[0].deployments[0].rolloutState' --output text
```

## Adding/Removing Secrets or Env Vars

Secrets (from Secrets Manager) and plain env vars are defined in `infra/cdk/lib/causeflow-stack.ts` — CDK is the authoritative source. To modify:

1. Edit `infra/cdk/lib/causeflow-stack.ts` (update `environment` or `secrets` in the relevant task definition construct)
2. Redeploy via CDK:

```bash
cd infra/cdk
pnpm install --frozen-lockfile
npx cdk deploy causeflow-staging \
  --require-approval never \
  -c stage=staging \
  -c imageTag=<current-tag> \
  -c deployServices=true
```

Current secrets: JWT_SECRET, ANTHROPIC_API_KEY, CLERK_SECRET_KEY, CLERK_WEBHOOK_SECRET, RESEND_API_KEY, VAPID_*, STRIPE_*, LANGFUSE_*, HINDSIGHT_API_KEY (25 total).

Current env vars: AWS_REGION, PORT, STAGE, SQS_ALERTS_QUEUE_URL, SQS_INVESTIGATION_QUEUE_URL, SQS_REMEDIATION_QUEUE_URL, SQS_PROGRESS_QUEUE_URL, ECS_*, HINDSIGHT_BASE_URL, DYNAMODB_TABLE_NAME, AWS_ACCOUNT_ID, NODE_ENV, REDIS_URL, ECS_SUBNET_IDS, ECS_SECURITY_GROUP_IDS, INVESTIGATION_RELAY_URL (17 total).

### Worker-specific env vars (in worker task def only)

| Variable | Value | Purpose |
|---|---|---|
| `ORCHESTRATOR_MODE_ENABLED` | `true` | Uses single orchestrator agent instead of wave pipeline |
| `MASTRA_ENABLED` | `true` | Uses Mastra agent runner instead of EnhancedPTCRunner |
| `INVESTIGATION_RELAY_URL` | `wss://api-staging.causeflow.ai/v1/investigation/ws` | WebSocket relay for real-time user interaction |
| `INVESTIGATION_MAX_TIMEOUT_MS` | `600000` | 10 min watchdog timeout |

## Hindsight Memory Service

Sprint 4 added a 3rd ECS service: `causeflow-staging-hindsight` (ghcr.io/vectorize-io/hindsight).

### Architecture

```
Internet → ALB → causeflow-staging (API, port 3000)
                      |
               [Cloud Map DNS: causeflow-staging.local]
                      |
               hindsight.causeflow-staging.local:8888
                      |
              causeflow-staging-worker (SQS consumer)
```

All three services run in the same VPC private subnets. Hindsight has its own `hindsightSg` with inbound 8888 (API) and 9999 (UI debug) from `serviceSg`.

| Service | ECS Name | Task Def Family |
|---|---|---|
| API | `causeflow-staging` | `causeflow-staging` |
| Worker | `causeflow-staging-worker` | `causeflow-staging-worker` |
| Hindsight | `causeflow-staging-hindsight` | `causeflow-staging-hindsight` |

### EFS Persistence

Hindsight writes embedded PostgreSQL to `/home/hindsight/.pg0`. EFS file system `causeflow-staging-hindsight-fs` mounts this path via access point `/data`.

- **Staging:** EFS One Zone (single AZ, ~$0.80/mo at 5 GB). Data is durable within the AZ — memory banks are recreatable if the AZ goes down, but survive normal task restarts.
- **Production:** EFS Standard (multi-AZ, `removalPolicy: RETAIN`) — data is fully preserved across restarts and retained on stack deletion.
- **Transit encryption:** enabled. **IAM authorization:** enabled.

### uid/gid assumption

EFS access point uses `uid: '1000', gid: '1000'` (convention for `ghcr.io/vectorize-io/hindsight`). Docker is unavailable in the proot-distro build environment so this was not verified pre-deploy.

**Verify on first deploy:**
```bash
TASK=$(aws ecs list-tasks --cluster causeflow-staging --service-name causeflow-staging-hindsight \
  --region us-east-2 --query 'taskArns[0]' --output text)
aws ecs execute-command --cluster causeflow-staging --task $TASK \
  --container hindsight --interactive --command 'id; ls -la /home/hindsight'
```
If the container runs as root (uid 0), update `createAcl`/`posixUser` in `causeflow-stack.ts` to `uid: '0', gid: '0'` and redeploy.

### Persistence validation runbook

1. Create a memory bank via API: `POST /v1/memory/banks { "name": "test-bank" }`
2. Force task replacement: `aws ecs update-service --cluster causeflow-staging --service causeflow-staging-hindsight --force-new-deployment --region us-east-2`
3. Wait for RUNNING: `aws ecs describe-services --cluster causeflow-staging --services causeflow-staging-hindsight --region us-east-2 --query 'services[0].deployments[0].rolloutState' --output text`
4. Confirm bank survives restart: `GET /v1/memory/banks` — `test-bank` must still appear.

### Health check note

The Hindsight task uses `curl -f http://localhost:8888/health || exit 1`. If the first deploy shows curl missing (task crash-loops), replace with `wget -qO- http://localhost:8888/health || exit 1` in `causeflow-stack.ts` and redeploy.

### Dashboard deploy

Dashboard deploys automatically via GitHub Actions on push to `main`. See `causeflow-web/docs/deployment/dashboard-deploy.md`.

**No manual deploy needed** — just push to main:
```bash
cd causeflow-web
git push origin main
# GitHub Actions: build → validate → deploy to staging via SST
```

Production deploy is manual via workflow dispatch in GitHub Actions.
