// IUserEmailResolver is a pure interface — no runtime behavior to unit-test here.
// Behavioral tests live in list-audit-entries.usecase.test.ts (Task 1)
// and clerk-user-email-resolver.test.ts (infra adapter).
import { describe, it } from 'vitest';
import type { IUserEmailResolver } from './user-email-resolver.js';

describe('IUserEmailResolver contract', () => {
  it('type is structurally satisfied by a plain object', () => {
    // This is a compile-time check: if the import or shape changes, TS will error.
    const _resolver: IUserEmailResolver = {
      resolveEmails: (_ids: string[]) => Promise.resolve(new Map<string, string>()),
    };
    void _resolver;
  });
});
