import type { MessageQueue } from '../../application/ports/message-queue.port.js';
export declare class SQSMessageQueue implements MessageQueue {
    send(queueUrl: string, body: Record<string, unknown>): Promise<void>;
}
