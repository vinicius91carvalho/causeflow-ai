import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IBillingAccountRepository } from '../../../../src/modules/billing/domain/billing-account.repository.js';
import type { IPlanCatalogService } from '../../../../src/modules/billing/domain/plan-catalog.port.js';
import type { ITenantRepository } from '../../../../src/modules/tenant/domain/tenant.repository.js';
import { HandleWebhookUseCase } from '../../../../src/modules/billing/application/handle-webhook.usecase.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../../../src/shared/config/index.js', () => ({
  config: {
    stripe: {
      webhookSecret: 'whsec_test',
    },
  },
}));

vi.mock('../../../../src/shared/infra/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../../src/modules/billing/infra/stripe-client.js', () => ({
  getStripeClient: () => ({
    subscriptions: {
      retrieve: vi.fn().mockResolvedValue({
        id: 'sub_test',
        metadata: { tenantId: 'tenant-1' },
        cancel_at: undefined,
        cancel_at_period_end: false,
        status: 'active',
        items: { data: [] },
      }),
    },
    webhooks: {
      constructEvent: vi.fn(),
    },
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PERIOD_END_TS = 1_800_000_000; // unix timestamp

function makeInvoice(billingReason?: string) {
  return {
    id: 'inv_test',
    parent: {
      type: 'subscription_details',
      subscription_details: { subscription: 'sub_test' },
    },
    period_end: PERIOD_END_TS,
    billing_reason: billingReason,
  };
}

function makeTenantRepo(): ITenantRepository {
  return {
    findById: vi.fn().mockResolvedValue({ id: 'tenant-1' }),
    update: vi.fn().mockResolvedValue(undefined),
  } as unknown as ITenantRepository;
}

function makePlanCatalog(): IPlanCatalogService {
  return {
    getPlanByPriceId: vi.fn().mockResolvedValue(null),
    getPlanByKey: vi.fn().mockResolvedValue(null),
    invalidateCache: vi.fn().mockResolvedValue(undefined),
  } as unknown as IPlanCatalogService;
}

function makeBillingAccountRepo(accountExists = true): IBillingAccountRepository {
  return {
    findByTenantId: vi.fn().mockResolvedValue(
      accountExists
        ? {
            tenantId: 'tenant-1',
            investigationsUsed: 5,
            eventsUsed: 10,
          }
        : null,
    ),
    update: vi.fn().mockResolvedValue(undefined),
  } as unknown as IBillingAccountRepository;
}

// ---------------------------------------------------------------------------
// Tests: handleInvoicePaid — billing_reason guard
// ---------------------------------------------------------------------------

describe('HandleWebhookUseCase.handleInvoicePaid — billing_reason guard', () => {
  let tenantRepo: ITenantRepository;
  let planCatalog: IPlanCatalogService;
  let billingAccountRepo: IBillingAccountRepository;
  let useCase: HandleWebhookUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    tenantRepo = makeTenantRepo();
    planCatalog = makePlanCatalog();
    billingAccountRepo = makeBillingAccountRepo();
    useCase = new HandleWebhookUseCase(tenantRepo, planCatalog, billingAccountRepo);
  });

  it('resets usage counters when billing_reason is subscription_cycle', async () => {
    const invoice = makeInvoice('subscription_cycle');
    await useCase.handleInvoicePaid(invoice);

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(billingAccountRepo.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        investigationsUsed: 0,
        eventsUsed: 0,
      }),
    );
  });

  it('does NOT reset usage counters when billing_reason is subscription_create', async () => {
    const invoice = makeInvoice('subscription_create');
    await useCase.handleInvoicePaid(invoice);

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(billingAccountRepo.update).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        investigationsUsed: 0,
        eventsUsed: 0,
      }),
    );
  });

  it('does NOT reset usage counters when billing_reason is absent (safe default)', async () => {
    const invoice = makeInvoice(undefined);
    await useCase.handleInvoicePaid(invoice);

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(billingAccountRepo.update).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        investigationsUsed: 0,
        eventsUsed: 0,
      }),
    );
  });

  it('still updates tenant status regardless of billing_reason', async () => {
    const invoice = makeInvoice('subscription_create');
    await useCase.handleInvoicePaid(invoice);

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(tenantRepo.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        subscriptionStatus: 'active',
        status: 'active',
      }),
    );
  });

  it('does NOT reset counters when billing_reason is subscription_update', async () => {
    const invoice = makeInvoice('subscription_update');
    await useCase.handleInvoicePaid(invoice);

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(billingAccountRepo.update).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        investigationsUsed: 0,
        eventsUsed: 0,
      }),
    );
  });
});
