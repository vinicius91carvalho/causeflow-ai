export interface MessageQueue {
    send(queueUrl: string, body: Record<string, unknown>): Promise<void>;
}
