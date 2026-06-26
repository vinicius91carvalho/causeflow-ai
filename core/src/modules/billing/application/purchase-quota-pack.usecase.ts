import { QUOTA_PACKS } from '../domain/billing.types.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import { logger } from '../../../shared/infra/logger.js';
import { getStripeClient } from '../infra/stripe-client.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { IBillingAccountRepository } from '../domain/billing-account.repository.js';
import type { ITenantRepository } from '../../tenant/domain/tenant.repository.js';
import type { IPlanCatalogService, QuotaPackDefinition } from '../domain/plan-catalog.port.js';
import type { UsageType } from '../../../shared/domain/types.js';

export interface PurchaseQuotaPackInput {
    tenantId: TenantId;
    type: UsageType;
}

export interface PurchaseQuotaPackResult {
    type: UsageType;
    amountAdded: number;
    priceUsd: number;
    newLimit: number;
    stripeInvoiceId?: string;
}

/**
 * Purchases additional investigation or event quota.
 *
 * Flow:
 * 1. Resolves the quota pack definition from Stripe catalog (or fallback)
 * 2. If the pack has a Stripe price, creates an invoice and charges immediately
 * 3. Only increments the local quota after payment succeeds
 */
export class PurchaseQuotaPackUseCase {
    constructor(
        private billingAccountRepo: IBillingAccountRepository,
        private tenantRepo: ITenantRepository,
        private planCatalog?: IPlanCatalogService,
    ) {}

    async execute(input: PurchaseQuotaPackInput): Promise<PurchaseQuotaPackResult> {
        // Resolve quota pack from catalog, fallback to hardcoded
        let pack: QuotaPackDefinition | { type: string; amount: number; priceUsd: number; stripePriceId?: string } | undefined;
        if (this.planCatalog) {
            try {
                const packs = await this.planCatalog.listQuotaPacks();
                pack = packs.find((p) => p.type === input.type);
            } catch (err) {
                logger.warn({ err }, 'Plan catalog unavailable for quota packs — using fallback');
            }
        }
        if (!pack) {
            const fallback = QUOTA_PACKS.find((p) => p.type === input.type);
            if (fallback) {
                pack = { ...fallback, stripePriceId: undefined };
            }
        }
        if (!pack) {
            throw new ValidationError(`No quota pack available for type: ${input.type}`);
        }

        const account = await this.billingAccountRepo.findByTenantId(input.tenantId);
        if (!account) {
            throw new NotFoundError('BillingAccount', input.tenantId);
        }

        // Charge via Stripe if a price ID exists and tenant has a Stripe customer
        let stripeInvoiceId: string | undefined;
        const stripePriceId = 'stripePriceId' in pack ? pack.stripePriceId : undefined;

        if (stripePriceId) {
            const tenant = await this.tenantRepo.findById(input.tenantId);
            if (!tenant?.stripeCustomerId) {
                throw new ValidationError('No Stripe customer found — cannot process payment');
            }

            const stripe = getStripeClient();

            // Create a one-time invoice item + invoice and pay immediately
            await stripe.invoiceItems.create({
                customer: tenant.stripeCustomerId,
                pricing: { price: stripePriceId },
                quantity: 1,
                description: `Quota pack: +${pack.amount} ${input.type}s`,
            });

            const invoice = await stripe.invoices.create({
                customer: tenant.stripeCustomerId,
                auto_advance: true,
                collection_method: 'charge_automatically',
                metadata: {
                    tenantId: input.tenantId,
                    type: 'quota_pack',
                    packType: input.type,
                    amount: String(pack.amount),
                },
            });

            // Finalize and pay immediately — quota is ONLY incremented after confirmed payment
            let paidInvoice;
            try {
                const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
                paidInvoice = await stripe.invoices.pay(finalizedInvoice.id);
            } catch (err) {
                logger.error({ err, tenantId: input.tenantId, invoiceId: invoice.id }, 'Quota pack payment failed');
                throw new ValidationError('Payment failed — quota pack not applied. Your card was not charged.');
            }

            if (paidInvoice.status !== 'paid') {
                logger.warn({ tenantId: input.tenantId, invoiceId: invoice.id, status: paidInvoice.status }, 'Quota pack invoice not paid');
                throw new ValidationError('Payment could not be confirmed — quota pack not applied');
            }

            stripeInvoiceId = paidInvoice.id;
            logger.info({
                tenantId: input.tenantId,
                invoiceId: stripeInvoiceId,
                type: input.type,
                amount: pack.amount,
            }, 'Quota pack purchased and charged via Stripe');
        }

        // Increment local quota ONLY after confirmed payment (or if no Stripe price configured)
        const limitField = input.type === 'investigation' ? 'investigationsLimit' : 'eventsLimit';
        const newLimit = account[limitField] + pack.amount;
        await this.billingAccountRepo.update(input.tenantId, {
            [limitField]: newLimit,
        });

        return {
            type: input.type,
            amountAdded: pack.amount,
            priceUsd: pack.priceUsd,
            newLimit,
            stripeInvoiceId,
        };
    }
}
