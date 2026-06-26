import { receiveMessages, deleteMessage, sendMessage } from './sqs-client.js';
import { logger } from '../logger.js';

export interface RedriveResult {
    moved: number;
    failed: number;
}

export async function redriveDLQ(dlqUrl: string, targetUrl: string, limit: number = 10): Promise<RedriveResult> {
    let moved = 0;
    let failed = 0;
    const messages = await receiveMessages(dlqUrl, { maxMessages: limit, waitTimeSeconds: 1 });
    for (const msg of messages) {
        try {
            await sendMessage(targetUrl, JSON.parse(msg.Body ?? '{}'));
            if (msg.ReceiptHandle) {
                await deleteMessage(dlqUrl, msg.ReceiptHandle);
            }
            moved++;
        }
        catch (err) {
            logger.error({ err, messageId: msg.MessageId }, 'Failed to redrive message');
            failed++;
        }
    }
    return { moved, failed };
}
