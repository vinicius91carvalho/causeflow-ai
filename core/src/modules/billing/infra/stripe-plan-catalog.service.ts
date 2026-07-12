import { getStripeClient } from './stripe-client.js';
import { getRedisClient } from '../../../shared/infra/cache/redis-client.js';
import { logger } from '../../../shared/infra/logger.js';
import { PLAN_QUOTAS, QUOTA_PACKS } from '../domain/billing.types.js';
import { config } from '../../../shared/config/index.js';
import type {
  IPlanCatalogService,
  PlanDefinition,
  QuotaPackDefinition,
} from '../domain/plan-catalog.port.js';
import type { TenantPlan } from '../../../shared/domain/types.js';

const CACHE_KEY = 'billing:plan_catalog';
const CACHE_TTL_SECONDS = 300; // 5 minutes

interface CatalogCache {
  plans: PlanDefinition[];
  quotaPacks: QuotaPackDefinition[];
  fetchedAt: string;
}

/**
 * Fetches plan definitions from Stripe Prices metadata.
 *
 * Works with a single-product setup where all prices belong to one Product.
 * Each Price has metadata: plan_key, price_type (investigation|event),
 * investigations_limit, events_limit, trial_days.
 *
 * Prices are grouped by plan_key to build PlanDefinitions.
 * Also supports quota_pack Products with their own metadata.
 */
export class StripePlanCatalogService implements IPlanCatalogService {
  private inMemoryCache: CatalogCache | null = null;

  async listPlans(): Promise<PlanDefinition[]> {
    const catalog = await this.getCatalog();
    return catalog.plans;
  }

  async getPlanByKey(planKey: TenantPlan): Promise<PlanDefinition | null> {
    const catalog = await this.getCatalog();
    return catalog.plans.find((p) => p.planKey === planKey) ?? null;
  }

  async getPlanByPriceId(priceId: string): Promise<PlanDefinition | null> {
    const catalog = await this.getCatalog();
    return (
      catalog.plans.find(
        (p) =>
          p.stripePriceId === priceId ||
          p.metered?.invPriceId === priceId ||
          p.metered?.evtPriceId === priceId,
      ) ?? null
    );
  }

  async listQuotaPacks(): Promise<QuotaPackDefinition[]> {
    const catalog = await this.getCatalog();
    return catalog.quotaPacks;
  }

  async invalidateCache(): Promise<void> {
    this.inMemoryCache = null;
    try {
      const redis = getRedisClient();
      await redis.del(CACHE_KEY);
    } catch {
      // Redis unavailable — in-memory cleared is enough
    }
  }

  private async getCatalog(): Promise<CatalogCache> {
    // 1. In-memory cache (same process, fastest)
    if (this.inMemoryCache) {
      const age = Date.now() - new Date(this.inMemoryCache.fetchedAt).getTime();
      if (age < CACHE_TTL_SECONDS * 1000) {
        return this.inMemoryCache;
      }
    }

    // 2. Redis cache
    try {
      const redis = getRedisClient();
      const cached = await redis.get(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as CatalogCache;
        this.inMemoryCache = parsed;
        return parsed;
      }
    } catch (err) {
      logger.warn({ err }, 'Redis unavailable for plan catalog cache — fetching from Stripe');
    }

    // 3. Fetch from Stripe
    try {
      const catalog = await this.fetchFromStripe();
      // If Stripe returned no plan_key-tagged prices (e.g. stripe-mock or an
      // unconfigured account), fall back to the hardcoded catalog seeded with
      // env-configured price IDs so checkout/upgrade still work locally.
      if (catalog.plans.length === 0) {
        const fallback = this.buildFallbackCatalog();
        this.inMemoryCache = fallback;
        try {
          const redis = getRedisClient();
          await redis.set(CACHE_KEY, JSON.stringify(fallback), 'EX', CACHE_TTL_SECONDS);
        } catch {
          // Redis write failed — in-memory cache is set, move on
        }
        return fallback;
      }
      this.inMemoryCache = catalog;

      // Store in Redis (fire-and-forget)
      try {
        const redis = getRedisClient();
        await redis.set(CACHE_KEY, JSON.stringify(catalog), 'EX', CACHE_TTL_SECONDS);
      } catch {
        // Redis write failed — in-memory cache is set, move on
      }

      return catalog;
    } catch (err) {
      logger.error({ err }, 'Failed to fetch plan catalog from Stripe — using hardcoded fallback');
      return this.buildFallbackCatalog();
    }
  }

