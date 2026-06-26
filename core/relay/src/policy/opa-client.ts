import { LRUCache } from 'lru-cache';
import type { IPolicyEvaluator, PolicyDecision, PolicyInput } from './policy.port.js';
import pino from 'pino';

const logger = pino({ name: 'opa-client' });

export interface OpaClientOptions {
  url: string;
  packagePath: string;
  cacheTtlMs: number;
  failClosed: boolean;
  timeoutMs: number;
}

export class OpaPolicyClient implements IPolicyEvaluator {
  private cache: LRUCache<string, PolicyDecision>;

  constructor(
    private readonly opts: OpaClientOptions,
    private readonly fallback: IPolicyEvaluator,
  ) {
    this.cache = new LRUCache<string, PolicyDecision>({
      max: 10_000,
      ttl: opts.cacheTtlMs,
    });
  }

  async evaluate(input: PolicyInput): Promise<PolicyDecision> {
    const cacheKey = this.cacheKey(input);
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const decision = await this.evaluateRemote(input);
      this.cache.set(cacheKey, decision);
      return decision;
    } catch (err) {
      logger.warn({ err, requestId: input.requestId }, 'OPA query failed');
      if (this.opts.failClosed) {
        return { allowed: false, reason: 'policy engine unavailable' };
      }
      return this.fallback.evaluate(input);
    }
  }

  private cacheKey(input: PolicyInput): string {
    return JSON.stringify({
      tenantId: input.tenantId,
      resourceId: input.resourceId,
      operation: input.command.operation,
      params: input.command.params,
    });
  }

  private async evaluateRemote(input: PolicyInput): Promise<PolicyDecision> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.opts.timeoutMs);
    try {
      const url = `${this.opts.url.replace(/\/$/, '')}/v1/data/${this.opts.packagePath.replace(/\./g, '/')}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`OPA ${res.status}`);
      const body = (await res.json()) as { result?: PolicyDecision };
      const decision = body.result;
      if (!decision || typeof decision.allowed !== 'boolean') {
        throw new Error('OPA returned malformed decision');
      }
      return decision;
    } finally {
      clearTimeout(timer);
    }
  }
}
