import type { Message } from '@aws-sdk/client-sqs';
export interface SQSConsumerOptions {
    queueUrl: string;
    handler: (message: Message) => Promise<void>;
    batchSize?: number;
    waitTimeSeconds?: number;
    visibilityTimeout?: number;
    signal?: AbortSignal;
}
export declare function createSQSConsumer(options: SQSConsumerOptions): {
    start: () => Promise<void>;
    stop: () => void;
};
