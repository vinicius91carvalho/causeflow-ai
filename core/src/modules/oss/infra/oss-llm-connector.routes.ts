/**
 * OSS LLM connector HTTP routes (AC-059, AC-086).
 * Returns the tenant's active Investigation LLM profile when configured;
 * otherwise falls back to the legacy three-id enum connectors.
 */
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { LlmConnectorId } from '../../../shared/domain/llm-connector.entity.js';
import { LLM_CONTEXT_TOO_LARGE_CODE } from '../../../shared/domain/llm-connector.entity.js';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import {
  getActiveLlmConnectorProfile,
  getLlmConnectorProfile,
  listLlmConnectorOptions,
} from '../../../shared/infra/llm/llm-connector-profile.js';
import { setActiveLlmConnectorId } from '../../../shared/infra/llm/oss-llm-connector-store.js';
import { resetOssLlmCircuitBreaker } from '../../../shared/infra/llm/oss-llm-circuit-breaker.js';
import { resolveActiveInvestigationLlmProfileEndpoint } from './resolve-investigation-llm-profile.js';

const connectorIdSchema = z.enum(['ornith', 'deepseek-opencode', 'deepseek-nim']);

const selectConnectorSchema = z.object({
  connector: connectorIdSchema,
});

export function createOssLlmConnectorRoutes(): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  routes.get('/', async (c) => {
    const tenantId = String(c.get('tenantId'));
    const custom = await resolveActiveInvestigationLlmProfileEndpoint(tenantId);
    if (custom) {
      return c.json({
        active: {
          id: custom.profileId ?? custom.connectorId,
          label: custom.label ?? custom.model,
          model: custom.model,
          baseUrl: custom.baseUrl,
          contextWindowTokens: custom.contextWindowTokens,
          credentialsConfigured: custom.credentialsConfigured ?? Boolean(custom.apiKey),
          source: 'investigation-llm-profile',
        },
        options: listLlmConnectorOptions(),
        contextOverflowCode: LLM_CONTEXT_TOO_LARGE_CODE,
        credentialSources: [
          'Settings → Investigation LLM profiles (custom OpenAI-compatible providers)',
          '~/.pi/agent/auth.json (legacy enum connectors)',
          'OPENCODE_API_KEY / NVIDIA_API_KEY env vars (never commit)',
        ],
      });
    }

    const active = await getActiveLlmConnectorProfile();
    return c.json({
      active: {
        id: active.id,
        label: active.label,
        model: active.model,
        baseUrl: active.baseUrl,
        contextWindowTokens: active.contextWindowTokens,
        credentialsConfigured: active.credentialsConfigured,
        source: 'legacy-connector',
      },
      options: listLlmConnectorOptions(),
      contextOverflowCode: LLM_CONTEXT_TOO_LARGE_CODE,
      credentialSources: [
        '~/.pi/agent/auth.json (opencode-go, nvidia)',
        '~/.config/opencode',
        'OPENCODE_API_KEY / NVIDIA_API_KEY env vars (never commit)',
      ],
    });
  });

  routes.put('/', zValidator('json', selectConnectorSchema), async (c) => {
    const { connector } = c.req.valid('json') as { connector: LlmConnectorId };
    const profile = getLlmConnectorProfile(connector);
    if (connector !== 'ornith' && !profile.credentialsConfigured) {
      return c.json(
        {
          error: 'DeepSeek credentials not configured',
          connector,
          hint:
            connector === 'deepseek-opencode'
              ? 'Set OPENCODE_API_KEY from ~/.pi/agent/auth.json or ~/.config/opencode'
              : 'Set NVIDIA_API_KEY from ~/.pi/agent/auth.json',
        },
        400,
      );
    }
    await setActiveLlmConnectorId(connector);
    resetOssLlmCircuitBreaker();
    return c.json({
      active: {
        id: profile.id,
        label: profile.label,
        model: profile.model,
        baseUrl: profile.baseUrl,
        contextWindowTokens: profile.contextWindowTokens,
        credentialsConfigured: profile.credentialsConfigured,
        source: 'legacy-connector',
      },
    });
  });

  return routes;
}
