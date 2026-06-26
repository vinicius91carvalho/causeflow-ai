#!/bin/bash
set -euo pipefail

REGION="us-east-1"
ENDPOINT="http://localhost:4566"

echo "==> Setting up Customer LocalStack infrastructure"

# --- CloudWatch Log Groups ---
echo "==> Creating CloudWatch Log Groups"
for LOG_GROUP in \
  "/ecs/payment-service" \
  "/ecs/api-gateway" \
  "/ecs/order-service" \
  "/ecs/inventory-service" \
  "/aws/lambda/email-notifier" \
  "/ecs/catalog-api" \
  "/ecs/order-api" \
  "/ecs/fulfillment-api"; do
  awslocal logs create-log-group --log-group-name "$LOG_GROUP" --region "$REGION" 2>/dev/null || true
  awslocal logs create-log-stream --log-group-name "$LOG_GROUP" --log-stream-name "default" --region "$REGION" 2>/dev/null || true
done

# --- IAM Role for STS AssumeRole ---
echo "==> Creating IAM Role for STS AssumeRole"
awslocal iam create-role \
  --role-name CauseFlowCrossAccountRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"AWS": "*"},
      "Action": "sts:AssumeRole"
    }]
  }' \
  --region "$REGION" 2>/dev/null || true

awslocal iam attach-role-policy \
  --role-name CauseFlowCrossAccountRole \
  --policy-arn "arn:aws:iam::aws:policy/ReadOnlyAccess" \
  --region "$REGION" 2>/dev/null || true

# --- ECS Cluster ---
echo "==> Creating ECS Cluster"
awslocal ecs create-cluster --cluster-name production --region "$REGION" 2>/dev/null || true

# --- ECS Task Definitions ---
echo "==> Creating ECS Task Definitions"
awslocal ecs register-task-definition \
  --family payment-service \
  --cpu "512" \
  --memory "1024" \
  --network-mode awsvpc \
  --requires-compatibilities FARGATE \
  --container-definitions '[{
    "name": "payment-service",
    "image": "payment-service:latest",
    "essential": true,
    "portMappings": [{"containerPort": 8080, "protocol": "tcp"}],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/payment-service",
        "awslogs-region": "us-east-1",
        "awslogs-stream-prefix": "ecs"
      }
    }
  }]' \
  --region "$REGION" 2>/dev/null || true

awslocal ecs register-task-definition \
  --family api-gateway \
  --cpu "256" \
  --memory "512" \
  --network-mode awsvpc \
  --requires-compatibilities FARGATE \
  --container-definitions '[{
    "name": "api-gateway",
    "image": "api-gateway:latest",
    "essential": true,
    "portMappings": [{"containerPort": 8080, "protocol": "tcp"}],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/api-gateway",
        "awslogs-region": "us-east-1",
        "awslogs-stream-prefix": "ecs"
      }
    }
  }]' \
  --region "$REGION" 2>/dev/null || true

# --- ECS Services (for describe_service) ---
echo "==> Creating ECS Services"
DEFAULT_SUBNET=$(awslocal ec2 describe-subnets --region "$REGION" --query 'Subnets[0].SubnetId' --output text 2>/dev/null || echo "")

if [ -n "$DEFAULT_SUBNET" ] && [ "$DEFAULT_SUBNET" != "None" ]; then
  awslocal ecs create-service \
    --cluster "production" \
    --service-name "payment-service" \
    --task-definition "payment-service" \
    --desired-count 2 \
    --launch-type "FARGATE" \
    --network-configuration "awsvpcConfiguration={subnets=[$DEFAULT_SUBNET],assignPublicIp=ENABLED}" \
    --region "$REGION" 2>/dev/null || true

  awslocal ecs create-service \
    --cluster "production" \
    --service-name "api-gateway" \
    --task-definition "api-gateway" \
    --desired-count 2 \
    --launch-type "FARGATE" \
    --network-configuration "awsvpcConfiguration={subnets=[$DEFAULT_SUBNET],assignPublicIp=ENABLED}" \
    --region "$REGION" 2>/dev/null || true
else
  echo "WARN: No default subnet found — ECS service creation skipped"
fi

echo "==> Customer LocalStack init complete!"
echo "  Log Groups: 8 (payment-service, api-gateway, order-service, inventory-service, email-notifier, catalog-api, order-api, fulfillment-api)"
echo "  IAM Role: CauseFlowCrossAccountRole"
echo "  ECS Cluster: production"
echo "  Task Definitions: payment-service, api-gateway"
echo "  ECS Services: payment-service, api-gateway"
