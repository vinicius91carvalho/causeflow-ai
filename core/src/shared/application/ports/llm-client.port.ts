import type { z } from 'zod';
export interface CompletionParams {
  model?: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  temperature?: number;
  responseSchema?: z.ZodType;
  /** Optional attributes to tag the trace/span (e.g. tenantId, incidentId). */
  attributes?: Record<string, string | number | boolean>;
}
export interface CompletionResult<T = string> {
  content: T;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  model: string;
  costUsd: number;
}
export interface LLMClient {
  complete<T>(params: CompletionParams): Promise<CompletionResult<T>>;
}
