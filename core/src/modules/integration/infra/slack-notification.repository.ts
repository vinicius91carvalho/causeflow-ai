import { SlackNotificationEntity } from '../../../shared/infra/db/entities/SlackNotificationEntity.js';

export interface SlackNotificationRecord {
    tenantId: string;
    incidentId: string;
    type: string;
    messageTs?: string;
    channel?: string;
    status: 'pending' | 'sent' | 'failed';
    errorMessage?: string;
    ttl?: number;
    createdAt?: string;
    updatedAt?: string;
}

/** 30 days in seconds */
const TTL_SECONDS = 30 * 24 * 60 * 60;

function toRecord(raw: Record<string, any>): SlackNotificationRecord {
    return {
        tenantId: raw['tenantId'],
        incidentId: raw['incidentId'],
        type: raw['type'],
        messageTs: raw['messageTs'],
        channel: raw['channel'],
        status: raw['status'] ?? 'pending',
        errorMessage: raw['errorMessage'],
        ttl: raw['ttl'],
        createdAt: raw['createdAt'],
        updatedAt: raw['updatedAt'],
    };
}

export class SlackNotificationRepository {
    async findNotification(
        tenantId: string,
        incidentId: string,
        type: string,
    ): Promise<SlackNotificationRecord | null> {
        const result = await SlackNotificationEntity.get({ tenantId, incidentId, type }).go();
        if (!result.data) return null;
        return toRecord(result.data);
    }

    async saveNotification(record: Omit<SlackNotificationRecord, 'createdAt' | 'updatedAt'>): Promise<SlackNotificationRecord> {
        const ttl = record.ttl ?? Math.floor(Date.now() / 1000) + TTL_SECONDS;

        const result = await SlackNotificationEntity.upsert({
            tenantId: record.tenantId,
            incidentId: record.incidentId,
            type: record.type,
            ...(record.messageTs !== undefined && { messageTs: record.messageTs }),
            ...(record.channel !== undefined && { channel: record.channel }),
            status: record.status,
            ...(record.errorMessage !== undefined && { errorMessage: record.errorMessage }),
            ttl,
        }).go();
        return toRecord(result.data);
    }

    async deleteByIncident(tenantId: string, incidentId: string): Promise<void> {
        // Query all records for this tenant+incident via GSI, then delete each
        const result = await SlackNotificationEntity.query
            .byIncident({ tenantId, incidentId })
            .go();

        await Promise.all(
            result.data.map((item) =>
                SlackNotificationEntity.delete({
                    tenantId: item.tenantId,
                    incidentId: item.incidentId,
                    type: item.type,
                }).go(),
            ),
        );
    }
}
