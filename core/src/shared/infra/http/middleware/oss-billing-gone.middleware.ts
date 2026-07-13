import type { MiddlewareHandler } from 'hono';
import { config } from '../../../config/index.js';
import type { AppEnv } from '../hono-types.js';

/** Commercial billing mutation paths disabled in the OSS runtime (AC-043 / AC-075). */
const OSS_BILLING_GONE: ReadonlyArray<{ method: string; path: string; message: string }> = [
  {
    method: 'POST',
    path: '/v1/billing/checkout',
    message: 'Billing is disabled in the OSS build. Checkout is not available.',
  },
  {
    method: 'POST',
    path: '/v1/billing/checkout-session',
    message: 'Billing is disabled in the OSS build. Checkout is not available.',
  },
  {
    method: 'POST',
    path: '/v1/billing/portal',
    message: 'Billing is disabled in the OSS build. Portal is not available.',
  },
  {
    method: 'POST',
    path: '/v1/billing/subscribe',
    message: 'Billing is disabled in the OSS build. Subscribe is not available.',
  },
  {
    method: 'POST',
    path: '/v1/billing/purchase',
    message: 'Billing is disabled in the OSS build. Purchase is not available.',
  },
  {
    method: 'POST',
    path: '/v1/billing/upgrade',
    message: 'Billing is disabled in the OSS build. Upgrade is not available.',
  },
  {
    method: 'POST',
    path: '/v1/billing/cancel',
    message: 'Billing is disabled in the OSS build. Cancel is not available.',
  },
  {
    method: 'POST',
    path: '/v1/billing/reactivate',
    message: 'Billing is disabled in the OSS build. Reactivate is not available.',
  },
  {
    method: 'PUT',
    path: '/v1/billing/settings',
    message: 'Billing is disabled in the OSS build. Settings are not available.',
  },
];

function matchOssBillingGone(method: string, path: string) {
  return OSS_BILLING_GONE.find((entry) => entry.method === method && entry.path === path);
}

/**
 * Short-circuit commercial billing mutations with 410 Gone before auth middleware.
 * Unauthenticated callers must not receive 401 on disabled checkout/portal paths (AC-075).
 */
export const ossBillingGoneMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!config.isOss()) {
    return next();
  }

  const match = matchOssBillingGone(c.req.method, c.req.path);
  if (match) {
    return c.json({ error: match.message }, 410);
  }

  return next();
};
