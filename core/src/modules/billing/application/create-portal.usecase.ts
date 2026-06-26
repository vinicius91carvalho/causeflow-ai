import { TenantNotFoundError } from '../../tenant/domain/tenant.errors.js';
import { ValidationError } from '../../../shared/domain/errors.js';
import { getStripeClient } from '../infra/stripe-client.js';
import type { ITenantRepository } from '../../tenant/domain/tenant.repository.js';
import type { PortalInput } from '../domain/billing.types.js';
export class CreatePortalUseCase {
    tenantRepo;
    constructor(tenantRepo: ITenantRepository) {
        this.tenantRepo = tenantRepo;
    }
    async execute(input: PortalInput) {
        const stripe = getStripeClient();
        const tenant = await this.tenantRepo.findById(input.tenantId);
        if (!tenant) {
            throw new TenantNotFoundError(input.tenantId);
        }
        if (!tenant.stripeCustomerId) {
            throw new ValidationError('Tenant has no Stripe customer — start a checkout first');
        }
        const session = await stripe.billingPortal.sessions.create({
            customer: tenant.stripeCustomerId,
            return_url: input.returnUrl,
        });
        return { url: session.url };
    }
}
