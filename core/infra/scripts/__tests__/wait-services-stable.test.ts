import { describe, it, expect, beforeEach } from 'vitest';
import { waitForServiceStable } from '../wait-services-stable.js';
import { TimeoutError, VerifyError, ConfigError } from '../lib/errors.js';
import { MockEcsClient } from './ecs-mock.js';

function makeClock(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[Math.min(i, values.length - 1)] ?? 0;
    i++;
    return v;
  };
}

const noopSleep = async (): Promise<void> => undefined;

describe('waitForServiceStable', () => {
  let ecsMock: MockEcsClient;

  beforeEach(() => {
    ecsMock = new MockEcsClient();
  });

  it('returns stable state when rolloutState becomes COMPLETED', async () => {
    ecsMock
      .resolvesDescribeServicesOnce({
        services: [
          {
            serviceName: 'causeflow-staging',
            runningCount: 0,
            desiredCount: 1,
            taskDefinition: 'arn:aws:ecs:us-east-2:409171461008:task-definition/causeflow-staging:1',
            deployments: [
              {
                status: 'PRIMARY',
                rolloutState: 'IN_PROGRESS',
                taskDefinition:
                  'arn:aws:ecs:us-east-2:409171461008:task-definition/causeflow-staging:1',
              },
            ],
          },
        ],
      })
      .resolvesDescribeServices({
        services: [
          {
            serviceName: 'causeflow-staging',
            runningCount: 1,
            desiredCount: 1,
            taskDefinition: 'arn:aws:ecs:us-east-2:409171461008:task-definition/causeflow-staging:1',
            deployments: [
              {
                status: 'PRIMARY',
                rolloutState: 'COMPLETED',
                taskDefinition:
                  'arn:aws:ecs:us-east-2:409171461008:task-definition/causeflow-staging:1',
              },
            ],
          },
        ],
      });

    const result = await waitForServiceStable({
      client: ecsMock as never,
      clusterName: 'causeflow-staging',
      serviceName: 'causeflow-staging',
      friendlyName: 'api',
      timeoutMs: 60_000,
      pollIntervalMs: 1_000,
      sleep: noopSleep,
      now: makeClock([0, 1_000, 2_000]),
    });

    expect(result.rolloutState).toBe('COMPLETED');
    expect(result.runningCount).toBe(1);
    expect(result.service).toBe('api');
  });

  it('throws VerifyError when rolloutState becomes FAILED', async () => {
    ecsMock.resolvesDescribeServices({
      services: [
        {
          serviceName: 'causeflow-staging-worker',
          runningCount: 0,
          desiredCount: 1,
          taskDefinition:
            'arn:aws:ecs:us-east-2:409171461008:task-definition/causeflow-staging-worker:2',
          deployments: [
            {
              status: 'PRIMARY',
              rolloutState: 'FAILED',
              taskDefinition:
                'arn:aws:ecs:us-east-2:409171461008:task-definition/causeflow-staging-worker:2',
            },
          ],
        },
      ],
    });

    await expect(
      waitForServiceStable({
        client: ecsMock as never,
        clusterName: 'causeflow-staging',
        serviceName: 'causeflow-staging-worker',
        friendlyName: 'worker',
        timeoutMs: 60_000,
        pollIntervalMs: 1_000,
        sleep: noopSleep,
        now: makeClock([0, 1_000]),
      }),
    ).rejects.toBeInstanceOf(VerifyError);
  });

  it('throws TimeoutError when budget is exhausted', async () => {
    ecsMock.resolvesDescribeServices({
      services: [
        {
          serviceName: 'causeflow-staging',
          runningCount: 0,
          desiredCount: 1,
          taskDefinition:
            'arn:aws:ecs:us-east-2:409171461008:task-definition/causeflow-staging:1',
          deployments: [
            {
              status: 'PRIMARY',
              rolloutState: 'IN_PROGRESS',
              taskDefinition:
                'arn:aws:ecs:us-east-2:409171461008:task-definition/causeflow-staging:1',
            },
          ],
        },
      ],
    });

    await expect(
      waitForServiceStable({
        client: ecsMock as never,
        clusterName: 'causeflow-staging',
        serviceName: 'causeflow-staging',
        friendlyName: 'api',
        timeoutMs: 5_000,
        pollIntervalMs: 1_000,
        sleep: noopSleep,
        now: makeClock([0, 10_000]),
      }),
    ).rejects.toBeInstanceOf(TimeoutError);
  });

  it('throws VerifyError when the service is missing from the response', async () => {
    ecsMock.resolvesDescribeServices({ services: [] });

    await expect(
      waitForServiceStable({
        client: ecsMock as never,
        clusterName: 'causeflow-staging',
        serviceName: 'causeflow-staging',
        friendlyName: 'api',
        timeoutMs: 60_000,
        pollIntervalMs: 1_000,
        sleep: noopSleep,
        now: makeClock([0, 1_000]),
      }),
    ).rejects.toBeInstanceOf(VerifyError);
  });

  it('rejects zero or negative timeouts', async () => {
    await expect(
      waitForServiceStable({
        client: ecsMock as never,
        clusterName: 'causeflow-staging',
        serviceName: 'causeflow-staging',
        friendlyName: 'api',
        timeoutMs: 0,
        pollIntervalMs: 1_000,
        sleep: noopSleep,
      }),
    ).rejects.toBeInstanceOf(ConfigError);
  });
});
