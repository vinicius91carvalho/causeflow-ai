/**
 * Runtime OSS LLM connector selection shared across API + worker (AC-059).
 * Persists the operator's active connector in Redis so triage/investigation
 * processes pick up switches without a full container restart.
 */
import type { LlmConnectorId } from '../../domain/llm-connector.entity.js';
import { config } from '../../config/index.js';
import { getRedisClient } from '../cache/redis-client.js';
import { resetOssLlmCircuitBreaker } from './oss-llm-circuit-breaker.js';

const REDIS_KEY = 'causeflow:oss:llm-connector:active';

let memoryOverride: LlmConnectorId | null = null;
let lastResolvedConnectorId: LlmConnectorId | null = null;

function parseConnectorId(raw: string | null | undefined): LlmConnectorId | null {
  if (raw === 'ornith' || raw === 'deepseek-opencode' || raw === 'deepseek-nim') {
    return raw;
  }
  return null;
}

function noteConnectorChange(id: LlmConnectorId): LlmConnectorId {
  if (lastResolvedConnectorId && lastResolvedConnectorId !== id) {
    resetOssLlmCircuitBreaker();
  }
  lastResolvedConnectorId = id;
  return id;
}

export function getBootLlmConnectorId(): LlmConnectorId {
  const fromEnv = parseConnectorId(config.llm.connector);
  return fromEnv ?? 'ornith';
}

export async function getActiveLlmConnectorId(): Promise<LlmConnectorId> {
  if (memoryOverride) return noteConnectorChange(memoryOverride);
  if (!config.isOss()) return noteConnectorChange(getBootLlmConnectorId());
  try {
    const redis = getRedisClient();
    const stored = await redis.get(REDIS_KEY);
    const parsed = parseConnectorId(stored ?? undefined);
    if (parsed) return noteConnectorChange(parsed);
  } catch {
    // Redis unavailable — fall back to boot env.
  }
  return noteConnectorChange(getBootLlmConnectorId());
}

/** Synchronous read for hot paths that cannot await Redis (uses memory + boot env). */
export function getActiveLlmConnectorIdSync(): LlmConnectorId {
  return memoryOverride ?? getBootLlmConnectorId();
}

export async function setActiveLlmConnectorId(id: LlmConnectorId): Promise<void> {
  memoryOverride = id;
  noteConnectorChange(id);
  if (!config.isOss()) return;
  try {
    const redis = getRedisClient();
    await redis.set(REDIS_KEY, id);
  } catch {
    // Memory override still applies for this process.
  }
}

export function clearActiveLlmConnectorOverrideForTests(): void {
  memoryOverride = null;
  lastResolvedConnectorId = null;
}
