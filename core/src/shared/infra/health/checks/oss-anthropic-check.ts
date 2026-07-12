import { config } from '../../../config/index.js';
import type { HealthCheck, HealthCheckResult } from '../health-checker.js';

/**
 * Anthropic health check for the open-source local runtime (AC-039).
 *
 * The Anthropic API is the only optional paid SaaS the OSS runtime talks to.
 * To honour "no external endpoint is contacted at startup" we never ping the
 * API from the health check — we simply report:
 *   - `ok`      when an API key is configured (ready to be called on demand)
 *   - `skipped` when no key is set (AI features disabled, boot still green)
 *
 * This matches the AC-039 contract: Anthropic is "skipped" if no key is set.
 */
export class OssAnthropicHealthCheck {
  name = 'anthropic';

  async check(): Promise<HealthCheckResult> {
    const start = Date.now();
    const apiKey = config.anthropic.apiKey;
    return {
      name: this.name,
      status: apiKey ? 'ok' : 'skipped',
      latencyMs: Date.now() - start,
      details: apiKey
        ? { configured: true }
        : { configured: false, message: 'ANTHROPIC_API_KEY not set — AI features disabled' },
    };
  }
}
