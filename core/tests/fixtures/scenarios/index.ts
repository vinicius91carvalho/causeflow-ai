import type { CodeCommit, CommitDiff, CodeFile, CodeDeployment } from '../../../src/shared/application/ports/code-repository.port.js';

export interface FixtureScenario {
  name: string;
  description: string;
  commits: CodeCommit[];
  diffs: Record<string, CommitDiff>;
  files: Record<string, CodeFile>;
  deployments: CodeDeployment[];
}

export { oomMemoryLeak } from './oom-memory-leak.js';
export { connectionPoolExhaustion } from './connection-pool-exhaustion.js';
export { nPlusOneQuery } from './n-plus-one-query.js';
export { unhandledPromise } from './unhandled-promise.js';
export { raceCondition } from './race-condition.js';
export { configRegression } from './config-regression.js';
export { dependencyUpgrade } from './dependency-upgrade.js';
export { featureFlagBug } from './feature-flag-bug.js';
