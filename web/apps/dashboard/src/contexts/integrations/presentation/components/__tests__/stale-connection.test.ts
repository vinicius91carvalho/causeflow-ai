import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatRelativeTime } from '@/contexts/shared/lib/format-date';
import { isStaleConnection } from '../stale-connection';

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-24T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for a recent timestamp', () => {
    const result = formatRelativeTime('2026-02-24T11:59:50Z');
    expect(result).toBe('just now');
  });

  it('returns minutes ago for timestamps within the hour', () => {
    const result = formatRelativeTime('2026-02-24T11:45:00Z');
    expect(result).toBe('15 minutes ago');
  });

  it('returns "1 minute ago" (singular)', () => {
    const result = formatRelativeTime('2026-02-24T11:59:00Z');
    expect(result).toBe('1 minute ago');
  });

  it('returns hours ago for timestamps within a day', () => {
    const result = formatRelativeTime('2026-02-24T09:00:00Z');
    expect(result).toBe('3 hours ago');
  });

  it('returns "1 hour ago" (singular)', () => {
    const result = formatRelativeTime('2026-02-24T11:00:00Z');
    expect(result).toBe('1 hour ago');
  });

  it('returns days ago for timestamps over a day old', () => {
    const result = formatRelativeTime('2026-02-22T12:00:00Z');
    expect(result).toBe('2 days ago');
  });

  it('returns "1 day ago" (singular)', () => {
    const result = formatRelativeTime('2026-02-23T12:00:00Z');
    expect(result).toBe('1 day ago');
  });
});

describe('isStaleConnection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-24T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns false for undefined lastTestedAt', () => {
    expect(isStaleConnection(undefined)).toBe(false);
  });

  it('returns false for a recently tested connection (1 day ago)', () => {
    const recentDate = new Date('2026-02-23T12:00:00Z').toISOString();
    expect(isStaleConnection(recentDate)).toBe(false);
  });

  it('returns false for a connection tested exactly 7 days ago (boundary)', () => {
    const sevenDaysAgo = new Date('2026-02-17T12:00:00Z').toISOString();
    // Exactly at boundary — not stale
    expect(isStaleConnection(sevenDaysAgo)).toBe(false);
  });

  it('returns true for a connection tested more than 7 days ago', () => {
    const eightDaysAgo = new Date('2026-02-16T11:59:00Z').toISOString();
    expect(isStaleConnection(eightDaysAgo)).toBe(true);
  });

  it('returns true for a connection tested 30 days ago', () => {
    const thirtyDaysAgo = new Date('2026-01-25T12:00:00Z').toISOString();
    expect(isStaleConnection(thirtyDaysAgo)).toBe(true);
  });
});
