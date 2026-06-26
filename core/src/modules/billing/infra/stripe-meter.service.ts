import { getStripeClient } from './stripe-client.js';
import { logger } from '../../../shared/infra/logger.js';
import type { IMeterEventService } from '../application/ports/meter-event.port.js';

export class StripeMeterEventService implements IMeterEventService {
    async reportUsage(params: {
        eventName: string;
        stripeCustomerId: string;
        value?: number;
    }): Promise<void> {
        try {
            const stripe = getStripeClient();
            await stripe.billing.meterEvents.create({
                event_name: params.eventName,
                payload: {
                    stripe_customer_id: params.stripeCustomerId,
                    value: String(params.value ?? 1),
                },
            });
        } catch (err) {
            // Fire-and-forget: log but NEVER block the pipeline
            logger.error({ err, ...params }, 'Failed to send Stripe meter event');
        }
    }
}
