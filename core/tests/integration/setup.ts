import { DynamoDBClient, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { SQSClient, GetQueueUrlCommand } from '@aws-sdk/client-sqs';
import Redis from 'ioredis';

const DYNAMODB_ENDPOINT = process.env['DYNAMODB_ENDPOINT'] ?? 'http://localhost:4566';
const SQS_ENDPOINT = process.env['SQS_ENDPOINT'] ?? 'http://localhost:4566';
const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
const AWS_REGION = process.env['AWS_REGION'] ?? 'us-east-1';
const TABLE_NAME = process.env['DYNAMODB_TABLE_NAME'] ?? 'causeflow';

export function getDynamoClient(): DynamoDBClient {
  return new DynamoDBClient({
    region: AWS_REGION,
    endpoint: DYNAMODB_ENDPOINT,
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  });
}

export function getSQSClient(): SQSClient {
  return new SQSClient({
    region: AWS_REGION,
    endpoint: SQS_ENDPOINT,
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  });
}

export function getRedisClient(): Redis {
  return new Redis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    connectTimeout: 5000,
  });
}

export async function waitForDynamoDB(client: DynamoDBClient, retries = 10): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
      return;
    } catch {
      if (i === retries - 1) throw new Error(`DynamoDB table ${TABLE_NAME} not ready after ${retries} retries`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

export async function waitForSQS(client: SQSClient, queueName: string, retries = 10): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await client.send(new GetQueueUrlCommand({ QueueName: queueName }));
      return result.QueueUrl!;
    } catch {
      if (i === retries - 1) throw new Error(`SQS queue ${queueName} not ready after ${retries} retries`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error('Unreachable');
}

export async function waitForRedis(redis: Redis, retries = 10): Promise<void> {
  await redis.connect();
  for (let i = 0; i < retries; i++) {
    try {
      const pong = await redis.ping();
      if (pong === 'PONG') return;
    } catch {
      if (i === retries - 1) throw new Error(`Redis not ready after ${retries} retries`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

export { TABLE_NAME, AWS_REGION, DYNAMODB_ENDPOINT, SQS_ENDPOINT, REDIS_URL };
