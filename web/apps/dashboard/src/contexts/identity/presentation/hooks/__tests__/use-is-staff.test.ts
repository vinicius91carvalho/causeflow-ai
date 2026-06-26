import { describe, expect, it } from 'vitest';
import { isStaffEmail } from '../use-is-staff';

describe('isStaffEmail', () => {
  it('accepts any email ending in @causeflow.ai', () => {
    expect(isStaffEmail('sergio@causeflow.ai')).toBe(true);
    expect(isStaffEmail('ops+test@causeflow.ai')).toBe(true);
  });

  it('accepts any email ending in @simuser.ai (sister brand)', () => {
    expect(isStaffEmail('sergio@simuser.ai')).toBe(true);
    expect(isStaffEmail('ops+test@simuser.ai')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isStaffEmail('Sergio@CauseFlow.AI')).toBe(true);
    expect(isStaffEmail('Sergio@SimUser.AI')).toBe(true);
  });

  it('rejects other domains', () => {
    expect(isStaffEmail('admin@acme.com')).toBe(false);
  });

  it('rejects lookalike suffix domains', () => {
    expect(isStaffEmail('attacker@causeflow.ai.evil.com')).toBe(false);
    expect(isStaffEmail('evilcauseflow.ai')).toBe(false);
    expect(isStaffEmail('attacker@simuser.ai.evil.com')).toBe(false);
  });

  it('returns false for empty / null / undefined', () => {
    expect(isStaffEmail('')).toBe(false);
    expect(isStaffEmail(null)).toBe(false);
    expect(isStaffEmail(undefined)).toBe(false);
  });
});
