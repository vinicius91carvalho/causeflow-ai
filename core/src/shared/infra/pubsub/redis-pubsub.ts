import Redis from 'ioredis';
import { config } from '../../config/index.js';
import { logger } from '../logger.js';

export interface ProgressEvent {
    eventType: string;
    tenantId: string;
    payload: Record<string, unknown>;
}

export const INVESTIGATION_PROGRESS_CHANNEL = 'causeflow:investigation:progress';
/**
 * Publishes a progress event to a Redis channel.
 * Creates a short-lived connection per publish (worker context).
 */
export async function publishProgress(channel: string, event: ProgressEvent): Promise<void> {
    const client = new Redis(config.redis.url, {
        maxRetriesPerRequest: 2,
        lazyConnect: true,
        connectTimeout: 3000,
    });
    try {
        await client.connect();
        await client.publish(channel, JSON.stringify(event));
    }
    catch (err) {
        logger.warn({ err, channel, eventType: event.eventType }, 'Failed to publish progress via Redis');
    }
    finally {
        await client.quit().catch(() => { });
    }
}
/**
 * Subscribes to a Redis channel for progress events.
 * Returns an unsubscribe function. Used by the main backend process.
 */
export async function subscribeProgress(channel: string, handler: (event: ProgressEvent) => void): Promise<() => Promise<void>> {
    const subscriber = new Redis(config.redis.url, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
    });
    await subscriber.connect();
    subscriber.on('error', (err) => {
        logger.error({ err, channel }, 'Redis pubsub subscriber error');
    });
    await subscriber.subscribe(channel, (err) => {
        if (err) {
            logger.error({ err, channel }, 'Failed to subscribe to Redis channel');
        }
        else {
            logger.info({ channel }, 'Subscribed to Redis progress channel');
        }
    });
    subscriber.on('message', (_ch, message) => {
        try {
            const event = JSON.parse(message);
            handler(event);
        }
        catch (err) {
            logger.warn({ err, message: message.slice(0, 200) }, 'Failed to parse Redis progress message');
        }
    });
    return async () => {
        await subscriber.unsubscribe(channel);
        await subscriber.quit();
    };
}
