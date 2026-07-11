import { describe, it, expect, beforeEach } from 'vitest';
import { runVerify } from '../verify-deploy.js';
import type { DeployConfig, HealthResponse } from '../lib/types.js';
import { MockEcsClient } from './ecs-mock.js';

const noopSleep = async (): Promise<void> => undefined;

/** Deterministic clock generator. */
function makeClock(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[Math.min(i, values.length - 1)] ?? 0;
    i++;
    return v;
  };
}

/** Minimal JSON Response constructor for fake fetch. */
function makeJsonResponse(body: HealthResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const ACCOUNT_ID = '409171461008';
const REGION = 'us-east-2';
const EXPECTED_SHA = 'abcdef1234567890';
const SHORT_SHA = 'abcdef1';

const API_TD_ARN = `arn:aws:ecs:${REGION}:${ACCOUNT_ID}:task-definition/causeflow-staging:7`;
const WORKER_TD_ARN = `arn:aws:ecs:${REGION}:${ACCOUNT_ID}:task-definition/causeflow-staging-worker:3`;

const WORKER_IMAGE = `${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/causeflow-staging:worker-${SHORT_SHA}`;

function stableServiceResponse(
  serviceName: string,
  tdArn: string
): Record<string, unknown> {
  return {
    services: [
      {
        serviceName,
        runningCount: 1,
        desiredCount: 1,
        taskDefinition: tdArn,
        deployments: [
          {
            status: 'PRIMARY',
            rolloutState: 'COMPLETED',
            taskDefinition: tdArn,
          },
        ],
      },
    ],
  };
}

function baseConfig(overrides: Partial<DeployConfig> = {}): DeployConfig {
  return {
    stage: 'staging',
    region: REGION,
    expectedSha: EXPECTED_SHA,
    services: ['api', 'worker'],
    timeoutMs: 60_000,
    pollIntervalMs: 1_000,
    ...overrides,
  };
}

describe('runVerify', () => {
  let ecsMock: MockEcsClient;

  beforeEach(() => {
    ecsMock = new MockEcsClient();
  });

  it('returns allOk=true when both api and worker are stable and match', async () => {
    ecsMock
      .resolvesDescribeServices(stableServiceResponse('causeflow-staging', API_TD_ARN), {
        cluster: 'causeflow-staging',
        services: ['causeflow-staging'],
      })
      .resolvesDescribeServices(stableServiceResponse('causeflow-staging-worker', WORKER_TD_ARN), {
        cluster: 'causeflow-staging',
        services: ['causeflow-staging-worker'],
      })
      .resolvesDescribeTaskDefinition(
        {
          taskDefinition: {
            taskDefinitionArn: WORKER_TD_ARN,
            containerDefinitions: [{ name: 'investigation-worker', image: WORKER_IMAGE }],
          },
        },
        { taskDefinition: WORKER_TD_ARN },
      );

    const healthBody: HealthResponse = {
      status: 'ok',
      service: 'causeflow',
      version: '0.1.0',
      commit: SHORT_SHA,
      timestamp: '2026-04-11T22:00:00.000Z',
    };
    const fetchFn = async (): Promise<Response> => makeJsonResponse(healthBody);

    const output = await runVerify({
      config: baseConfig(),
      ecsClient: ecsMock as never,
      fetchFn: fetchFn as typeof fetch,
      sleep: noopSleep,
      now: makeClock([0, 500, 1_000, 1_500, 2_000, 2_500, 3_000, 3_500]),
      accountId: ACCOUNT_ID,
    });

    expect(output.allOk).toBe(true);
    expect(output.results).toHaveLength(2);

    const api = output.results.find((r) => r.service === 'api');
    expect(api?.ok).toBe(true);
    expect(api?.details?.commit).toBe(SHORT_SHA);
    expect(api?.details?.rolloutState).toBe('COMPLETED');
    expect(api?.details?.taskDefinitionArn).toBe(API_TD_ARN);

    const worker = output.results.find((r) => r.service === 'worker');
    expect(worker?.ok).toBe(true);
    expect(worker?.details?.image).toBe(WORKER_IMAGE);
    expect(worker?.details?.taskDefinitionArn).toBe(WORKER_TD_ARN);
  });

  it('returns allOk=false when worker image does not match the expected tag', async () => {
    ecsMock
      .resolvesDescribeServices(stableServiceResponse('causeflow-staging-worker', WORKER_TD_ARN), {
        cluster: 'causeflow-staging',
        services: ['causeflow-staging-worker'],
      })
      .resolvesDescribeTaskDefinition(
        {
          taskDefinition: {
            taskDefinitionArn: WORKER_TD_ARN,
            containerDefinitions: [
              {
                name: 'investigation-worker',
                image: `${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/causeflow-staging:worker-0000000`,
              },
            ],
          },
        },
        { taskDefinition: WORKER_TD_ARN },
      );

    const output = await runVerify({
      config: baseConfig({ services: ['worker'] }),
      ecsClient: ecsMock as never,
      sleep: noopSleep,
      now: makeClock([0, 500, 1_000, 1_500]),
      accountId: ACCOUNT_ID,
    });

    expect(output.allOk).toBe(false);
    expect(output.results).toHaveLength(1);
    const worker = output.results[0];
    expect(worker?.service).toBe('worker');
    expect(worker?.ok).toBe(false);
    expect(worker?.reason).toContain('Worker image mismatch');
    expect(worker?.reason).toContain(WORKER_IMAGE);
  });

  it('returns a per-service failure when VerifyError is thrown (no service in response)', async () => {
    ecsMock.resolvesDescribeServices({ services: [] }, {
      cluster: 'causeflow-staging',
      services: ['causeflow-staging'],
    });

    const output = await runVerify({
      config: baseConfig({ services: ['api'] }),
      ecsClient: ecsMock as never,
      sleep: noopSleep,
      now: makeClock([0, 500, 1_000]),
      accountId: ACCOUNT_ID,
    });

    expect(output.allOk).toBe(false);
    expect(output.results).toHaveLength(1);
    const api = output.results[0];
    expect(api?.service).toBe('api');
    expect(api?.ok).toBe(false);
    expect(api?.reason).toContain('DescribeServices returned no service');
  });

  it('builds production health URL and matches against short SHA', async () => {
    ecsMock.resolvesDescribeServices(
      stableServiceResponse(
        'causeflow-production',
        `arn:aws:ecs:${REGION}:${ACCOUNT_ID}:task-definition/causeflow-production:1`,
      ),
      {
        cluster: 'causeflow-production',
        services: ['causeflow-production'],
      },
    );

    const seenUrls: string[] = [];
    const healthBody: HealthResponse = {
      status: 'ok',
      service: 'causeflow',
      version: '0.1.0',
      commit: SHORT_SHA,
      timestamp: '2026-04-11T22:00:00.000Z',
    };
    const fetchFn = async (url: string | URL | Request): Promise<Response> => {
      seenUrls.push(typeof url === 'string' ? url : url.toString());
      return makeJsonResponse(healthBody);
    };

    const output = await runVerify({
      config: baseConfig({ stage: 'production', services: ['api'] }),
      ecsClient: ecsMock as never,
      fetchFn: fetchFn as typeof fetch,
      sleep: noopSleep,
      now: makeClock([0, 500, 1_000, 1_500, 2_000]),
      accountId: ACCOUNT_ID,
    });

    expect(output.allOk).toBe(true);
    expect(seenUrls[0]).toBe('https://api.causeflow.ai/health');
  });

  it('services are verified in the order declared in config', async () => {
    const clusterSeen: string[] = [];
    ecsMock.callsFakeDescribeServices((input) => {
      const svc = input.services?.[0] ?? '';
      clusterSeen.push(svc);
      const arn =
        svc === 'causeflow-staging'
          ? API_TD_ARN
          : `arn:aws:ecs:${REGION}:${ACCOUNT_ID}:task-definition/causeflow-staging-worker:3`;
      return stableServiceResponse(svc, arn);
    });
    ecsMock.resolvesDescribeTaskDefinition({
      taskDefinition: {
        taskDefinitionArn: WORKER_TD_ARN,
        containerDefinitions: [{ name: 'investigation-worker', image: WORKER_IMAGE }],
      },
    });

    const healthBody: HealthResponse = {
      status: 'ok',
      service: 'causeflow',
      version: '0.1.0',
      commit: SHORT_SHA,
      timestamp: '2026-04-11T22:00:00.000Z',
    };
    const fetchFn = async (): Promise<Response> => makeJsonResponse(healthBody);

    await runVerify({
      config: baseConfig({ services: ['worker', 'api'] }),
      ecsClient: ecsMock as never,
      fetchFn: fetchFn as typeof fetch,
      sleep: noopSleep,
      now: makeClock([0, 500, 1_000, 1_500, 2_000, 2_500, 3_000, 3_500]),
      accountId: ACCOUNT_ID,
    });

    expect(clusterSeen[0]).toBe('causeflow-staging-worker');
    expect(clusterSeen[clusterSeen.length - 1]).toBe('causeflow-staging');
  });
});