  private async fetchFromStripe(): Promise<CatalogCache> {
    const stripe = getStripeClient();

    // Fetch all active prices (includes metered + flat-fee)
    const prices = await stripe.prices.list({
      active: true,
      expand: ['data.product'],
      limit: 100,
    });

    // Also fetch products for quota packs
    const products = await stripe.products.list({
      active: true,
      expand: ['data.default_price'],
      limit: 100,
    });

    // --- Build quota packs from Products with type=quota_pack ---
    const quotaPacks: QuotaPackDefinition[] = [];
    for (const product of products.data) {
      const meta = product.metadata ?? {};
      if (meta['type'] !== 'quota_pack') continue;

      const defaultPrice = product.default_price;
      const priceObj = typeof defaultPrice === 'object' && defaultPrice ? defaultPrice : null;
      const unitAmount = priceObj && 'unit_amount' in priceObj ? (priceObj.unit_amount ?? 0) : 0;

      quotaPacks.push({
        type: meta['pack_type'] as 'investigation' | 'event',
        amount: parseInt(meta['amount'] ?? '0', 10),
        priceUsd: unitAmount / 100,
        stripePriceId: priceObj?.id ?? '',
      });
    }

    // --- Build plans by grouping Prices by plan_key metadata ---
    const planMap = new Map<
      string,
      {
        planKey: TenantPlan;
        productId: string;
        productName: string;
        investigationsLimit: number;
        eventsLimit: number;
        trialDays: number;
        features: string[];
        highlighted: boolean;
        selfService: boolean;
        overagePerInvestigation: number;
        priceAnnualUsd: number;
        invPriceId?: string;
        evtPriceId?: string;
        flatPriceId?: string;
        flatPriceAmount: number;
      }
    >();

    for (const price of prices.data) {
      const meta = price.metadata ?? {};
      const planKey = meta['plan_key'] as TenantPlan | undefined;
      if (!planKey) continue;

      const priceType = meta['price_type'] as string | undefined; // 'investigation' | 'event' | 'flat'
      const product = typeof price.product === 'object' && price.product ? price.product : null;
      const productId = typeof price.product === 'string' ? price.product : (product?.id ?? '');
      const productName = product && 'name' in product ? (product.name ?? '') : '';

      if (!planMap.has(planKey)) {
        const features = meta['features']
          ? meta['features'].split('|').map((f: string) => f.trim())
          : [];
        planMap.set(planKey, {
          planKey,
          productId,
          productName,
          investigationsLimit: parseInt(meta['investigations_limit'] ?? '-1', 10),
          eventsLimit: parseInt(meta['events_limit'] ?? '-1', 10),
          trialDays: parseInt(meta['trial_days'] ?? '0', 10),
          features,
          highlighted: meta['highlighted'] === 'true',
          selfService: meta['self_service'] !== 'false',
          overagePerInvestigation: parseFloat(meta['overage_per_investigation'] ?? '0'),
          priceAnnualUsd: parseFloat(meta['price_annual_usd'] ?? '0'),
          flatPriceAmount: 0,
        });
      }

      const entry = planMap.get(planKey)!;

      // Merge metadata from any price that has it (first wins for quotas)
      if (meta['investigations_limit'] && entry.investigationsLimit === -1) {
        entry.investigationsLimit = parseInt(meta['investigations_limit'], 10);
      }
      if (meta['events_limit'] && entry.eventsLimit === -1) {
        entry.eventsLimit = parseInt(meta['events_limit'], 10);
      }
      if (meta['trial_days'] && entry.trialDays === 0) {
        entry.trialDays = parseInt(meta['trial_days'], 10);
      }
      if (meta['features'] && entry.features.length === 0) {
        entry.features = meta['features'].split('|').map((f: string) => f.trim());
      }

      // Classify price by type
      if (priceType === 'investigation') {
        entry.invPriceId = price.id;
      } else if (priceType === 'event') {
        entry.evtPriceId = price.id;
      } else if (priceType === 'flat') {
        entry.flatPriceId = price.id;
        entry.flatPriceAmount = price.unit_amount ?? 0;
      }
    }

    const plans: PlanDefinition[] = [];
    for (const entry of planMap.values()) {
      plans.push({
        planKey: entry.planKey,
        name: entry.productName || entry.planKey.charAt(0).toUpperCase() + entry.planKey.slice(1),
        priceUsd: entry.flatPriceAmount / 100,
        priceAnnualUsd: entry.priceAnnualUsd || undefined,
        investigationsLimit: entry.investigationsLimit,
        eventsLimit: entry.eventsLimit,
        trialDays: entry.trialDays,
        features: entry.features,
        highlighted: entry.highlighted || undefined,
        selfService: entry.selfService,
        overagePerInvestigation: entry.overagePerInvestigation || undefined,
        stripePriceId: entry.flatPriceId ?? entry.invPriceId ?? '',
        stripeProductId: entry.productId,
        metered:
          entry.invPriceId && entry.evtPriceId
            ? { invPriceId: entry.invPriceId, evtPriceId: entry.evtPriceId }
            : undefined,
      });
    }

    // Sort plans by price ascending (free/zero first)
    plans.sort((a, b) => a.priceUsd - b.priceUsd);

    return { plans, quotaPacks, fetchedAt: new Date().toISOString() };
  }

