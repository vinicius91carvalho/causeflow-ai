import type { ITenantRepository } from '../../tenant/domain/tenant.repository.js';
export declare class HandleWebhookUseCase {
    private readonly tenantRepo;
    constructor(tenantRepo: ITenantRepository);
    execute(rawBody: string, signature: string): Promise<void>;
    private handleCheckoutCompleted;
    private processCheckout;
    private handleInvoicePaid;
    private handleSubscriptionUpdated;
    private handleSubscriptionDeleted;
    private handlePaymentFailed;
    private resolveTenantIdFromSubscription;
}
