import { receiveMessages, deleteMessage } from './sqs-client.js';
import { logger } from '../logger.js';
import type { Message } from '@aws-sdk/client-sqs';

export interface SQSConsumerOptions {
    queueUrl: string;
    handler: (message: Message) => Promise<void>;
    batchSize?: number;
    waitTimeSeconds?: number;
    visibilityTimeout?: number;
    signal?: AbortSignal;
}

export function createSQSConsumer(options: SQSConsumerOptions) {
    const controller = new AbortController();
    const signal = options.signal ?? controller.signal;
    async function start() {
        logger.info({ queueUrl: options.queueUrl }, 'SQS consumer polling started');
        while (!signal.aborted) {
            try {
                const messages = await receiveMessages(options.queueUrl, {
                    maxMessages: options.batchSize ?? 10,
                    waitTimeSeconds: options.waitTimeSeconds ?? 20,
                    visibilityTimeout: options.visibilityTimeout ?? 30,
                });
                for (const msg of messages) {
                    try {
                        await options.handler(msg);
                        if (msg.ReceiptHandle) {
                            await deleteMessage(options.queueUrl, msg.ReceiptHandle);
                        }
                    }
                    catch (err) {
                        logger.error({ err, messageId: msg.MessageId, queueUrl: options.queueUrl }, 'SQS consumer handler error');
                    }
                }
            }
            catch (err) {
                if (signal.aborted)
                    break;
                logger.error({ err, queueUrl: options.queueUrl }, 'SQS consumer polling error');
                await sleep(5000);
            }
        }
        logger.info({ queueUrl: options.queueUrl }, 'SQS consumer stopped');
    }
    function stop() {
        controller.abort();
    }
    return { start, stop };
}
function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
