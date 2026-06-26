import { Hono } from 'hono';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import type { CreateCheckoutUseCase } from '../application/create-checkout.usecase.js';
import type { CreatePortalUseCase } from '../application/create-portal.usecase.js';
import type { GetSubscriptionUseCase } from '../application/get-subscription.usecase.js';
import type { HandleWebhookUseCase } from '../application/handle-webhook.usecase.js';
import type { GetUsageUseCase } from '../application/get-usage.usecase.js';
import type { SignupUseCase } from '../application/signup.usecase.js';
import type { PurchaseQuotaPackUseCase } from '../application/purchase-quota-pack.usecase.js';
import type { UpdateBillingSettingsUseCase } from '../application/update-billing-settings.usecase.js';
import type { GetCreditsUseCase } from '../application/get-credits.usecase.js';
export interface BillingUseCases {
    createCheckout: CreateCheckoutUseCase;
    createPortal: CreatePortalUseCase;
    getSubscription: GetSubscriptionUseCase;
    handleWebhook: HandleWebhookUseCase;
    getUsage?: GetUsageUseCase;
    getCredits?: GetCreditsUseCase;
    signup?: SignupUseCase;
    purchaseQuotaPack?: PurchaseQuotaPackUseCase;
    updateBillingSettings?: UpdateBillingSettingsUseCase;
}
export declare function createBillingRoutes(useCases: BillingUseCases): Hono<AppEnv, import("hono/types").BlankSchema, "/">;
export declare function createSignupRoute(useCases: BillingUseCases): Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
export declare function createBillingWebhookRoute(useCases: BillingUseCases): Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
