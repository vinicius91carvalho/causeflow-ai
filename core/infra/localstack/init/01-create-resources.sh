#!/bin/bash
set -euo pipefail

REGION="us-east-1"
ENDPOINT="http://localhost:4566"
TABLE_NAME="causeflow-local"

echo "==> Creating DynamoDB table: $TABLE_NAME"
awslocal dynamodb create-table \
  --table-name "$TABLE_NAME" \
  --attribute-definitions \
    AttributeName=pk,AttributeType=S \
    AttributeName=sk,AttributeType=S \
    AttributeName=gsi1pk,AttributeType=S \
    AttributeName=gsi1sk,AttributeType=S \
    AttributeName=gsi2pk,AttributeType=S \
    AttributeName=gsi2sk,AttributeType=S \
    AttributeName=gsi3pk,AttributeType=S \
    AttributeName=gsi3sk,AttributeType=S \
  --key-schema \
    AttributeName=pk,KeyType=HASH \
    AttributeName=sk,KeyType=RANGE \
  --global-secondary-indexes \
    '[
      {
        "IndexName": "gsi1",
        "KeySchema": [{"AttributeName":"gsi1pk","KeyType":"HASH"},{"AttributeName":"gsi1sk","KeyType":"RANGE"}],
        "Projection": {"ProjectionType":"ALL"}
      },
      {
        "IndexName": "gsi2",
        "KeySchema": [{"AttributeName":"gsi2pk","KeyType":"HASH"},{"AttributeName":"gsi2sk","KeyType":"RANGE"}],
        "Projection": {"ProjectionType":"ALL"}
      },
      {
        "IndexName": "gsi3",
        "KeySchema": [{"AttributeName":"gsi3pk","KeyType":"HASH"},{"AttributeName":"gsi3sk","KeyType":"RANGE"}],
        "Projection": {"ProjectionType":"ALL"}
      }
    ]' \
  --billing-mode PAY_PER_REQUEST \
  --region "$REGION" \
  2>/dev/null || echo "Table $TABLE_NAME already exists"

echo "==> Enabling Point-in-Time Recovery on $TABLE_NAME"
awslocal dynamodb update-continuous-backups \
  --table-name "$TABLE_NAME" \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true \
  --region "$REGION" \
  2>/dev/null || echo "PITR already configured on $TABLE_NAME"

echo "==> Creating SQS queues"

# Alert queues
awslocal sqs create-queue --queue-name causeflow-alerts-dlq --region "$REGION" 2>/dev/null || true
ALERT_DLQ_ARN=$(awslocal sqs get-queue-attributes --queue-url "$ENDPOINT/000000000000/causeflow-alerts-dlq" --attribute-names QueueArn --region "$REGION" --query 'Attributes.QueueArn' --output text)
awslocal sqs create-queue \
  --queue-name causeflow-alerts \
  --attributes "{\"VisibilityTimeout\":\"300\",\"RedrivePolicy\":\"{\\\"deadLetterTargetArn\\\":\\\"$ALERT_DLQ_ARN\\\",\\\"maxReceiveCount\\\":\\\"3\\\"}\"}" \
  --region "$REGION" 2>/dev/null || true

# Investigation queues
awslocal sqs create-queue --queue-name causeflow-investigation-dlq --region "$REGION" 2>/dev/null || true
INV_DLQ_ARN=$(awslocal sqs get-queue-attributes --queue-url "$ENDPOINT/000000000000/causeflow-investigation-dlq" --attribute-names QueueArn --region "$REGION" --query 'Attributes.QueueArn' --output text)
awslocal sqs create-queue \
  --queue-name causeflow-investigation \
  --attributes "{\"VisibilityTimeout\":\"900\",\"RedrivePolicy\":\"{\\\"deadLetterTargetArn\\\":\\\"$INV_DLQ_ARN\\\",\\\"maxReceiveCount\\\":\\\"3\\\"}\"}" \
  --region "$REGION" 2>/dev/null || true

# Remediation queues
awslocal sqs create-queue --queue-name causeflow-remediation-dlq --region "$REGION" 2>/dev/null || true
REM_DLQ_ARN=$(awslocal sqs get-queue-attributes --queue-url "$ENDPOINT/000000000000/causeflow-remediation-dlq" --attribute-names QueueArn --region "$REGION" --query 'Attributes.QueueArn' --output text)
awslocal sqs create-queue \
  --queue-name causeflow-remediation \
  --attributes "{\"VisibilityTimeout\":\"600\",\"RedrivePolicy\":\"{\\\"deadLetterTargetArn\\\":\\\"$REM_DLQ_ARN\\\",\\\"maxReceiveCount\\\":\\\"3\\\"}\"}" \
  --region "$REGION" 2>/dev/null || true

# Triage queues
awslocal sqs create-queue --queue-name causeflow-triage-dlq --region "$REGION" 2>/dev/null || true
TRIAGE_DLQ_ARN=$(awslocal sqs get-queue-attributes --queue-url "$ENDPOINT/000000000000/causeflow-triage-dlq" --attribute-names QueueArn --region "$REGION" --query 'Attributes.QueueArn' --output text)
awslocal sqs create-queue \
  --queue-name causeflow-triage \
  --attributes "{\"VisibilityTimeout\":\"300\",\"RedrivePolicy\":\"{\\\"deadLetterTargetArn\\\":\\\"$TRIAGE_DLQ_ARN\\\",\\\"maxReceiveCount\\\":\\\"3\\\"}\"}" \
  --region "$REGION" 2>/dev/null || true

echo "==> Creating Secrets"
awslocal secretsmanager create-secret \
  --name causeflow/jwt-secret \
  --secret-string "localstack-jwt-secret-dev" \
  --region "$REGION" 2>/dev/null || true

awslocal secretsmanager create-secret \
  --name causeflow/anthropic-api-key \
  --secret-string "sk-ant-test-key" \
  --region "$REGION" 2>/dev/null || true

echo "==> Creating KMS key for token encryption"
awslocal kms create-alias \
  --alias-name "alias/causeflow-token-encryption" \
  --target-key-id "$(awslocal kms create-key --description 'CauseFlow token envelope encryption' --region "$REGION" --query 'KeyMetadata.KeyId' --output text)" \
  --region "$REGION" 2>/dev/null || true

echo "==> LocalStack init complete!"
echo "  DynamoDB table: $TABLE_NAME (3 GSIs, PITR enabled)"
echo "  SQS queues: alerts, triage, investigation, remediation (+ 4 DLQs)"
echo "  Secrets: jwt-secret, anthropic-api-key"
echo "  KMS: alias/causeflow-token-encryption"
