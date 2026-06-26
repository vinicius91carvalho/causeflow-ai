import type { IUserEmailResolver } from '../domain/user-email-resolver.js';
import { clerkGetUserList } from '../../auth/infra/clerk-client.js';

export class ClerkUserEmailResolver implements IUserEmailResolver {
  async resolveEmails(userIds: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    if (userIds.length === 0) return result;

    // Deduplicate
    const unique = [...new Set(userIds)];

    // Pre-populate with empty strings so missing users are covered
    for (const id of unique) {
      result.set(id, '');
    }

    try {
      const response = await clerkGetUserList({ userId: unique, limit: unique.length });
      for (const user of response.data) {
        const primary =
          user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ??
          user.emailAddresses[0]?.emailAddress ??
          '';
        result.set(user.id, primary);
      }
    } catch (err) {
      console.warn('[ClerkUserEmailResolver] Failed to resolve emails:', err);
      // Return map with empty strings for all ids — callers must handle ''
    }

    return result;
  }
}
