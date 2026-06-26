import { sendMessage } from './sqs-client.js';
import type { MessageQueue } from '../../application/ports/message-queue.port.js';
export class SQSMessageQueue {
    async send(queueUrl: string, body: Record<string, unknown>): Promise<void> {
        await sendMessage(queueUrl, body);
    }
}
