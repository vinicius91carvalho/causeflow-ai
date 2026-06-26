#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CauseFlowStack } from '../lib/causeflow-stack';

const app = new cdk.App();
const stage = app.node.tryGetContext('stage') ?? 'staging';

new CauseFlowStack(app, `causeflow-${stage}`, {
  env: { account: '409171461008', region: 'us-east-2' },
  stage,
});
