import type { MiddlewareHandler } from 'hono';
import { verifyToken } from '@clerk/backend';
import { createHash, createSecretKey } from 'node:crypto';
import { jwtVerify } from 'jose';
import { config } from '../../../config/index.js';
import { UnauthorizedError } from '../../../domain/errors.js';
import { tenantId } from '../../../domain/value-objects.js';
import type { IApiKeyRepository } from '../../../../modules/tenant/domain/api-key.repository.js';
import type { AppEnv } from '../hono-types.js';

// API-key resolver injected by the composition root (src/bootstrap.ts). When
// configured, a Bearer token shaped `cflo_...` is resolved to its tenant (and
// creator identity) instead of being treated as a Clerk JWT.
let apiKeyRepo: IApiKeyRepository | null = null;
export function configureAuthApiKeyRepo(repo: IApiKeyRepository | null): void {
    apiKeyRepo = repo;
}

const PUBLIC_PATHS = [
  '/health',
  '/health/detailed',
  '/v1/webhooks/',
  '/webhooks/',
  '/dashboard',
  '/v1/auth/clerk-webhook',
  '/v1/auth/oss-login',
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

  // Programmatic API key (cflo_ prefix) — resolves tenant + creator identity
  // via the API key repository. Falls through to Clerk JWT verification when
  // the token is not an API key.
  if (token.startsWith('cflo_') && apiKeyRepo) {
    try {
      const keyHash = createHash('sha256').update(token).digest('hex');
      const apiKey = await apiKeyRepo.findByHash(keyHash);
      if (!apiKey || apiKey.status !== 'active') {
        throw new UnauthorizedError('Invalid or revoked API key');
      }
      c.set('userId', apiKey.createdBy ?? `apikey:${apiKey.keyId}`);
      c.set('userEmail', apiKey.createdByEmail ?? '');
      c.set('userRoles', ['apikey']);
      c.set('tenantId', tenantId(apiKey.tenantId));
      return next();
    } catch (err) {
      if (err instanceof UnauthorizedError) throw err;
      throw new UnauthorizedError('Invalid or expired token');
    }
  }

  // Try local JWT verification first (dev/OSS mode with JWT_SECRET)
  if (config.auth.jwtSecret) {
    try {
      const secret = createSecretKey(Buffer.from(config.auth.jwtSecret, 'utf-8'));
      const { payload } = await jwtVerify(token, secret, {
        issuer: config.auth.jwtIssuer,
      });

      const userId = payload.sub ?? 'anonymous';
      const email = (payload.email as string) ?? '';
      const orgId = (payload.tenantId as string) ?? (payload.org_id as string);
      const orgRole = payload.org_role as string | undefined;

      const roles: string[] = [];
      if (orgRole) {
        if (orgRole === 'admin') roles.push('admin');
        else roles.push('member');
      }

      c.set('userId', userId);
      c.set('userEmail', email);
      c.set('userRoles', roles);

      if (orgId) {
        c.set('tenantId', tenantId(orgId));
      }

      return next();
    } catch {
      // Local JWT failed — fall through to Clerk verification if configured
      if (!config.clerk.secretKey) {
        throw new UnauthorizedError('Invalid or expired token');
      }
    }
  }

  try {
    // When Clerk is not configured (empty secretKey in dev/test), fall back to
    // local JWT verification using the configured JWT_SECRET. This allows
    // testing protected endpoints without a live Clerk instance.
    if (!config.clerk.secretKey) {
      const secret = new TextEncoder().encode(config.auth.jwtSecret);
      const { payload } = await jwtVerify(token, secret, {
        issuer: config.auth.jwtIssuer,
        audience: config.auth.jwtAudience,
      });
      const orgId = (payload as Record<string, unknown>).tenant_id as string | undefined;
      const userId = payload.sub ?? '';
      const email = (payload as Record<string, unknown>).email as string ?? '';
      const roles = (payload as Record<string, unknown>).roles as string[] ?? [];
      c.set('userId', userId);
      c.set('userEmail', email);
      c.set('userRoles', roles);
      if (orgId) {
        c.set('tenantId', tenantId(orgId));
      } else if (!isProvisioningPath(path, c.req.method)) {
        throw new UnauthorizedError('No organization selected. Please select an organization.');
      }
      return next();
    }

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
