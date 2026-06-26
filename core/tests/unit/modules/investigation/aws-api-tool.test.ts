import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAwsApiToolHandler, clearAwsClientCache } from '../../../../src/modules/investigation/infra/aws-api-tool.js';
import type { CloudCredentials } from '../../../../src/shared/application/ports/cloud-provider.port.js';

// Mock the dynamic imports
vi.mock('@aws-sdk/client-ecs', () => {
  const mockSend = vi.fn().mockResolvedValue({
    $metadata: { httpStatusCode: 200, requestId: 'test' },
    services: [{ serviceName: 'api', status: 'ACTIVE', runningCount: 2 }],
  });
  class MockECSClient {
    send = mockSend;
  }
  class DescribeServicesCommand {
    constructor(public input: Record<string, unknown>) {}
  }
  return { ECSClient: MockECSClient, DescribeServicesCommand };
});

vi.mock('@aws-sdk/client-dynamodb', () => {
  const mockSend = vi.fn().mockResolvedValue({
    $metadata: { httpStatusCode: 200 },
    Items: [{ id: { S: 'item-1' } }],
    Count: 1,
  });
  class MockDynamoDBClient {
    send = mockSend;
  }
  class QueryCommand {
    constructor(public input: Record<string, unknown>) {}
  }
  class DescribeTableCommand {
    constructor(public input: Record<string, unknown>) {}
  }
  return { DynamoDBClient: MockDynamoDBClient, QueryCommand, DescribeTableCommand };
});

vi.mock('@aws-sdk/client-rds', () => {
  const mockSend = vi.fn().mockResolvedValue({
    $metadata: { httpStatusCode: 200 },
    DBInstances: [{ DBInstanceIdentifier: 'mydb', DBInstanceStatus: 'available' }],
  });
  class MockRDSClient {
    send = mockSend;
  }
  class DescribeDBInstancesCommand {
    constructor(public input: Record<string, unknown>) {}
  }
  return { RDSClient: MockRDSClient, DescribeDBInstancesCommand };
});

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
  beforeEach(() => {
    clearAwsClientCache();
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
    expect(parsed.$metadata).toBeUndefined(); // $metadata stripped
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
    it('should auto-inject Limit: 1000 on DynamoDB Query when not specified', async () => {
      const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
      const handler = createAwsApiToolHandler(CREDS);
      await handler('aws_api_call', {
        service: 'dynamodb',
        action: 'Query',
        params: { TableName: 'my-table', KeyConditionExpression: 'id = :id' },
      });

      const mockClient = new DynamoDBClient({}) as unknown as { send: ReturnType<typeof vi.fn> };
      const lastCall = mockClient.send.mock.calls[mockClient.send.mock.calls.length - 1]?.[0];
      expect(lastCall?.input?.['Limit']).toBe(1000);
    });

    it('should preserve user-specified Limit on DynamoDB Query', async () => {
      const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
      const handler = createAwsApiToolHandler(CREDS);
      await handler('aws_api_call', {
        service: 'dynamodb',
        action: 'Query',
        params: { TableName: 'my-table', KeyConditionExpression: 'id = :id', Limit: 50 },
      });

      const mockClient = new DynamoDBClient({}) as unknown as { send: ReturnType<typeof vi.fn> };
      const lastCall = mockClient.send.mock.calls[mockClient.send.mock.calls.length - 1]?.[0];
      expect(lastCall?.input?.['Limit']).toBe(50);
    });

    it('should NOT inject Limit on non-Query DynamoDB actions', async () => {
      const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
      const handler = createAwsApiToolHandler(CREDS);
      await handler('aws_api_call', {
        service: 'dynamodb',
        action: 'DescribeTable',
        params: { TableName: 'my-table' },
      });

      const mockClient = new DynamoDBClient({}) as unknown as { send: ReturnType<typeof vi.fn> };
      const lastCall = mockClient.send.mock.calls[mockClient.send.mock.calls.length - 1]?.[0];
      expect(lastCall?.input?.['Limit']).toBeUndefined();
    });
  });
});
