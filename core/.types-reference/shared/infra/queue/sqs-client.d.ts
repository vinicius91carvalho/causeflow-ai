import { SQSClient, type Message } from '@aws-sdk/client-sqs';
export declare function getSQSClient(): SQSClient;
export declare function sendMessage(queueUrl: string, body: Record<string, unknown>): Promise<void>;
export interface ReceiveOptions {
    maxMessages?: number;
    waitTimeSeconds?: number;
    visibilityTimeout?: number;
}
export declare function receiveMessages(queueUrl: string, options?: ReceiveOptions): Promise<Message[]>;
export declare function deleteMessage(queueUrl: string, receiptHandle: string): Promise<void>;
