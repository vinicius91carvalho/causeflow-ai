
export interface ModelPricing {
    inputPer1M: number;
    outputPer1M: number;
    cacheHitPer1M: number;
}

// Pricing from https://docs.anthropic.com/en/docs/about-claude/models (2026-04)
export const MODEL_PRICING: Record<string, ModelPricing> = {
    // 4.6 (latest)
    'claude-opus-4-6':            { inputPer1M: 5.0,  outputPer1M: 25.0, cacheHitPer1M: 0.50 },
    'claude-sonnet-4-6':          { inputPer1M: 3.0,  outputPer1M: 15.0, cacheHitPer1M: 0.30 },
    // 4.5
    'claude-opus-4-5':            { inputPer1M: 5.0,  outputPer1M: 25.0, cacheHitPer1M: 0.50 },
    'claude-sonnet-4-5-20250929': { inputPer1M: 3.0,  outputPer1M: 15.0, cacheHitPer1M: 0.30 },
    'claude-sonnet-4-5':          { inputPer1M: 3.0,  outputPer1M: 15.0, cacheHitPer1M: 0.30 },
    'claude-haiku-4-5-20251001':  { inputPer1M: 1.0,  outputPer1M: 5.0,  cacheHitPer1M: 0.10 },
    'claude-haiku-4-5':           { inputPer1M: 1.0,  outputPer1M: 5.0,  cacheHitPer1M: 0.10 },
};
const DEFAULT_PRICING: ModelPricing = { inputPer1M: 3.0, outputPer1M: 15.0, cacheHitPer1M: 0.30 };

export function calculateCost(
    model: string,
    inputTokens: number,
    outputTokens: number,
    cacheReadTokens = 0,
): number {
    const pricing = MODEL_PRICING[model] ?? DEFAULT_PRICING;
    const baseInputTokens = inputTokens - cacheReadTokens;
    const inputCost = (baseInputTokens / 1_000_000) * pricing.inputPer1M;
    const cacheCost = (cacheReadTokens / 1_000_000) * pricing.cacheHitPer1M;
    const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;
    return Math.round((inputCost + cacheCost + outputCost) * 1e6) / 1e6;
}
