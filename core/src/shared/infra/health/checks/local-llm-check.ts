import { config } from '../../../config/index.js';
import type { HealthCheck, HealthCheckResult } from '../health-checker.js';
import type { CircuitBreaker } from '../../llm/circuit-breaker.js';

/**
 * Local Ornith / llama.cpp reachability check for the OSS runtime (AC-054).
 * Pings the OpenAI-compatible `/models` endpoint configured via LLM_BASE_URL.
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
    if (breakerState === 'open') {
      return {
        name: this.name,
        status: 'degraded',
        latencyMs: Date.now() - start,
        details: {
          baseUrl: config.llm.baseUrl,
          model: config.llm.model,
          circuitState: breakerState,
          message: 'Local LLM circuit breaker open',
        },
      };
    }

    try {
      const res = await fetch(`${config.llm.baseUrl}/models`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${config.llm.apiKey}` },
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) {
        return {
          name: this.name,
          status: 'degraded',
          latencyMs: Date.now() - start,
          details: {
            baseUrl: config.llm.baseUrl,
            model: config.llm.model,
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
          baseUrl: config.llm.baseUrl,
          model: config.llm.model,
        },
      };
    } catch (err) {
      return {
        name: this.name,
        status: 'degraded',
        latencyMs: Date.now() - start,
        details: {
          baseUrl: config.llm.baseUrl,
          model: config.llm.model,
          error: err instanceof Error ? err.message : String(err),
          message: 'Local LLM connector unreachable',
        },
      };
    }
  }
}
