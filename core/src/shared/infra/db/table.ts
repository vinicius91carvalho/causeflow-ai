import { CreateTableCommand, DescribeTableCommand, } from '@aws-sdk/client-dynamodb';
import { getDynamoClient } from './client.js';
import { config } from '../../config/index.js';
import { logger } from '../logger.js';
export const TABLE_NAME = config.aws.tableName;
const tableDefinition = {
    TableName: TABLE_NAME,
    KeySchema: [
        { AttributeName: 'pk', KeyType: 'HASH' },
        { AttributeName: 'sk', KeyType: 'RANGE' },
    ],
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
};
export async function ensureTable(): Promise<void> {
    const client = getDynamoClient();
    try {
        await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
        logger.debug({ table: TABLE_NAME }, 'DynamoDB table exists');
    }
    catch (err) {
        if (err instanceof Error && err.name === 'ResourceNotFoundException') {
            logger.info({ table: TABLE_NAME }, 'Creating DynamoDB table');
            await client.send(new CreateTableCommand(tableDefinition as import('@aws-sdk/client-dynamodb').CreateTableCommandInput));
            logger.info({ table: TABLE_NAME }, 'DynamoDB table created');
        }
        else {
            throw err;
        }
    }
}
