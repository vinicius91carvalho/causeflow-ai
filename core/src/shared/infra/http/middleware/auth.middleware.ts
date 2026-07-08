import type { MiddlewareHandler } from 'hono';
import { verifyToken } from '@clerk/backend';
import { config } from '../../../config/index.js';
import { UnauthorizedError } from '../../../domain/errors.js';
import { tenantId } from '../../../domain/value-objects.js';
import type { AppEnv } from '../hono-types.js';

const PUBLIC_PATHS = [
  '/health',
  '/health/detailed',
  '/v1/webhooks/',
  '/webhooks/',
  '/dashboard',
  '/v1/auth/clerk-webhook',
  '/v1/billing/webhook',
  '/v1/signup',
  '/v1/widget/',
  '/widget/',
  '/portal',
  '/v1/investigation/ws',  // WebSocket relay — uses its own JWT auth (not Clerk)
  '/v1/relay/',             // DB relay — uses its own token auth
  '/v1/integrations/slack/oauth/callback', // Slack OAuth browser redirect — no JWT available
];

// Provisioning paths: require valid JWT but org_id claim is optional.
// Used during onboarding when the tenant doesn't exist yet.
const isProvisioningPath = (path: string, method: string) =>
  path === '/v1/tenants' && method === 'POST';

export const authMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const path = c.req.path;

  if (PUBLIC_PATHS.some((p) => path.startsWith(p))) {
    return next();
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid Authorization header');
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifyToken(token, {
      secretKey: config.clerk.secretKey,
      // Networkless verification when CLERK_JWT_KEY (PEM) is configured; falls
      // back to JWKS lookup via secretKey when unset (production Clerk).
      ...(config.clerk.jwtKey ? { jwtKey: config.clerk.jwtKey } : {}),
    });

    // IDOR PROTECTION: tenantId comes ONLY from verified JWT org claims.
    // NEVER read tenantId from request params, body, or query string.
    // Clerk JWT v2 uses compact "o" claim: { id, rol, slg }
    // Clerk JWT v1 uses top-level org_id, org_role
    const oPayload = (payload as Record<string, unknown>).o as { id?: string; rol?: string; slg?: string } | undefined;
    const orgId = oPayload?.id ?? (payload.org_id as string | undefined);
    const userId = payload.sub;
    const email = (payload as Record<string, unknown>).email ?? (payload as Record<string, unknown>).user_email ?? '';
    const orgRole = oPayload?.rol ? `org:${oPayload.rol}` : ((payload as Record<string, unknown>).org_role as string | undefined);

    // Map Clerk org roles to app roles
    const roles: string[] = [];
    if (orgRole) {
      if (orgRole === 'org:admin') roles.push('admin');
      else roles.push('member');
    }

    c.set('userId', userId);
    c.set('userEmail', email as string);
    c.set('userRoles', roles);

    if (orgId) {
      // tenantId = Clerk org_id, cryptographically verified from JWT
      c.set('tenantId', tenantId(orgId));
    } else if (!isProvisioningPath(path, c.req.method)) {
      throw new UnauthorizedError(
        'No organization selected. Please select an organization.',
      );
    }

    return next();
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    throw new UnauthorizedError('Invalid or expired token');
  }
};
