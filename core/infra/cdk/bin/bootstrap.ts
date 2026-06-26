#!/usr/bin/env node
/**
 * CauseFlow Bootstrap CDK App
 * ---------------------------
 * Separate entry point for the control-plane bootstrap stack (OIDC provider +
 * GitHub Actions deploy role). Kept isolated from `bin/causeflow.ts` so that
 * a broken app-stack deploy can never break — or require — the deploy role.
 *
 * Deploy ONCE manually with admin credentials:
 *
 *   cd infra/cdk
 *   npx cdk --app "npx ts-node --prefer-ts-exts bin/bootstrap.ts" \
 *     deploy causeflow-bootstrap --require-approval never
 *
 * Or use the npm script:
 *
 *   pnpm run bootstrap:deploy
 *
 * After it deploys, copy the CloudFormation outputs into GitHub Actions
 * repo variables (Settings → Secrets and variables → Actions → Variables):
 *
 *   - AWS_ACCOUNT_ID
 *   - AWS_REGION
 *   - ECR_REGISTRY
 *   - DEPLOY_ROLE_ARN
 *
 * See `infra/cdk/README.md` for the full one-time bootstrap procedure.
 */
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BootstrapStack } from '../lib/bootstrap-stack';

const app = new cdk.App();

const awsAccountId = app.node.tryGetContext('awsAccountId') ?? '409171461008';
const awsRegion = app.node.tryGetContext('awsRegion') ?? 'us-east-2';
const githubOrg = app.node.tryGetContext('githubOrg') ?? 'causeflow';
const githubRepo = app.node.tryGetContext('githubRepo') ?? 'core';

new BootstrapStack(app, 'causeflow-bootstrap', {
  env: { account: awsAccountId, region: awsRegion },
  awsAccountId,
  awsRegion,
  githubOrg,
  githubRepo,
  description:
    'CauseFlow control-plane bootstrap: GitHub Actions OIDC provider and the causeflow-github-deploy role. Deploy once manually with admin credentials.',
});
