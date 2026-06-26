import { sendMessage } from '../queue/sqs-client.js';
import { logger } from '../logger.js';

export interface ProgressMessage {
    eventType: string;
    tenantId: string;
    payload: Record<string, unknown>;
}

/**
 * Publishes a progress event to an SQS queue.
 * Used by the Fargate worker which has no Redis access.
 * Falls back gracefully if queue URL is not configured.
 */
export async function publishProgressToSQS(queueUrl: string | undefined, message: ProgressMessage): Promise<void> {
    if (!queueUrl) {
        logger.warn({ eventType: message.eventType }, 'SQS progress queue URL not configured, skipping publish');
        return;
    }
    try {
        await sendMessage(queueUrl, message as unknown as Record<string, unknown>);
    } catch (err) {
        logger.warn({ err, eventType: message.eventType, tenantId: message.tenantId }, 'Failed to publish progress to SQS');
    }
}
