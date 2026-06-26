/**
 * localStorage-backed draft persistence for the business profile wizard.
 *
 * Draft is keyed per schema version (not per locale) so switching locale
 * mid-wizard preserves answers while labels re-render in the new language.
 *
 * SSR-safe: all localStorage calls are guarded behind typeof checks.
 */

export const DRAFT_KEY_PREFIX = 'causeflow-business-profile-draft-';

function key(version: string): string {
  return `${DRAFT_KEY_PREFIX}${version}`;
}

function getStorage(): Storage | null {
  try {
    // Access globalThis.localStorage so vi.stubGlobal patches work in tests
    // biome-ignore lint/suspicious/noExplicitAny: intentional cross-env access
    const ls = (globalThis as any).localStorage as Storage | undefined;
    return ls ?? null;
  } catch {
    return null;
  }
}

export function loadDraft(version: string): Record<string, unknown> | null {
  try {
    const ls = getStorage();
    if (!ls) return null;
    const raw = ls.getItem(key(version));
    if (!raw) return null;
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function saveDraft(version: string, answers: Record<string, unknown>): void {
  try {
    const ls = getStorage();
    if (!ls) return;
    ls.setItem(key(version), JSON.stringify(answers));
  } catch {
    // Silently ignore quota errors
  }
}

export function clearDraft(version: string): void {
  try {
    const ls = getStorage();
    if (!ls) return;
    ls.removeItem(key(version));
  } catch {
    // Silently ignore
  }
}
