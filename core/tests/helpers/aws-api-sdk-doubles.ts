import { vi } from 'vitest';
import {
  setAwsSdkImportForTests,
  clearAwsClientCache,
} from '../../src/modules/investigation/infra/aws-api-tool.js';

export const dynamoMockSend = vi.fn().mockResolvedValue({
  $metadata: { httpStatusCode: 200 },
  Items: [{ id: { S: 'item-1' } }],
  Count: 1,
});

const ecsMockSend = vi.fn().mockResolvedValue({
  $metadata: { httpStatusCode: 200, requestId: 'test' },
  services: [{ serviceName: 'api', status: 'ACTIVE', runningCount: 2 }],
});

const rdsMockSend = vi.fn().mockResolvedValue({
  $metadata: { httpStatusCode: 200 },
  DBInstances: [{ DBInstanceIdentifier: 'mydb', DBInstanceStatus: 'available' }],
});

function makeClient(send: ReturnType<typeof vi.fn>) {
  return class MockClient {
    send = send;
  };
}

function makeCommand(name: string) {
  return class MockCommand {
    input: Record<string, unknown>;
    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
    static name = name;
  };
}

const VIRTUAL_MODULES: Record<string, Record<string, unknown>> = {
  'virtual-sdk-ecs': {
    ECSClient: makeClient(ecsMockSend),
    DescribeServicesCommand: makeCommand('DescribeServicesCommand'),
  },
  'virtual-sdk-dynamodb': {
    DynamoDBClient: makeClient(dynamoMockSend),
    QueryCommand: makeCommand('QueryCommand'),
    DescribeTableCommand: makeCommand('DescribeTableCommand'),
  },
  'virtual-sdk-rds': {
    RDSClient: makeClient(rdsMockSend),
    DescribeDBInstancesCommand: makeCommand('DescribeDBInstancesCommand'),
  },
};

export function installAwsApiSdkDoubles(): void {
  clearAwsClientCache();
  setAwsSdkImportForTests(async (pkg) => {
    const mod = VIRTUAL_MODULES[pkg];
    if (!mod) {
      throw new Error(`No virtual SDK module registered for ${pkg}`);
    }
    return mod;
  });
}

export function resetAwsApiSdkDoubles(): void {
  dynamoMockSend.mockClear();
  ecsMockSend.mockClear();
  rdsMockSend.mockClear();
  clearAwsClientCache();
}

export function uninstallAwsApiSdkDoubles(): void {
  setAwsSdkImportForTests(undefined);
  clearAwsClientCache();
}
