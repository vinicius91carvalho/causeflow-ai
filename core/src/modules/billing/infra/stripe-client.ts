import Stripe from 'stripe';
import { config } from '../../../shared/config/index.js';
let _stripe: Stripe | null = null;
export function getStripeClient(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(config.stripe.secretKey, {
      apiVersion: '2026-02-25.clover',
      // When STRIPE_HOST is configured (e.g. stripe-mock on localhost:12111),
      // route SDK calls there instead of the real Stripe API. Default: real Stripe.
      ...(config.stripe.host
        ? {
            host: config.stripe.host,
            port: config.stripe.port ? Number(config.stripe.port) : undefined,
            protocol: config.stripe.protocol || undefined,
          }
        : {}),
    });
  }
  return _stripe;
}
