import { describe, expect, it } from 'vitest';
import {
  isContextOverflowError,
  LlmContextTooLargeError,
  contextOverflowGuidance,
} from '../../../../src/shared/infra/llm/llm-context-errors.js';
import { LLM_CONTEXT_TOO_LARGE_CODE } from '../../../../src/shared/domain/llm-connector.entity.js';
import {
  connectorEvidenceLabel,
  getLlmConnectorProfile,
  listLlmConnectorOptions,
} from '../../../../src/shared/infra/llm/llm-connector-profile.js';

describe('llm-context-errors (AC-059)', () => {
  it('detects context length overflow messages', () => {
    expect(isContextOverflowError('maximum context length exceeded')).toBe(true);
    expect(isContextOverflowError('prompt is too long for this model')).toBe(true);
    expect(isContextOverflowError('authentication failed')).toBe(false);
  });

  it('treats HTTP 413 as context overflow', () => {
    expect(isContextOverflowError('payload', 413)).toBe(true);
  });

  it('exposes documented error code', () => {
    const err = new LlmContextTooLargeError('too big', 'ornith', 'Ornith-1.0-9B-code', 400);
    expect(err.code).toBe(LLM_CONTEXT_TOO_LARGE_CODE);
    expect(contextOverflowGuidance('ornith')).toMatch(/DeepSeek/);
  });
});

describe('llm-connector-profile (AC-059)', () => {
  it('lists ornith and deepseek connector options', () => {
    const options = listLlmConnectorOptions();
    const ids = options.map((o) => o.id);
    expect(ids).toContain('ornith');
    expect(ids).toContain('deepseek-opencode');
    expect(ids).toContain('deepseek-nim');
  });

  it('maps deepseek connectors to evidence labels', () => {
    expect(connectorEvidenceLabel('deepseek-opencode')).toBe('deepseek-opencode');
    expect(connectorEvidenceLabel('ornith')).toBe('local');
  });

  it('defaults opencode model to deepseek-v4-flash-free', () => {
    const profile = getLlmConnectorProfile('deepseek-opencode');
    expect(profile.model).toBe('deepseek-v4-flash-free');
    expect(profile.id).toBe('deepseek-opencode');
  });

  it('defaults nim model to deepseek-ai/deepseek-v4-flash', () => {
    const profile = getLlmConnectorProfile('deepseek-nim');
    expect(profile.model).toBe('deepseek-ai/deepseek-v4-flash');
    expect(profile.baseUrl).toContain('nvidia.com');
  });
});