  private buildFallbackCatalog(): CatalogCache {
    const plans: PlanDefinition[] = (
      Object.entries(PLAN_QUOTAS) as [TenantPlan, (typeof PLAN_QUOTAS)[TenantPlan]][]
    ).map(([key, quota]) => ({
      planKey: key,
      name: key.charAt(0).toUpperCase() + key.slice(1),
      priceUsd: quota.priceUsd,
      investigationsLimit: quota.investigations,
      eventsLimit: quota.events,
      trialDays: 0,
      features: [],
      selfService: key !== 'enterprise',
      stripePriceId:
        (key === 'starter' && config.stripe.starterFlatPriceId) ||
        (key === 'pro' && config.stripe.proFlatPriceId) ||
        (key === 'business' && config.stripe.businessFlatPriceId) ||
        (key === 'starter' && config.stripe.starterPriceId) ||
        (key === 'pro' && config.stripe.proPriceId) ||
        (key === 'business' && config.stripe.businessPriceId) ||
        '',
      stripeProductId: '',
      metered:
        (key === 'starter' && config.stripe.starterInvPriceId && config.stripe.starterEvtPriceId) ||
        (key === 'pro' && config.stripe.proInvPriceId && config.stripe.proEvtPriceId) ||
        (key === 'business' && config.stripe.businessInvPriceId && config.stripe.businessEvtPriceId)
          ? {
              invPriceId:
                (key === 'starter' && config.stripe.starterInvPriceId) ||
                (key === 'pro' && config.stripe.proInvPriceId) ||
                (key === 'business' && config.stripe.businessInvPriceId) ||
                '',
              evtPriceId:
                (key === 'starter' && config.stripe.starterEvtPriceId) ||
                (key === 'pro' && config.stripe.proEvtPriceId) ||
                (key === 'business' && config.stripe.businessEvtPriceId) ||
                '',
            }
          : undefined,
    }));

    const packs: QuotaPackDefinition[] = QUOTA_PACKS.map((p) => ({
      type: p.type as 'investigation' | 'event',
      amount: p.amount,
      priceUsd: p.priceUsd,
      stripePriceId: '',
    }));

    return { plans, quotaPacks: packs, fetchedAt: new Date().toISOString() };
  }
}
