import { UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { BillingAccountEntity } from '../../../shared/infra/db/entities/BillingAccountEntity.js';
import { getDynamoClient } from '../../../shared/infra/db/client.js';
import { TABLE_NAME } from '../../../shared/infra/db/table.js';
import type { IBillingAccountRepository } from '../domain/billing-account.repository.js';
import type { BillingAccount } from '../domain/billing-account.entity.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { UsageType } from '../../../shared/domain/types.js';
function isConditionalCheckFailed(error: unknown) {
    if (!(error instanceof Error))
        return false;
    return (error.name === 'ConditionalCheckFailedException' ||
        (error as any).__type === 'ConditionalCheckFailedException' ||
        error.message?.includes('ConditionalCheckFailedException'));
}
function toDomain(raw: Record<string, any>): BillingAccount {
    return {
        tenantId: raw['tenantId'],
        investigationsLimit: raw['investigationsLimit'] ?? 0,
        investigationsUsed: raw['investigationsUsed'] ?? 0,
        eventsLimit: raw['eventsLimit'] ?? 0,
        eventsUsed: raw['eventsUsed'] ?? 0,
        createdAt: raw['createdAt'],
        updatedAt: raw['updatedAt'],
    };
}
export class DynamoBillingAccountRepository {
    async create(account: BillingAccount): Promise<BillingAccount> {
        const result = await BillingAccountEntity.create({
            tenantId: account.tenantId,
            investigationsLimit: account.investigationsLimit,
            investigationsUsed: account.investigationsUsed,
            eventsLimit: account.eventsLimit,
            eventsUsed: account.eventsUsed,
        }).go();
        return toDomain(result.data);
    }
    async findByTenantId(tenantId: TenantId): Promise<BillingAccount | null> {
        const result = await BillingAccountEntity.get({ tenantId }).go();
        if (!result.data)
            return null;
        return toDomain(result.data);
    }
    async update(tenantId: TenantId, data: Partial<Omit<BillingAccount, 'tenantId' | 'createdAt'>>): Promise<BillingAccount> {
        const result = await BillingAccountEntity.patch({ tenantId })
            .set(data)
            .go({ response: 'all_new' });
        return toDomain(result.data);
    }
    async incrementUsageAtomic(tenantId: TenantId, type: UsageType): Promise<boolean> {
        const usedField = type === 'investigation' ? 'investigationsUsed' : 'eventsUsed';
        const limitField = type === 'investigation' ? 'investigationsLimit' : 'eventsLimit';
        const client = getDynamoClient();
        try {
            await client.send(new UpdateItemCommand({
                TableName: TABLE_NAME,
                Key: {
                    pk: { S: `$causeflow#tenantid_${String(tenantId).toLowerCase()}` },
                    sk: { S: '$billingaccount_1' },
                },
                UpdateExpression: 'SET #used = #used + :one, #ua = :now',
                // Allow increment when: limit is -1 (unlimited) OR used < limit
                ConditionExpression: '#limit = :unlimited OR #used < #limit',
                ExpressionAttributeNames: {
                    '#used': usedField,
                    '#limit': limitField,
                    '#ua': 'updatedAt',
                },
                ExpressionAttributeValues: {
                    ':one': { N: '1' },
                    ':unlimited': { N: '-1' },
                    ':now': { S: new Date().toISOString() },
                },
            }));
            return true;
        }
        catch (error) {
            if (isConditionalCheckFailed(error)) {
                return false;
            }
            throw error;
        }
    }

    async reserveInvestigation(tenantId: TenantId): Promise<{ reserved: boolean; reason?: string }> {
        const client = getDynamoClient();
        try {
            await client.send(new UpdateItemCommand({
                TableName: TABLE_NAME,
                Key: {
                    pk: { S: `$causeflow#tenantid_${String(tenantId).toLowerCase()}` },
                    sk: { S: '$billingaccount_1' },
                },
                UpdateExpression: 'SET #used = #used + :one, #ua = :now',
                ConditionExpression: '#limit = :unlimited OR #used < #limit',
                ExpressionAttributeNames: {
                    '#used': 'investigationsUsed',
                    '#limit': 'investigationsLimit',
                    '#ua': 'updatedAt',
                },
                ExpressionAttributeValues: {
                    ':one': { N: '1' },
                    ':unlimited': { N: '-1' },
                    ':now': { S: new Date().toISOString() },
                },
            }));
            return { reserved: true };
        } catch (error) {
            if (isConditionalCheckFailed(error)) {
                return { reserved: false, reason: 'quota_exceeded' };
            }
            throw error;
        }
    }

    async confirmInvestigation(_tenantId: TenantId): Promise<void> {
        // No-op: counter was already incremented during reserve
    }

    async refundInvestigation(tenantId: TenantId): Promise<void> {
        const client = getDynamoClient();
        await client.send(new UpdateItemCommand({
            TableName: TABLE_NAME,
            Key: {
                pk: { S: `$causeflow#tenantid_${String(tenantId).toLowerCase()}` },
                sk: { S: '$billingaccount_1' },
            },
            UpdateExpression: 'SET #used = #used - :one, #ua = :now',
            ConditionExpression: '#used > :zero',
            ExpressionAttributeNames: {
                '#used': 'investigationsUsed',
                '#ua': 'updatedAt',
            },
            ExpressionAttributeValues: {
                ':one': { N: '1' },
                ':zero': { N: '0' },
                ':now': { S: new Date().toISOString() },
            },
        }));
    }
}
