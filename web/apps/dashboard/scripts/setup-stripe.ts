#!/usr/bin/env tsx
import { getSelfServicePlans } from '@causeflow/shared/constants';
import Stripe from 'stripe';

export interface SetupResult {
  planId: string;
  planName: string;
  productId: string;
  priceId: string;
  priceAmountCents: number;
  alreadyExisted: boolean;
}

/**
 * Core setup logic for creating Stripe products and prices. Exported for testability.
 */
export async function setupStripeProducts(stripe: Stripe): Promise<SetupResult[]> {
  const selfServicePlans = getSelfServicePlans();
  const results: SetupResult[] = [];

  console.log(`Setting up ${selfServicePlans.length} Stripe products...\n`);

  for (const plan of selfServicePlans) {
    // Check if product already exists (by metadata planId)
    const existing = await stripe.products.search({
      query: `metadata["planId"]:"${plan.id}"`,
    });

    let product: Stripe.Product;
    let alreadyExisted = false;

    if (existing.data.length > 0) {
      product = existing.data[0];
      alreadyExisted = true;
      console.log(`Product "${plan.name}" already exists (${product.id}), skipping creation`);
    } else {
      product = await stripe.products.create({
        name: `CauseFlow AI - ${plan.name}`,
        description: `${plan.credits} investigations per month`,
        metadata: {
          planId: plan.id,
          app: 'causeflow-dashboard',
        },
      });
      console.log(`Created product "${plan.name}" (${product.id})`);
    }

    // Check if an active price already exists for this product
    const prices = await stripe.prices.list({
      product: product.id,
      active: true,
    });

    let priceId: string;
    let priceAmountCents: number;

    if (prices.data.length > 0) {
      priceId = prices.data[0].id;
      priceAmountCents = prices.data[0].unit_amount ?? plan.price * 100;
      console.log(`  Price already exists: ${priceId} ($${plan.price}/month)`);
    } else {
      priceAmountCents = plan.price * 100; // Convert dollars to cents
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: priceAmountCents,
        currency: 'usd',
        recurring: { interval: 'month' },
        metadata: { planId: plan.id },
      });
      priceId = price.id;
      console.log(`  Created price: ${priceId} ($${plan.price}/month)`);
    }

    console.log('');

    results.push({
      planId: plan.id,
      planName: plan.name,
      productId: product.id,
      priceId,
      priceAmountCents,
      alreadyExisted,
    });
  }

  return results;
}

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error('Error: STRIPE_SECRET_KEY environment variable is required');
    process.exit(1);
  }

  const stripe = new Stripe(key);
  const selfServicePlans = getSelfServicePlans();

  try {
    const results = await setupStripeProducts(stripe);

    console.log('Done! Set these environment variables:');
    for (const plan of selfServicePlans) {
      if (plan.stripePriceEnvVar) {
        const result = results.find((r) => r.planId === plan.id);
        if (result) {
          console.log(`  ${plan.stripePriceEnvVar}=${result.priceId}`);
        }
      }
    }
  } catch (err) {
    console.error('Failed to set up Stripe products:', err);
    process.exit(1);
  }
}

// Only run main() when this script is executed directly (not imported in tests)
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((err) => {
    console.error('Failed to set up Stripe products:', err);
    process.exit(1);
  });
}
