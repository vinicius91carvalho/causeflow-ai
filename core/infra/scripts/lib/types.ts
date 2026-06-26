/**
 * Shared types for infra/scripts/*.
 *
 * This file is the contract between individual deploy scripts. Keep it small
 * and pure — no runtime imports from aws-sdk or node built-ins so unit tests
 * can consume the types without pulling in heavy dependencies.
 */

export type StageName = 'staging' | 'production';

export type ServiceName = 'api' | 'worker';

export interface DeployConfig {
  stage: StageName;
  region: string;
  expectedSha: string;
  services: ServiceName[];
  /** Total budget per service in ms. Default: 600_000 (10 min). */
  timeoutMs: number;
  /** Poll interval in ms. Default: 10_000. */
  pollIntervalMs: number;
}

export interface ServiceStable {
  service: ServiceName;
  clusterName: string;
  serviceName: string;
  rolloutState: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  taskDefinitionArn: string;
  runningCount: number;
  desiredCount: number;
  elapsedMs: number;
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  commit: string;
  timestamp: string;
}

export interface VerifyResult {
  service: ServiceName;
  ok: boolean;
  reason?: string;
  details?: Record<string, unknown>;
}

export interface ImageTags {
  /** Full image URI for the API container at the given SHA. */
  api: string;
  /** Full image URI for the worker container at the given SHA. */
  worker: string;
  /** The 7-char short SHA baked into `/health.commit`. */
  shortSha: string;
}
