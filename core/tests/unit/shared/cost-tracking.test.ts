import { describe, it, expect } from 'vitest';
import { calculateCost, MODEL_PRICING } from '../../../src/shared/domain/cost.js';

describe('calculateCost', () => {
  it('should calculate cost for claude-sonnet-4-5-20250929', () => {
    const cost = calculateCost('claude-sonnet-4-5-20250929', 1_000_000, 1_000_000);
    // 1M input * $3/1M + 1M output * $15/1M = $18
    expect(cost).toBe(18);
  });

  it('should calculate cost for claude-haiku-4-5-20251001', () => {
    const cost = calculateCost('claude-haiku-4-5-20251001', 1_000_000, 1_000_000);
    // 1M input * $1/1M + 1M output * $5/1M = $6
    expect(cost).toBe(6);
  });

  it('should calculate cost for claude-opus-4-6', () => {
    const cost = calculateCost('claude-opus-4-6', 1_000_000, 1_000_000);
    // 1M input * $5/1M + 1M output * $25/1M = $30
    expect(cost).toBe(30);
  });

  it('should discount cache read tokens', () => {
    // 1M total input, 500k from cache
    const cost = calculateCost('claude-sonnet-4-5-20250929', 1_000_000, 0, 500_000);
    // 500k base input * $3/1M + 500k cache * $0.30/1M = $1.5 + $0.15 = $1.65
    expect(cost).toBe(1.65);
  });

  it('should handle small token counts', () => {
    const cost = calculateCost('claude-haiku-4-5-20251001', 500, 200);
    // 500 input * $1/1M + 200 output * $5/1M = 0.0005 + 0.001 = 0.0015
    expect(cost).toBeCloseTo(0.0015, 6);
  });

  it('should return 0 for 0 tokens', () => {
    const cost = calculateCost('claude-sonnet-4-5-20250929', 0, 0);
    expect(cost).toBe(0);
  });

  it('should use default pricing for unknown model', () => {
    const cost = calculateCost('unknown-model', 1_000_000, 1_000_000);
    // Falls back to default (sonnet): $3/1M input + $15/1M output = $18
    expect(cost).toBe(18);
  });

  it('should handle input-only cost', () => {
    const cost = calculateCost('claude-haiku-4-5-20251001', 1_000_000, 0);
    // 1M input * $1/1M = $1
    expect(cost).toBe(1);
  });

  it('should handle output-only cost', () => {
    const cost = calculateCost('claude-haiku-4-5-20251001', 0, 1_000_000);
    // 1M output * $5/1M = $5
    expect(cost).toBe(5);
  });
});

describe('MODEL_PRICING', () => {
  it('should have pricing for sonnet', () => {
    expect(MODEL_PRICING['claude-sonnet-4-5-20250929']).toBeDefined();
    expect(MODEL_PRICING['claude-sonnet-4-5-20250929']!.inputPer1M).toBe(3.0);
    expect(MODEL_PRICING['claude-sonnet-4-5-20250929']!.outputPer1M).toBe(15.0);
  });

  it('should have pricing for haiku', () => {
    expect(MODEL_PRICING['claude-haiku-4-5-20251001']).toBeDefined();
    expect(MODEL_PRICING['claude-haiku-4-5-20251001']!.inputPer1M).toBe(1.0);
    expect(MODEL_PRICING['claude-haiku-4-5-20251001']!.outputPer1M).toBe(5.0);
  });

  it('should have pricing for opus', () => {
    expect(MODEL_PRICING['claude-opus-4-6']).toBeDefined();
    expect(MODEL_PRICING['claude-opus-4-6']!.inputPer1M).toBe(5.0);
    expect(MODEL_PRICING['claude-opus-4-6']!.outputPer1M).toBe(25.0);
  });
});
