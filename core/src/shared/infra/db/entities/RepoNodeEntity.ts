import { Entity } from 'electrodb';
import { getDynamoClient } from '../client.js';
import { TABLE_NAME } from '../table.js';
export const RepoNodeEntity = new Entity({
    model: { entity: 'repoNode', version: '1', service: 'causeflow' },
    attributes: {
        tenantId: { type: 'string', required: true },
        repoFullName: { type: 'string', required: true },
        provider: {
            type: ['github'],
            required: true,
            default: 'github',
        },
        language: { type: 'string' },
        defaultBranch: { type: 'string' },
        lastCommitSha: { type: 'string' },
        lastIndexedAt: { type: 'string' },
        fileCount: { type: 'number' },
        config: { type: 'any' },
        createdAt: {
            type: 'string',
            required: true,
            default: () => new Date().toISOString(),
            readOnly: true,
        },
        updatedAt: {
            type: 'string',
            required: true,
            default: () => new Date().toISOString(),
            watch: '*',
            set: () => new Date().toISOString(),
        },
    },
    indexes: {
        primary: {
            pk: { field: 'pk', composite: ['tenantId'] },
            sk: { field: 'sk', composite: ['repoFullName'] },
        },
        byLanguage: {
            index: 'gsi1',
            pk: { field: 'gsi1pk', composite: ['tenantId'] },
            sk: { field: 'gsi1sk', composite: ['language', 'repoFullName'] },
        },
    },
}, { client: getDynamoClient(), table: TABLE_NAME });
