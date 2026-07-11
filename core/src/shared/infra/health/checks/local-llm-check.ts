import { config } from '../../../config/index.js';
import type { HealthCheck, HealthCheckResult } from '../health-checker.js';
import type { CircuitBreaker } from '../../llm/circuit-breaker.js';
import { getActiveLlmConnectorProfile } from '../../llm/llm-connector-profile.js';
import { resolveActiveLlmEndpoint } from '../../llm/llm-connector-profile.js';

/**
 * Active OSS LLM connector reachability (AC-054 / AC-059).
 * Pings the OpenAI-compatible `/models` endpoint for Ornith or DeepSeek.
 */
export class LocalLlmHealthCheck implements HealthCheck {
  name = 'llm';

  constructor(private readonly circuitBreaker?: CircuitBreaker) {}

  async check(): Promise<HealthCheckResult> {
    if (!config.isOss() || config.anthropic.apiKey) {
      return {
        name: this.name,
        status: 'skipped',
        latencyMs: 0,
        details: { reason: 'Anthropic override active or non-OSS runtime' },
      };
    }

    const start = Date.now();
    const breakerState = this.circuitBreaker?.getState();
    const profile = await getActiveLlmConnectorProfile();
    if (breakerState === 'open') {
      return {
        name: this.name,
        status: 'degraded',
        latencyMs: Date.now() - start,
        details: {
          connector: profile.id,
          baseUrl: profile.baseUrl,
          model: profile.model,
          circuitState: breakerState,
          message: 'Local LLM circuit breaker open',
        },
      };
    }

    if (profile.id !== 'ornith' && !profile.credentialsConfigured) {
      return {
        name: this.name,
        status: 'degraded',
        latencyMs: Date.now() - start,
        details: {
          connector: profile.id,
          baseUrl: profile.baseUrl,
          model: profile.model,
          message: 'DeepSeek credentials not configured',
        },
      };
    }

    try {
      const endpoint = await resolveActiveLlmEndpoint();
      const res = await fetch(`${endpoint.baseUrl}/models`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${endpoint.apiKey}` },
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) {
        return {
          name: this.name,
          status: 'degraded',
          latencyMs: Date.now() - start,
          details: {
            connector: profile.id,
            baseUrl: profile.baseUrl,
            model: profile.model,
            httpStatus: res.status,
            message: 'Local LLM connector unreachable',
          },
        };
      }
      return {
        name: this.name,
        status: 'ok',
        latencyMs: Date.now() - start,
        details: {
          connector: profile.id,
          baseUrl: profile.baseUrl,
          model: profile.model,
        },
      };
    } catch (err) {
      return {
        name: this.name,
        status: 'degraded',
        latencyMs: Date.now() - start,
        details: {
          connector: profile.id,
          baseUrl: profile.baseUrl,
          model: profile.model,
          error: err instanceof Error ? err.message : String(err),
          message: 'Local LLM connector unreachable',
        },
      };
    }
  }
}
