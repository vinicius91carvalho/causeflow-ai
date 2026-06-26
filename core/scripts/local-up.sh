#!/bin/bash
# Start CauseFlow backend locally pointing to MiniStack + Hindsight + Redis.
# Requires: .env.staging (download secrets with scripts/pull-env.sh)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

# ── Check prerequisites ─────────────────────────────────────────────
if [ ! -f .env.staging ]; then
  echo "ERROR: .env.staging not found. Run scripts/pull-env.sh first."
  exit 1
fi

# ── Start Docker services ───────────────────────────────────────────
echo "Starting Redis + MiniStack + Hindsight..."
export $(grep '^ANTHROPIC_API_KEY=' .env.staging | xargs)
docker compose up -d redis ministack hindsight

echo "Waiting for services..."
sleep 5

# Wait for MiniStack health
for i in {1..20}; do
  if curl -sf http://localhost:4566/_ministack/health > /dev/null 2>&1; then
    echo "MiniStack ready."
    break
  fi
  sleep 2
done

# Wait for Hindsight health
for i in {1..20}; do
  if curl -sf http://localhost:8888/health > /dev/null 2>&1; then
    echo "Hindsight ready."
    break
  fi
  sleep 3
done

# ── Create DynamoDB table + SQS queues on MiniStack ─────────────────
export AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_DEFAULT_REGION=us-east-1

echo "Creating DynamoDB table..."
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
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
  > /dev/null 2>&1 || echo "(table already exists)"

echo "Creating SQS queues..."
for q in causeflow-staging-alerts causeflow-staging-investigation causeflow-staging-remediation; do
  aws sqs create-queue --endpoint-url http://localhost:4566 --queue-name "$q" > /dev/null 2>&1 || true
done

# ── Start backend ────────────────────────────────────────────────────
echo ""
echo "Starting CauseFlow backend..."
lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null || true

set -a
source .env.staging
export NODE_ENV=staging
export HINDSIGHT_BASE_URL=http://localhost:8888
export DYNAMODB_ENDPOINT=http://localhost:4566
export SQS_ENDPOINT=http://localhost:4566
export SQS_ALERT_QUEUE_URL=http://localhost:4566/000000000000/causeflow-staging-alerts
export SQS_INVESTIGATION_QUEUE_URL=http://localhost:4566/000000000000/causeflow-staging-investigation
export SQS_REMEDIATION_QUEUE_URL=http://localhost:4566/000000000000/causeflow-staging-remediation
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_REGION=us-east-1
set +a

exec npx tsx src/main.ts
