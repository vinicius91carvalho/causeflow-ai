import type Stripe from 'stripe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setupStripeProducts } from '../setup-stripe';

function makeMockStripe(
  overrides: { searchResults?: Stripe.Product[]; priceListResults?: Stripe.Price[] } = {},
): Stripe {
  const searchResults = overrides.searchResults ?? [];
  const priceListResults = overrides.priceListResults ?? [];

  let productCounter = 0;
  let priceCounter = 0;

  return {
    products: {
      search: vi.fn().mockResolvedValue({ data: searchResults }),
      create: vi.fn().mockImplementation(async (params: Stripe.ProductCreateParams) => ({
        id: `prod_mock_${++productCounter}`,
        name: params.name,
        metadata: params.metadata ?? {},
      })),
    },
    prices: {
      list: vi.fn().mockResolvedValue({ data: priceListResults }),
      create: vi.fn().mockImplementation(async (params: Stripe.PriceCreateParams) => ({
        id: `price_mock_${++priceCounter}`,
        unit_amount: params.unit_amount,
        currency: params.currency,
        metadata: params.metadata ?? {},
      })),
    },
  } as unknown as Stripe;
}

describe('setupStripeProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console output in tests
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  it('creates 3 products for the self-service plans (Starter, Pro, Business)', async () => {
    const mockStripe = makeMockStripe();

    const results = await setupStripeProducts(mockStripe);

    expect(results).toHaveLength(3);
    const planIds = results.map((r) => r.planId);
    expect(planIds).toContain('starter');
    expect(planIds).toContain('pro');
    expect(planIds).toContain('business');
  });

  it('creates 3 monthly prices with correct amounts in cents (9900, 34900, 89900)', async () => {
    const mockStripe = makeMockStripe();

    const results = await setupStripeProducts(mockStripe);

    const priceAmounts = results.map((r) => r.priceAmountCents).sort((a, b) => a - b);
    expect(priceAmounts).toEqual([9900, 34900, 89900]);
  });

  it('skips product creation if product already exists (idempotent)', async () => {
    const existingProduct: Partial<Stripe.Product> = {
      id: 'prod_existing_starter',
      name: 'CauseFlow AI - Starter',
      metadata: { planId: 'starter' },
    };

    // First call (for starter) returns existing product; subsequent calls return empty
    let searchCallCount = 0;
    const mockStripe = {
      products: {
        search: vi.fn().mockImplementation(async () => {
          const result = searchCallCount === 0 ? { data: [existingProduct] } : { data: [] };
          searchCallCount++;
          return result;
        }),
        create: vi.fn().mockImplementation(async (params: Stripe.ProductCreateParams) => ({
          id: 'prod_new',
          name: params.name,
          metadata: params.metadata ?? {},
        })),
      },
      prices: {
        list: vi.fn().mockResolvedValue({ data: [] }),
        create: vi.fn().mockImplementation(async (params: Stripe.PriceCreateParams) => ({
          id: 'price_new',
          unit_amount: params.unit_amount,
          currency: params.currency,
          metadata: params.metadata ?? {},
        })),
      },
    } as unknown as Stripe;

    const results = await setupStripeProducts(mockStripe);

    // Product create should only be called for the 2 non-existing plans
    expect(mockStripe.products.create as any).toHaveBeenCalledTimes(2);

    // The starter result should use the existing product ID
    const starterResult = results.find((r) => r.planId === 'starter');
    expect(starterResult?.productId).toBe('prod_existing_starter');
    expect(starterResult?.alreadyExisted).toBe(true);
  });

  it('outputs price IDs in the results after creation', async () => {
    let priceCounter = 0;
    const mockStripe = {
      products: {
        search: vi.fn().mockResolvedValue({ data: [] }),
        create: vi.fn().mockImplementation(async (params: Stripe.ProductCreateParams) => ({
          id: `prod_${params.metadata?.planId}`,
          name: params.name,
          metadata: params.metadata ?? {},
        })),
      },
      prices: {
        list: vi.fn().mockResolvedValue({ data: [] }),
        create: vi.fn().mockImplementation(async (params: Stripe.PriceCreateParams) => ({
          id: `price_created_${++priceCounter}`,
          unit_amount: params.unit_amount,
          currency: params.currency,
          metadata: params.metadata ?? {},
        })),
      },
    } as unknown as Stripe;

    const results = await setupStripeProducts(mockStripe);

    for (const result of results) {
      expect(result.priceId).toBeDefined();
      expect(result.priceId).toMatch(/^price_created_/);
    }
  });

  it('sets correct metadata (planId and app) on created products', async () => {
    const mockStripe = makeMockStripe();

    await setupStripeProducts(mockStripe);

    const createCalls = (mockStripe.products.create as any).mock.calls;
    expect(createCalls).toHaveLength(3);

    for (const [params] of createCalls) {
      expect(params.metadata.app).toBe('causeflow-dashboard');
      expect(['starter', 'pro', 'business']).toContain(params.metadata.planId);
    }
  });
});
