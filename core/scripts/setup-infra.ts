#!/usr/bin/env tsx
import { DynamoDBClient, CreateTableCommand, UpdateContinuousBackupsCommand } from '@aws-sdk/client-dynamodb';
import { SQSClient, CreateQueueCommand } from '@aws-sdk/client-sqs';
import { KMSClient, CreateAliasCommand, CreateKeyCommand } from '@aws-sdk/client-kms';

const ENDPOINT = 'http://localhost:4566';
const REGION = 'us-east-1';
const TABLE_NAME = 'causeflow-local';

const client = new DynamoDBClient({ region: REGION, endpoint: ENDPOINT, credentials: { accessKeyId: 'test', secretAccessKey: 'test' } });
const sqs = new SQSClient({ region: REGION, endpoint: ENDPOINT, credentials: { accessKeyId: 'test', secretAccessKey: 'test' } });
const kms = new KMSClient({ region: REGION, endpoint: ENDPOINT, credentials: { accessKeyId: 'test', secretAccessKey: 'test' } });

async function main() {
  // 1. Create DynamoDB table
  try {
    await client.send(new CreateTableCommand({
      TableName: TABLE_NAME,
      AttributeDefinitions: [
        { AttributeName: 'pk', AttributeType: 'S' },
        { AttributeName: 'sk', AttributeType: 'S' },
        { AttributeName: 'gsi1pk', AttributeType: 'S' },
        { AttributeName: 'gsi1sk', AttributeType: 'S' },
        { AttributeName: 'gsi2pk', AttributeType: 'S' },
        { AttributeName: 'gsi2sk', AttributeType: 'S' },
        { AttributeName: 'gsi3pk', AttributeType: 'S' },
        { AttributeName: 'gsi3sk', AttributeType: 'S' },
      ],
      KeySchema: [
        { AttributeName: 'pk', KeyType: 'HASH' },
        { AttributeName: 'sk', KeyType: 'RANGE' },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'gsi1',
          KeySchema: [
            { AttributeName: 'gsi1pk', KeyType: 'HASH' },
            { AttributeName: 'gsi1sk', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
        {
          IndexName: 'gsi2',
          KeySchema: [
            { AttributeName: 'gsi2pk', KeyType: 'HASH' },
            { AttributeName: 'gsi2sk', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
        {
          IndexName: 'gsi3',
          KeySchema: [
            { AttributeName: 'gsi3pk', KeyType: 'HASH' },
            { AttributeName: 'gsi3sk', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    }));
    console.log(`Table ${TABLE_NAME} created`);
  } catch (e: any) {
    if (e.name === 'ResourceInUseException') console.log(`Table ${TABLE_NAME} already exists`);
    else throw e;
  }

  // 2. Enable PITR
  try {
    await client.send(new UpdateContinuousBackupsCommand({
      TableName: TABLE_NAME,
      PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true },
    }));
    console.log('PITR enabled');
  } catch (e: any) {
    console.log(`PITR error: ${e.message}`);
  }

  // 3. Create SQS queues
  const queues = ['causeflow-alerts', 'causeflow-triage', 'causeflow-investigation', 'causeflow-remediation',
    'causeflow-alerts-dlq', 'causeflow-triage-dlq', 'causeflow-investigation-dlq', 'causeflow-remediation-dlq'];
  for (const q of queues) {
    try {
      const result = await sqs.send(new CreateQueueCommand({
        QueueName: q,
        Attributes: {
          ...(q.endsWith('-dlq') ? {} : { RedrivePolicy: JSON.stringify({ deadLetterTargetArn: '', maxReceiveCount: '3' }) }),
        },
      }));
      console.log(`Queue ${q} created: ${result.QueueUrl}`);
    } catch (e: any) {
      if (e.name === 'QueueAlreadyExists') console.log(`Queue ${q} already exists`);
      else throw e;
    }
  }

  // 4. Create KMS key + alias
  try {
    const key = await kms.send(new CreateKeyCommand({
      Description: 'CauseFlow token encryption key',
      KeyUsage: 'ENCRYPT_DECRYPT',
    }));
    await kms.send(new CreateAliasCommand({
      AliasName: 'alias/causeflow-token-encryption',
      TargetKeyId: key.KeyMetadata!.KeyId!,
    }));
    console.log('KMS key + alias created');
  } catch (e: any) {
    if (e.name === 'AlreadyExistsException' || e.name === 'ConflictException') console.log('KMS alias already exists');
    else throw e;
  }

  console.log('Infra setup complete');
}

main().catch(console.error);
