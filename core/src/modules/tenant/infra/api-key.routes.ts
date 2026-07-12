import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { apiKeyId } from '../../../shared/domain/value-objects.js';
import { requireRole } from '../../../shared/infra/http/middleware/rbac.middleware.js';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import type { CreateApiKeyUseCase } from '../application/create-api-key.usecase.js';
import type { ListApiKeysUseCase } from '../application/list-api-keys.usecase.js';
import type { RevokeApiKeyUseCase } from '../application/revoke-api-key.usecase.js';

export interface ApiKeyUseCases {
  createApiKey: CreateApiKeyUseCase;
  listApiKeys: ListApiKeysUseCase;
  revokeApiKey: RevokeApiKeyUseCase;
}

const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string()).optional(),
});
export function createApiKeyRoutes(
  useCases: ApiKeyUseCases,
): Hono<AppEnv, import('hono/types').BlankSchema, '/'> {
  const app = new Hono<AppEnv>();
  app.post('/', requireRole('admin'), zValidator('json', createApiKeySchema), async (c) => {
    const tenantId = c.get('tenantId');
    const { name, scopes } = c.req.valid('json');
    const result = await useCases.createApiKey.execute({
      tenantId,
      name,
      scopes,
      createdBy: c.get('userId'),
      createdByEmail: c.get('userEmail'),
    });
    return c.json(
      {
        keyId: result.apiKey.keyId,
        name: result.apiKey.name,
        prefix: result.apiKey.prefix,
        scopes: result.apiKey.scopes ?? [],
        plaintext: result.plaintext,
        createdAt: result.apiKey.createdAt,
      },
      201,
    );
  });
  app.get('/', async (c) => {
    const tenantId = c.get('tenantId');
    const keys = await useCases.listApiKeys.execute(tenantId);
    // Never return keyHash in list response
    const safeKeys = keys.map(({ keyHash: _, ...rest }) => rest);
    return c.json({ items: safeKeys });
  });
  app.delete('/:keyId', requireRole('admin'), async (c) => {
    const tenantId = c.get('tenantId');
    const keyId = apiKeyId(c.req.param('keyId'));
    const revoked = await useCases.revokeApiKey.execute(tenantId, keyId);
    return c.json({ keyId: revoked.keyId, status: revoked.status, revokedAt: revoked.revokedAt });
  });
  return app;
}
