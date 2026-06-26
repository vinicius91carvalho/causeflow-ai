import { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand, type Message } from '@aws-sdk/client-sqs';
import { config } from '../../config/index.js';
import { instrumentedCall } from '../observability/outbound.js';
import { injectTraceparent } from '../observability/propagation.js';
import { getLogContext } from '../logger/log-context.js';

export interface ReceiveOptions {
    maxMessages?: number;
    waitTimeSeconds?: number;
    visibilityTimeout?: number;
}

let client: SQSClient | null = null;
export function getSQSClient(): SQSClient {
    if (!client) {
        client = new SQSClient({
            region: config.aws.region,
            ...(config.aws.sqsEndpoint && {
                endpoint: config.aws.sqsEndpoint,
            }),
        });
    }
    return client;
}
export async function sendMessage(queueUrl: string, body: Record<string, unknown>): Promise<void> {
    const queueName = queueUrl.split('/').pop() ?? queueUrl;
    const messageAttributes = injectTraceparent({}, getLogContext()?.requestId);
    const params = {
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(body),
        MessageAttributes: messageAttributes,
    };
    await instrumentedCall('sqs', 'send', () => getSQSClient().send(new SendMessageCommand(params)), {
        attributes: { queueName },
        logSuccessLevel: 'trace',
    });
}
export async function receiveMessages(queueUrl: string, options?: ReceiveOptions): Promise<Message[]> {
    const queueName = queueUrl.split('/').pop() ?? queueUrl;
    const result = await instrumentedCall('sqs', 'receive', () => getSQSClient().send(new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: options?.maxMessages ?? 10,
        WaitTimeSeconds: options?.waitTimeSeconds ?? 20,
        VisibilityTimeout: options?.visibilityTimeout ?? 30,
    })), {
        attributes: { queueName },
        logSuccessLevel: 'trace',
    });
    return result.Messages ?? [];
}
export async function deleteMessage(queueUrl: string, receiptHandle: string): Promise<void> {
    const queueName = queueUrl.split('/').pop() ?? queueUrl;
    await instrumentedCall('sqs', 'delete', () => getSQSClient().send(new DeleteMessageCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: receiptHandle,
    })), { attributes: { queueName }, logSuccessLevel: 'trace' });
}
