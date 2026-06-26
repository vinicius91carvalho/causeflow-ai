import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

// Helper to work around strict generic type mismatch between lib-dynamodb commands and DynamoDBDocumentClient.send()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const send = (client: DynamoDBDocumentClient, cmd: unknown): Promise<any> => client.send(cmd as Parameters<typeof client.send>[0]);
import { getDynamoClient, waitForDynamoDB, TABLE_NAME } from './setup.js';
import { v4 as uuid } from 'uuid';

describe('DynamoDB Integration', () => {
  let rawClient: DynamoDBClient;
  let docClient: DynamoDBDocumentClient;
  const testTenantId = `test-tenant-${uuid()}`;

  beforeAll(async () => {
    rawClient = getDynamoClient();
    docClient = DynamoDBDocumentClient.from(rawClient);
    await waitForDynamoDB(rawClient);
  });

  afterAll(() => {
    rawClient.destroy();
  });

  it('should put and get an item', async () => {
    const pk = `TENANT#${testTenantId}`;
    const sk = 'METADATA';
    const item = { pk, sk, name: 'Test Tenant', plan: 'pro', createdAt: new Date().toISOString() };

    await send(docClient, new PutCommand({ TableName: TABLE_NAME, Item: item }));

    const result = await send(docClient, new GetCommand({ TableName: TABLE_NAME, Key: { pk, sk } }));
    expect(result.Item).toBeDefined();
    expect(result.Item!['name']).toBe('Test Tenant');
    expect(result.Item!['plan']).toBe('pro');
  });

  it('should query by partition key', async () => {
    const pk = `INCIDENTS#${testTenantId}`;
    const items = [
      { pk, sk: 'INC#001', severity: 'critical', title: 'Incident 1' },
      { pk, sk: 'INC#002', severity: 'high', title: 'Incident 2' },
      { pk, sk: 'INC#003', severity: 'low', title: 'Incident 3' },
    ];

    for (const item of items) {
      await send(docClient, new PutCommand({ TableName: TABLE_NAME, Item: item }));
    }

    const result = await send(docClient, new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': pk },
    }));

    expect(result.Items).toHaveLength(3);
    expect(result.Items![0]!['sk']).toBe('INC#001');
  });

  it('should query GSI1', async () => {
    const gsi1pk = `STATUS#${testTenantId}#open`;
    const items = [
      { pk: `INC#${uuid()}`, sk: 'META', gsi1pk, gsi1sk: '2024-01-01T00:00:00Z', title: 'Open 1' },
      { pk: `INC#${uuid()}`, sk: 'META', gsi1pk, gsi1sk: '2024-01-02T00:00:00Z', title: 'Open 2' },
    ];

    for (const item of items) {
      await send(docClient, new PutCommand({ TableName: TABLE_NAME, Item: item }));
    }

    const result = await send(docClient, new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'gsi1',
      KeyConditionExpression: 'gsi1pk = :pk',
      ExpressionAttributeValues: { ':pk': gsi1pk },
    }));

    expect(result.Items!.length).toBeGreaterThanOrEqual(2);
  });

  it('should delete items', async () => {
    const pk = `DELETE_TEST#${testTenantId}`;
    const sk = 'ITEM#1';

    await send(docClient, new PutCommand({ TableName: TABLE_NAME, Item: { pk, sk, data: 'to-delete' } }));

    const before = await send(docClient, new GetCommand({ TableName: TABLE_NAME, Key: { pk, sk } }));
    expect(before.Item).toBeDefined();

    await send(docClient, new DeleteCommand({ TableName: TABLE_NAME, Key: { pk, sk } }));

    const after = await send(docClient, new GetCommand({ TableName: TABLE_NAME, Key: { pk, sk } }));
    expect(after.Item).toBeUndefined();
  });

  it('should support conditional writes', async () => {
    const pk = `COND#${testTenantId}`;
    const sk = 'ITEM#1';

    await send(docClient, new PutCommand({ TableName: TABLE_NAME, Item: { pk, sk, version: 1 } }));

    // Conditional put (should succeed)
    await send(docClient, new PutCommand({
      TableName: TABLE_NAME,
      Item: { pk, sk, version: 2 },
      ConditionExpression: 'version = :v',
      ExpressionAttributeValues: { ':v': 1 },
    }));

    const result = await send(docClient, new GetCommand({ TableName: TABLE_NAME, Key: { pk, sk } }));
    expect(result.Item!['version']).toBe(2);

    // Conditional put (should fail)
    await expect(send(docClient, new PutCommand({
      TableName: TABLE_NAME,
      Item: { pk, sk, version: 3 },
      ConditionExpression: 'version = :v',
      ExpressionAttributeValues: { ':v': 1 },
    }))).rejects.toThrow();
  });

  it('should handle audit hash chain pattern', async () => {
    const pk = `AUDIT#${testTenantId}`;
    let previousHash = '';

    for (let i = 0; i < 5; i++) {
      const entry = {
        pk,
        sk: `ENTRY#${String(i).padStart(10, '0')}`,
        action: 'test.action',
        previousHash,
        hash: `hash-${i}`,
        createdAt: new Date().toISOString(),
      };
      await send(docClient, new PutCommand({ TableName: TABLE_NAME, Item: entry }));
      previousHash = `hash-${i}`;
    }

    const result = await send(docClient, new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': pk },
      ScanIndexForward: true,
    }));

    expect(result.Items).toHaveLength(5);

    // Verify chain integrity
    let prevHash = '';
    for (const item of result.Items!) {
      expect(item['previousHash']).toBe(prevHash);
      prevHash = item['hash'] as string;
    }
  });
});
