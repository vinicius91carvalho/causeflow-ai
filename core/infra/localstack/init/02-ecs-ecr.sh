#!/bin/bash
set -euo pipefail

REGION="us-east-1"

echo "==> Creating ECR repository: causeflow"
awslocal ecr create-repository \
  --repository-name causeflow \
  --image-scanning-configuration scanOnPush=true \
  --region "$REGION" 2>/dev/null || echo "ECR repository causeflow already exists"

echo "==> Creating ECS cluster: causeflow"
awslocal ecs create-cluster \
  --cluster-name causeflow \
  --region "$REGION" 2>/dev/null || echo "ECS cluster causeflow already exists"

echo "==> LocalStack ECS/ECR init complete!"
echo "  ECR repository: causeflow"
echo "  ECS cluster: causeflow"
