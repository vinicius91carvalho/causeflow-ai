/**
 * Typed AWS client factory.
 *
 * Centralizes client instantiation so tests can mock at a single seam.
 * Tests use `aws-sdk-client-mock` to replace the ECS/CFN clients per-test
 * without needing to intercept these factory functions.
 *
 * Clients are NOT cached — scripts are single-use and cold-start tolerance
 * matters more than reuse. Caching also makes test isolation harder.
 */

import { ECSClient } from '@aws-sdk/client-ecs';
import { CloudFormationClient } from '@aws-sdk/client-cloudformation';

export function createEcsClient(region: string): ECSClient {
  return new ECSClient({ region });
}

export function createCfnClient(region: string): CloudFormationClient {
  return new CloudFormationClient({ region });
}
