import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock localStorage
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
};

vi.stubGlobal('localStorage', localStorageMock);

import { clearDraft, DRAFT_KEY_PREFIX, loadDraft, saveDraft } from './use-business-profile-draft';

describe('use-business-profile-draft', () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
  });

  it('returns null when no draft exists', () => {
    const result = loadDraft('v1');
    expect(result).toBeNull();
  });

  it('saves and loads a draft', () => {
    const answers = { companyName: 'Acme', industry: 'saas' };
    saveDraft('v1', answers);
    const loaded = loadDraft('v1');
    expect(loaded).toEqual(answers);
  });

  it('uses per-version key', () => {
    saveDraft('v1', { companyName: 'V1 Corp' });
    saveDraft('v2', { companyName: 'V2 Corp' });
    expect(loadDraft('v1')).toEqual({ companyName: 'V1 Corp' });
    expect(loadDraft('v2')).toEqual({ companyName: 'V2 Corp' });
  });

  it('clears draft after successful submit', () => {
    saveDraft('v1', { companyName: 'Acme' });
    clearDraft('v1');
    expect(loadDraft('v1')).toBeNull();
  });

  it('key format includes DRAFT_KEY_PREFIX', () => {
    saveDraft('v1', { companyName: 'Acme' });
    const key = `${DRAFT_KEY_PREFIX}v1`;
    expect(store[key]).toBeDefined();
  });

  it('returns null when localStorage contains invalid JSON', () => {
    store[`${DRAFT_KEY_PREFIX}v1`] = 'not-json';
    expect(loadDraft('v1')).toBeNull();
  });
});
