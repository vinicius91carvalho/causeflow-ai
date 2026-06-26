import { Webhook } from 'svix';
import { config } from '../../../shared/config/index.js';
import { tenantId } from '../../../shared/domain/value-objects.js';
import { logger } from '../../../shared/infra/logger.js';
import { getClerkClient } from '../../auth/infra/clerk-client.js';
import type { ITenantRepository } from '../../tenant/domain/tenant.repository.js';
import type { IUserRepository } from '../../user/domain/user.repository.js';
import type { IStripeCustomerService } from '../../billing/domain/stripe-customer.port.js';
import type { IPlanCatalogService } from '../../billing/domain/plan-catalog.port.js';
import type { IBillingAccountRepository } from '../../billing/domain/billing-account.repository.js';
import type { Tenant } from '../../tenant/domain/tenant.entity.js';
import type { User } from '../../user/domain/user.entity.js';

interface ClerkWebhookEvent {
    type: string;
    data: Record<string, unknown>;
}

export class HandleClerkWebhookUseCase {
    constructor(
        private tenantRepo: ITenantRepository,
        private userRepo: IUserRepository,
        private stripeCustomerService?: IStripeCustomerService,
        private planCatalog?: IPlanCatalogService,
        private billingAccountRepo?: IBillingAccountRepository,
    ) {}

    async execute(body: string, headers: Record<string, string>): Promise<void> {
        // Verify webhook signature via Svix
        const wh = new Webhook(config.clerk.webhookSecret);
        const event = wh.verify(body, {
            'svix-id': headers['svix-id'] ?? '',
            'svix-timestamp': headers['svix-timestamp'] ?? '',
            'svix-signature': headers['svix-signature'] ?? '',
        }) as ClerkWebhookEvent;

        logger.info({ type: event.type }, 'Clerk webhook received');

        switch (event.type) {
            case 'organization.created':
                await this.handleOrgCreated(event.data);
                break;
            case 'organizationMembership.created':
                await this.handleMemberAdded(event.data);
                break;
            case 'organizationMembership.deleted':
                await this.handleMemberRemoved(event.data);
                break;
            case 'user.updated':
                await this.handleUserUpdated(event.data);
                break;
            default:
                logger.debug({ type: event.type }, 'Unhandled Clerk webhook event');
        }
    }

    private async handleOrgCreated(data: Record<string, unknown>): Promise<void> {
        const orgId = data['id'] as string;
        const name = data['name'] as string;
        const slug = data['slug'] as string;

        // Check if tenant already exists
        const existing = await this.tenantRepo.findById(tenantId(orgId));
        if (existing) return;

        // Resolve starter plan quotas from Stripe catalog (fallback to defaults)
        let investigationsLimit = 15;
        let eventsLimit = 500;
        if (this.planCatalog) {
            const starterPlan = await this.planCatalog.getPlanByKey('starter');
            if (starterPlan) {
                investigationsLimit = starterPlan.investigationsLimit;
                eventsLimit = starterPlan.eventsLimit;
            }
        }

        const now = new Date();
        const tid = tenantId(orgId);

        await this.tenantRepo.create({
            tenantId: tid,
            name: name,
            slug: slug ?? orgId,
            ownerEmail: '', // Will be updated when membership webhook fires
            plan: 'starter',
            status: 'active',
            settings: {},
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
        } as Tenant);

        // Stripe customer is created at checkout (when user picks a plan), not here.

        // Create BillingAccount with quotas from Stripe catalog
        if (this.billingAccountRepo) {
            try {
                await this.billingAccountRepo.create({
                    tenantId: tid,
                    investigationsLimit,
                    investigationsUsed: 0,
                    eventsLimit,
                    eventsUsed: 0,
                    createdAt: now.toISOString(),
                    updatedAt: now.toISOString(),
                });
            } catch (err) {
                logger.warn({ err, orgId }, 'Failed to create BillingAccount at org creation');
            }
        }

        logger.info({ orgId, name }, 'Tenant created from Clerk organization');
    }

    private async handleMemberAdded(data: Record<string, unknown>): Promise<void> {
        const org = data['organization'] as Record<string, unknown> | undefined;
        const publicUserData = data['public_user_data'] as Record<string, unknown> | undefined;
        const orgId = org?.['id'] as string | undefined;
        const userId = publicUserData?.['user_id'] as string | undefined;
        const email = publicUserData?.['identifier'] as string | undefined;
        const firstName = (publicUserData?.['first_name'] as string | undefined) ?? '';
        const lastName = (publicUserData?.['last_name'] as string | undefined) ?? '';
        const role = data['role'] === 'org:admin' ? 'admin' : 'member';

        if (!orgId || !userId) return;

        const tid = tenantId(orgId);
        const existing = await this.userRepo.findById(tid, userId);
        if (existing) return;

        // Fetch legal_accepted_at from Clerk user
        let termsAcceptedAt: string | undefined;
        try {
            const clerk = getClerkClient();
            const clerkUser = await clerk.users.getUser(userId);
            const clerkUserExt = clerkUser as unknown as Record<string, unknown>;
            const raw = clerkUserExt['legalAcceptedAt'] ?? clerkUserExt['legal_accepted_at'];
            if (typeof raw === 'number') {
                termsAcceptedAt = new Date(raw).toISOString();
            } else if (typeof raw === 'string') {
                termsAcceptedAt = raw;
            }
        } catch (err) {
            logger.warn({ err, userId }, 'Failed to fetch Clerk user for legal_accepted_at');
        }

        await this.userRepo.create({
            tenantId: tid,
            userId: userId,
            email: email ?? '',
            name: `${firstName} ${lastName}`.trim(),
            role,
            profileComplete: !!termsAcceptedAt,
            termsAcceptedAt,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        } as User);

        logger.info({ orgId, userId, role, termsAcceptedAt: !!termsAcceptedAt }, 'User added from Clerk membership');
    }

    private async handleMemberRemoved(data: Record<string, unknown>): Promise<void> {
        const org = data['organization'] as Record<string, unknown> | undefined;
        const publicUserData = data['public_user_data'] as Record<string, unknown> | undefined;
        const orgId = org?.['id'] as string | undefined;
        const userId = publicUserData?.['user_id'] as string | undefined;
        if (!orgId || !userId) return;

        await this.userRepo.delete(tenantId(orgId), userId).catch(() => {});
        logger.info({ orgId, userId }, 'User removed from Clerk membership');
    }

    private async handleUserUpdated(data: Record<string, unknown>): Promise<void> {
        const clerkUserId = data['id'] as string | undefined;
        const emailAddresses = data['email_addresses'] as Array<Record<string, unknown>> | undefined;
        const email = emailAddresses?.[0]?.['email_address'] as string | undefined;
        const firstName = (data['first_name'] as string) ?? '';
        const lastName = (data['last_name'] as string) ?? '';
        const rawLegal = data['legal_accepted_at'];
        const legalAcceptedAt = typeof rawLegal === 'number' ? new Date(rawLegal).toISOString()
            : typeof rawLegal === 'string' ? rawLegal
            : null;

        if (!clerkUserId || !email) return;

        const user = await this.userRepo.findByEmail(email);
        if (user) {
            await this.userRepo.update(user.tenantId, clerkUserId, {
                email: email,
                name: `${firstName} ${lastName}`.trim(),
                ...(legalAcceptedAt && { termsAcceptedAt: legalAcceptedAt }),
                updatedAt: new Date().toISOString(),
            });
        }
    }
}
