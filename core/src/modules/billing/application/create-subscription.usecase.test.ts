import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { ITenantRepository } from '../../tenant/domain/tenant.repository.js';
import type { IPlanCatalogService } from '../domain/plan-catalog.port.js';
import { CreateSubscriptionUseCase } from './create-subscription.usecase.js';

const T1 = 'tenant-1' as unknown as TenantId;

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../../shared/config/index.js', () => ({
  config: {
    stripe: {
      starterPriceId: 'price_starter_test',
      proPriceId: 'price_pro_test',
      businessPriceId: 'price_business_test',
    },
  },
}));

const mockSubscription = {
  id: 'sub_test123',
  status: 'incomplete',
  latest_invoice: {
    payment_intent: { client_secret: 'pi_secret_test' },
  },
  pending_setup_intent: null,
  items: { data: [] },
};

vi.mock('../infra/stripe-client.js', () => ({
  getStripeClient: () => ({
    subscriptions: {
      create: vi.fn().mockResolvedValue(mockSubscription),
    },
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTenantRepo(overrides: Partial<ITenantRepository> = {}): ITenantRepository {
  return {
    findById: vi.fn().mockResolvedValue({
      id: 'tenant-1',
      stripeCustomerId: 'cus_test',
      stripeSubscriptionId: null,
    }),
    ...overrides,
  } as unknown as ITenantRepository;
}

function makePlanCatalog(overrides: Partial<IPlanCatalogService> = {}): IPlanCatalogService {
  return {
    getPlanByPriceId: vi.fn().mockResolvedValue(null),
    ...overrides,
  } as unknown as IPlanCatalogService;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CreateSubscriptionUseCase — plan key resolution', () => {
  let stripeSubscriptionsCreate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Re-import to get fresh mock
    const { getStripeClient } = await import('../infra/stripe-client.js');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    stripeSubscriptionsCreate = getStripeClient().subscriptions.create as ReturnType<typeof vi.fn>;
    stripeSubscriptionsCreate.mockResolvedValue(mockSubscription);
  });

  it('resolves "starter" plan key to config stripe price ID', async () => {
    const useCase = new CreateSubscriptionUseCase(makeTenantRepo(), makePlanCatalog());
    await useCase.execute({ tenantId: T1, planId: 'starter' });

    expect(stripeSubscriptionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        items: expect.arrayContaining([
          expect.objectContaining({ price: 'price_starter_test', quantity: 1 }),
        ]),
      }),
    );
  });

  it('resolves "pro" plan key to config stripe price ID', async () => {
    const useCase = new CreateSubscriptionUseCase(makeTenantRepo(), makePlanCatalog());
    await useCase.execute({ tenantId: T1, planId: 'pro' });

    expect(stripeSubscriptionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        items: expect.arrayContaining([
          expect.objectContaining({ price: 'price_pro_test', quantity: 1 }),
        ]),
      }),
    );
  });

  it('resolves "business" plan key to config stripe price ID', async () => {
    const useCase = new CreateSubscriptionUseCase(makeTenantRepo(), makePlanCatalog());
    await useCase.execute({ tenantId: T1, planId: 'business' });

    expect(stripeSubscriptionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        items: expect.arrayContaining([
          expect.objectContaining({ price: 'price_business_test', quantity: 1 }),
        ]),
      }),
    );
  });

  it('passes a raw Stripe price ID through unchanged', async () => {
    const useCase = new CreateSubscriptionUseCase(makeTenantRepo(), makePlanCatalog());
    await useCase.execute({ tenantId: T1, planId: 'price_raw_stripe_id' });

    expect(stripeSubscriptionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        items: expect.arrayContaining([
          expect.objectContaining({ price: 'price_raw_stripe_id', quantity: 1 }),
        ]),
      }),
    );
  });

  it('returns subscriptionId and clientSecret', async () => {
    const useCase = new CreateSubscriptionUseCase(makeTenantRepo(), makePlanCatalog());
    const result = await useCase.execute({ tenantId: T1, planId: 'starter' });

    expect(result.subscriptionId).toBe('sub_test123');
    expect(result.clientSecret).toBe('pi_secret_test');
  });
});
