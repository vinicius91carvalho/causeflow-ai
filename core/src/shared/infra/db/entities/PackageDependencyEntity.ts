import { Entity } from 'electrodb';
import { getDynamoClient } from '../client.js';
import { TABLE_NAME } from '../table.js';
export const PackageDependencyEntity = new Entity({
    model: { entity: 'packageDependency', version: '1', service: 'causeflow' },
    attributes: {
        tenantId: { type: 'string', required: true },
        repoFullName: { type: 'string', required: true },
        packageName: { type: 'string', required: true },
        version: { type: 'string', required: true },
        declaredIn: { type: 'string', required: true },
        isDev: { type: 'boolean', required: true, default: false },
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
            pk: { field: 'pk', composite: ['tenantId', 'repoFullName'] },
            sk: { field: 'sk', composite: ['packageName'] },
        },
        byPackage: {
            index: 'gsi1',
            pk: { field: 'gsi1pk', composite: ['tenantId', 'packageName'] },
            sk: { field: 'gsi1sk', composite: ['repoFullName'] },
        },
    },
}, { client: getDynamoClient(), table: TABLE_NAME });
