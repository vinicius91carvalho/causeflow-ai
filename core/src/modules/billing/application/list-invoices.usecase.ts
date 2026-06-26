import { TenantNotFoundError } from '../../tenant/domain/tenant.errors.js';
import { ValidationError } from '../../../shared/domain/errors.js';
import { getStripeClient } from '../infra/stripe-client.js';
import type { ITenantRepository } from '../../tenant/domain/tenant.repository.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';

export interface InvoiceSummary {
    id: string;
    status: string;
    amountDue: number;
    amountPaid: number;
    currency: string;
    periodStart: string;
    periodEnd: string;
    hostedInvoiceUrl?: string;
    invoicePdf?: string;
    createdAt: string;
}

export class ListInvoicesUseCase {
    constructor(private tenantRepo: ITenantRepository) {}

    async execute(tenantId: TenantId, limit = 12): Promise<InvoiceSummary[]> {
        const tenant = await this.tenantRepo.findById(tenantId);
        if (!tenant) {
            throw new TenantNotFoundError(tenantId);
        }
        if (!tenant.stripeCustomerId) {
            throw new ValidationError('No Stripe customer found');
        }

        const stripe = getStripeClient();
        const invoices = await stripe.invoices.list({
            customer: tenant.stripeCustomerId,
            limit,
        });

        return invoices.data.map((inv) => ({
            id: inv.id,
            status: inv.status ?? 'unknown',
            amountDue: (inv.amount_due ?? 0) / 100,
            amountPaid: (inv.amount_paid ?? 0) / 100,
            currency: inv.currency ?? 'usd',
            periodStart: new Date((inv.period_start ?? 0) * 1000).toISOString(),
            periodEnd: new Date((inv.period_end ?? 0) * 1000).toISOString(),
            hostedInvoiceUrl: inv.hosted_invoice_url ?? undefined,
            invoicePdf: inv.invoice_pdf ?? undefined,
            createdAt: new Date((inv.created ?? 0) * 1000).toISOString(),
        }));
    }
}
