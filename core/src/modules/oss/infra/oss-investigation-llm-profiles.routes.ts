/**
 * OSS Investigation LLM profile HTTP routes (AC-084).
 * Admins create named OpenAI-compatible profiles; list is tenant-scoped.
 */
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireRole } from '../../../shared/infra/http/middleware/rbac.middleware.js';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import { AesGcmTokenEncryption } from '../../../shared/infra/credentials/aes-gcm-token-encryption.js';
import { toPublicInvestigationLlmProfile } from '../domain/investigation-llm-profile.entity.js';
import { PgInvestigationLlmProfileRepository } from './pg-investigation-llm-profile.repository.js';

const createProfileSchema = z.object({
  label: z.string().trim().min(1, 'label is required').max(200),
  baseUrl: z.string().trim().url('baseUrl must be a valid URL'),
  model: z.string().trim().min(1, 'model is required').max(200),
  apiKey: z.string().trim().min(1).optional(),
  contextWindowTokens: z.number().int().positive().max(10_000_000).optional(),
});

let repo: PgInvestigationLlmProfileRepository | null = null;
let encryption: AesGcmTokenEncryption | null = null;

function getRepo(): PgInvestigationLlmProfileRepository {
  if (!repo) repo = new PgInvestigationLlmProfileRepository();
  return repo;
}

function getEncryption(): AesGcmTokenEncryption {
  if (!encryption) encryption = new AesGcmTokenEncryption();
  return encryption;
}

export function createOssInvestigationLlmProfilesRoutes(): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  routes.get('/', async (c) => {
    const tenantId = c.get('tenantId');
    const profiles = await getRepo().listByTenant(String(tenantId));
    return c.json({
      items: profiles.map(toPublicInvestigationLlmProfile),
    });
  });

  routes.post('/', requireRole('admin'), zValidator('json', createProfileSchema), async (c) => {
    const tenantId = String(c.get('tenantId'));
    const input = c.req.valid('json');
    const apiKeyEncrypted = input.apiKey
      ? await getEncryption().encrypt(input.apiKey)
      : undefined;

    const profile = await getRepo().create({
      id: randomUUID(),
      tenantId,
      label: input.label,
      baseUrl: input.baseUrl,
      model: input.model,
      apiKeyEncrypted,
      contextWindowTokens: input.contextWindowTokens,
    });

    return c.json(toPublicInvestigationLlmProfile(profile), 201);
  });

  return routes;
}
