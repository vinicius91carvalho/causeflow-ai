/**
 * Tests for the business-profile schema registry.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('schema registry', () => {
  afterEach(() => {
    delete process.env.BUSINESS_PROFILE_SCHEMA_VERSION;
    // Reset module cache so env var changes take effect
    vi.resetModules();
  });

  it('loads v1 schema and validates it successfully', async () => {
    const { loadSchema } = await import('./registry');
    const schema = loadSchema('v1');
    expect(schema.version).toBe('v1');
    expect(schema.supportedLocales).toContain('en');
    expect(schema.supportedLocales).toContain('pt-br');
    expect(schema.steps.length).toBeGreaterThan(0);
  });

  it('v1 schema has both en and pt-br in supportedLocales', async () => {
    const { loadSchema } = await import('./registry');
    const schema = loadSchema('v1');
    expect(schema.supportedLocales).toContain('en');
    expect(schema.supportedLocales).toContain('pt-br');
  });

  it('throws on unknown version', async () => {
    const { loadSchema } = await import('./registry');
    expect(() => loadSchema('v999-does-not-exist')).toThrow();
  });

  it('getActiveSchema returns v1 by default', async () => {
    const { getActiveSchema } = await import('./registry');
    const schema = getActiveSchema();
    expect(schema.version).toBe('v1');
  });

  it('respects BUSINESS_PROFILE_SCHEMA_VERSION env override', async () => {
    process.env.BUSINESS_PROFILE_SCHEMA_VERSION = 'v1';
    vi.resetModules();
    const { getActiveSchema } = await import('./registry');
    const schema = getActiveSchema();
    expect(schema.version).toBe('v1');
  });
});
