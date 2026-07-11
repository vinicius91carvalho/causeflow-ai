/**
 * Context overflow detection for OSS LLM connectors (AC-059).
 */
import { LLM_CONTEXT_TOO_LARGE_CODE } from '../../domain/llm-connector.entity.js';

const CONTEXT_OVERFLOW_PATTERNS = [
  /context\s*(length|window|size|limit)/i,
  /maximum\s*context/i,
  /too\s*many\s*tokens/i,
  /token\s*limit/i,
  /prompt\s*is\s*too\s*long/i,
  /context\s*overflow/i,
  /exceeds\s*the\s*model/i,
  /max\s*tokens?\s*exceeded/i,
  /input\s*is\s*too\s*large/i,
];

export class LlmContextTooLargeError extends Error {
  readonly code = LLM_CONTEXT_TOO_LARGE_CODE;

  constructor(
    message: string,
    readonly connectorId: string,
    readonly model: string,
    readonly httpStatus?: number,
  ) {
    super(message);
    this.name = 'LlmContextTooLargeError';
  }
}

export function isContextOverflowError(message: string, httpStatus?: number): boolean {
  if (httpStatus === 413) return true;
  const text = message.toLowerCase();
  return CONTEXT_OVERFLOW_PATTERNS.some((pattern) => pattern.test(text));
}

export function contextOverflowGuidance(connectorId: string): string {
  if (connectorId === 'ornith') {
    return 'Ornith 9B context window (~32k) exceeded. Switch the active LLM connector to DeepSeek V4 Flash via PUT /v1/oss/llm-connector (deepseek-opencode or deepseek-nim).';
  }
  return 'Prompt exceeds the active LLM connector context window.';
}

export function shouldCountLlmCircuitFailure(error: unknown): boolean {
  return !(error instanceof LlmContextTooLargeError);
}
