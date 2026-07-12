import type { MiddlewareHandler } from 'hono';
import { createHash } from 'node:crypto';
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
  '/v1/auth/register', // OSS register — no auth required
  '/v1/auth/login', // OSS login — no auth required
  '/v1/billing/webhook',
  '/v1/signup',
  '/v1/widget/',
  '/widget/',
  '/portal',
  '/admin/queues', // AC-041: local-only admin queue visibility (no auth)
  '/v1/investigation/ws', // WebSocket relay — uses its own JWT auth (not Clerk)
  '/v1/relay/connect', // DB relay WS — uses its own token auth during upgrade
  '/v1/integrations/slack/oauth/callback', // Slack OAuth browser redirect — no JWT available
  '/v1/integrations/slack/events', // Slack Events API — verified via signing secret, not Bearer
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

  // OSS runtime: verify JWT locally with jose instead of calling Clerk.
  // The JWT is signed with the server's JWT_SECRET (HS256) and carries
  // custom claims (sub, email, tenant_id, roles).
  if (config.isOss()) {
    try {
      const { jwtVerify } = await import('jose');
      const secret = new TextEncoder().encode(config.auth.jwtSecret);
      const { payload } = await jwtVerify(token, secret, {
        issuer: 'causeflow',
        audience: 'causeflow-api',
      });

      const userId = payload.sub;
      const email = ((payload as Record<string, unknown>).email as string) ?? '';
      const tid = (payload as Record<string, unknown>).tenant_id as string;
      const roles = ((payload as Record<string, unknown>).roles as string[]) ?? [];

      c.set('userId', userId ?? '');
      c.set('userEmail', email);
      c.set('userRoles', roles);

      if (tid) {
        c.set('tenantId', tenantId(tid));
      } else if (!isProvisioningPath(path, c.req.method)) {
        throw new UnauthorizedError('No tenant in token');
      }

      return next();
    } catch (err) {
      if (err instanceof UnauthorizedError) throw err;
      throw new UnauthorizedError('Invalid or expired token');
    }
  }

  // Dev/Test fallback: when Clerk is not configured (empty secretKey), verify
  // JWTs locally using JWT_SECRET. This allows testing protected endpoints
  // without a live Clerk instance. Only active in non-production environments.
  if (!config.clerk.secretKey && config.isDev() && !config.isOss()) {
    try {
      const { jwtVerify } = await import('jose');
      const secret = new TextEncoder().encode(config.auth.jwtSecret);
      const { payload } = await jwtVerify(token, secret, {
        issuer: config.auth.jwtIssuer,
        audience: config.auth.jwtAudience,
      });

      const tid = (payload as Record<string, unknown>).tenant_id as string | undefined;
      const userId = payload.sub ?? '';
      const email = ((payload as Record<string, unknown>).email as string) ?? '';
      const roles = ((payload as Record<string, unknown>).roles as string[]) ?? [];

      c.set('userId', userId);
      c.set('userEmail', email);
      c.set('userRoles', roles);

      if (tid) {
        c.set('tenantId', tenantId(tid));
      } else if (!isProvisioningPath(path, c.req.method)) {
        throw new UnauthorizedError('No tenant in token');
      }

      return next();
    } catch (err) {
      if (err instanceof UnauthorizedError) throw err;
      throw new UnauthorizedError('Invalid or expired token');
    }
  }

  try {
    const { verifyToken } = await import('@clerk/backend');
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
    const oPayload = (payload as Record<string, unknown>).o as
      | { id?: string; rol?: string; slg?: string }
      | undefined;
    const orgId = oPayload?.id ?? (payload.org_id as string | undefined);
    const userId = payload.sub;
    const email =
      (payload as Record<string, unknown>).email ??
      (payload as Record<string, unknown>).user_email ??
      '';
    const orgRole = oPayload?.rol
      ? `org:${oPayload.rol}`
      : ((payload as Record<string, unknown>).org_role as string | undefined);

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
      throw new UnauthorizedError('No organization selected. Please select an organization.');
    }

    return next();
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    throw new UnauthorizedError('Invalid or expired token');
  }
};
