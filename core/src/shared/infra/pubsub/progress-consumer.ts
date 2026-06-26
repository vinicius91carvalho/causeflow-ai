import { createSQSConsumer } from '../queue/sqs-consumer.js';
import { logger } from '../logger.js';
import type { SSEManager } from '../chat/sse-manager.js';

/**
 * Polls the SQS progress queue and broadcasts messages to SSE clients.
 * Runs in the API server process, replacing the Redis pub/sub subscriber.
 */
export function startProgressConsumer(queueUrl: string, sseManager: SSEManager) {
    const consumer = createSQSConsumer({
        queueUrl,
        batchSize: 10,
        waitTimeSeconds: 5,
        visibilityTimeout: 10,
        handler: async (message) => {
            try {
                const body = JSON.parse(message.Body ?? '{}') as {
                    eventType?: string;
                    tenantId?: string;
                    payload?: Record<string, unknown>;
                };
                if (!body.eventType || !body.tenantId) {
                    logger.warn({ messageId: message.MessageId }, 'Progress message missing eventType or tenantId');
                    return;
                }
                await sseManager.broadcast(body.tenantId, {
                    event: body.eventType,
                    data: body.payload ?? {},
                });
                logger.debug({ eventType: body.eventType, tenantId: body.tenantId }, 'Progress event broadcast via SSE');
            } catch (err) {
                logger.error({ err, messageId: message.MessageId }, 'Failed to process progress message');
            }
        },
    });
    consumer.start().catch((err) => {
        logger.fatal({ err }, 'Progress consumer fatal error');
    });
    return consumer;
}
