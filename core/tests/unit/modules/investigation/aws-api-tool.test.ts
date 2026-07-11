import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { createAwsApiToolHandler } from '../../../../src/modules/investigation/infra/aws-api-tool.js';
import type { CloudCredentials } from '../../../../src/shared/application/ports/cloud-provider.port.js';
import {
  dynamoMockSend,
  installAwsApiSdkDoubles,
  resetAwsApiSdkDoubles,
  uninstallAwsApiSdkDoubles,
} from '../../../helpers/aws-api-sdk-doubles.js';

vi.mock('../../../../src/modules/investigation/infra/aws-service-map.js', () => ({
  getServiceEntry: (service: string) => {
    const map: Record<string, { pkg: string; client: string }> = {
      ecs: { pkg: 'virtual-sdk-ecs', client: 'ECSClient' },
      dynamodb: { pkg: 'virtual-sdk-dynamodb', client: 'DynamoDBClient' },
      rds: { pkg: 'virtual-sdk-rds', client: 'RDSClient' },
    };
    const entry = map[service.toLowerCase()];
    if (!entry) {
      throw new Error(`Unknown AWS service "${service}"`);
    }
    return entry;
  },
}));

const CREDS: CloudCredentials = {
  provider: 'aws',
  credentials: {
    accessKeyId: 'AKIATEST',
    secretAccessKey: 'test-secret',
    sessionToken: 'test-token',
  },
  region: 'us-east-1',
};

describe('aws-api-tool', () => {
  beforeAll(() => {
    installAwsApiSdkDoubles();
  });

  afterAll(() => {
    uninstallAwsApiSdkDoubles();
  });

  beforeEach(() => {
    resetAwsApiSdkDoubles();
  });

  it('should return null for non-matching tool name', async () => {
    const handler = createAwsApiToolHandler(CREDS);
    const result = await handler('query_logs', {});
    expect(result).toBeNull();
  });

  it('should handle DescribeServices on ECS', async () => {
    const handler = createAwsApiToolHandler(CREDS);
    const result = await handler('aws_api_call', {
      service: 'ecs',
      action: 'DescribeServices',
      params: { cluster: 'prod', services: ['api'] },
    });

    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!);
    expect(parsed.services).toBeDefined();
    expect(parsed.$metadata).toBeUndefined();
  });

  it('should handle DescribeDBInstances on RDS', async () => {
    const handler = createAwsApiToolHandler(CREDS);
    const result = await handler('aws_api_call', {
      service: 'rds',
      action: 'DescribeDBInstances',
      params: { DBInstanceIdentifier: 'mydb' },
    });

    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!);
    expect(parsed.DBInstances).toBeDefined();
    expect(parsed.$metadata).toBeUndefined();
  });

  it('should block write actions', async () => {
    const handler = createAwsApiToolHandler(CREDS);
    await expect(
      handler('aws_api_call', {
        service: 'ec2',
        action: 'TerminateInstances',
        params: { InstanceIds: ['i-123'] },
      }),
    ).rejects.toThrow('not a read-only action');
  });

  it('should throw for unknown service', async () => {
    const handler = createAwsApiToolHandler(CREDS);
    await expect(
      handler('aws_api_call', {
        service: 'nonexistent',
        action: 'DescribeSomething',
        params: {},
      }),
    ).rejects.toThrow('Unknown AWS service');
  });

  it('should throw for unknown action command', async () => {
    const handler = createAwsApiToolHandler(CREDS);
    await expect(
      handler('aws_api_call', {
        service: 'ecs',
        action: 'DescribeNonExistentResource',
        params: {},
      }),
    ).rejects.toThrow(/DescribeNonExistentResource/);
  });

  it('should default params to empty object', async () => {
    const handler = createAwsApiToolHandler(CREDS);
    const result = await handler('aws_api_call', {
      service: 'ecs',
      action: 'DescribeServices',
    });
    expect(result).not.toBeNull();
  });

  describe('DynamoDB Query Limit safeguard', () => {
    beforeEach(() => {
      dynamoMockSend.mockClear();
    });

    it('should auto-inject Limit: 1000 on DynamoDB Query when not specified', async () => {
      const handler = createAwsApiToolHandler(CREDS);
      await handler('aws_api_call', {
        service: 'dynamodb',
        action: 'Query',
        params: { TableName: 'my-table', KeyConditionExpression: 'id = :id' },
      });

      const lastCall = dynamoMockSend.mock.calls[dynamoMockSend.mock.calls.length - 1]?.[0];
      expect(lastCall?.input?.['Limit']).toBe(1000);
    });

    it('should preserve user-specified Limit on DynamoDB Query', async () => {
      const handler = createAwsApiToolHandler(CREDS);
      await handler('aws_api_call', {
        service: 'dynamodb',
        action: 'Query',
        params: { TableName: 'my-table', KeyConditionExpression: 'id = :id', Limit: 50 },
      });

      const lastCall = dynamoMockSend.mock.calls[dynamoMockSend.mock.calls.length - 1]?.[0];
      expect(lastCall?.input?.['Limit']).toBe(50);
    });

    it('should NOT inject Limit on non-Query DynamoDB actions', async () => {
      const handler = createAwsApiToolHandler(CREDS);
      await handler('aws_api_call', {
        service: 'dynamodb',
        action: 'DescribeTable',
        params: { TableName: 'my-table' },
      });

      const lastCall = dynamoMockSend.mock.calls[dynamoMockSend.mock.calls.length - 1]?.[0];
      expect(lastCall?.input?.['Limit']).toBeUndefined();
    });
  });
});
