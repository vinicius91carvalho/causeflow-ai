import Stripe from 'stripe';
import { config } from '../../../shared/config/index.js';
let _stripe: Stripe | null = null;
export function getStripeClient(): Stripe {
    if (!_stripe) {
        _stripe = new Stripe(config.stripe.secretKey, { apiVersion: '2026-02-25.clover' });
    }
    return _stripe;
}
