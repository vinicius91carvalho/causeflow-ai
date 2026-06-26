import { DynamoDBClient, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { CloudWatchLogsClient, DescribeLogGroupsCommand } from '@aws-sdk/client-cloudwatch-logs';
import Redis from 'ioredis';

const DYNAMODB_ENDPOINT = process.env['DYNAMODB_ENDPOINT'] ?? 'http://localhost:4566';
const CUSTOMER_ENDPOINT = process.env['CLOUD_PROVIDER_ENDPOINT'] ?? 'http://localhost:4567';
const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
const AWS_REGION = process.env['AWS_REGION'] ?? 'us-east-1';
const TABLE_NAME = process.env['DYNAMODB_TABLE_NAME'] ?? 'causeflow';

async function waitForCauseFlowLocalStack(retries = 20): Promise<void> {
  const client = new DynamoDBClient({
    region: AWS_REGION,
    endpoint: DYNAMODB_ENDPOINT,
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  });

  for (let i = 0; i < retries; i++) {
    try {
      await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
      console.log('[E2E Setup] CauseFlow LocalStack (DynamoDB) ready');
      return;
    } catch {
      if (i === retries - 1) throw new Error(`CauseFlow LocalStack DynamoDB table not ready after ${retries} retries`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

async function waitForCustomerLocalStack(retries = 20): Promise<void> {
  const client = new CloudWatchLogsClient({
    region: AWS_REGION,
    endpoint: CUSTOMER_ENDPOINT,
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  });

  for (let i = 0; i < retries; i++) {
    try {
      await client.send(new DescribeLogGroupsCommand({ limit: 1 }));
      console.log('[E2E Setup] Customer LocalStack (CloudWatch Logs) ready');
      return;
    } catch {
      if (i === retries - 1) throw new Error(`Customer LocalStack not ready after ${retries} retries`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

async function waitForRedis(retries = 10): Promise<void> {
  const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true, connectTimeout: 5000 });

  try {
    await redis.connect();
    for (let i = 0; i < retries; i++) {
      try {
        const pong = await redis.ping();
        if (pong === 'PONG') {
          console.log('[E2E Setup] Redis ready');
          return;
        }
      } catch {
        if (i === retries - 1) throw new Error(`Redis not ready after ${retries} retries`);
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  } finally {
    await redis.quit().catch(() => {});
  }
}

export async function setup(): Promise<void> {
  console.log('[E2E Setup] Waiting for infrastructure...');
  await Promise.all([
    waitForCauseFlowLocalStack(),
    waitForCustomerLocalStack(),
    waitForRedis(),
  ]);
  console.log('[E2E Setup] All infrastructure ready!');
}
