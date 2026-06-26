import type { IAuditRepository } from '../domain/audit.repository.js';
import type { IUserEmailResolver } from '../domain/user-email-resolver.js';
import type { AuditEntry } from '../domain/audit.entity.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';

export interface ListAuditEntriesInput {
  tenantId: TenantId;
  action?: string;
  actorType?: 'user' | 'system';
  limit?: number;
  cursor?: string;
}

export class ListAuditEntriesUseCase {
  repo;
  resolver;
  constructor(repo: IAuditRepository, resolver?: IUserEmailResolver) {
    this.repo = repo;
    this.resolver = resolver;
  }
  async execute(input: ListAuditEntriesInput) {
    let page: { items: AuditEntry[]; cursor?: string };

    if (input.action) {
      page = await this.repo.findByAction(input.tenantId, input.action, {
        limit: input.limit ?? 20,
        cursor: input.cursor,
      });
      // When both action and actorType are present, prefer findByAction and
      // apply actorType as an in-memory filter (action already narrows results;
      // note this may return fewer than `limit` items — acceptable trade-off).
      if (input.actorType) {
        page = {
          items: page.items.filter((e) => e.actorType === input.actorType),
          cursor: page.cursor,
        };
      }
    } else {
      page = await this.repo.findByTenant(input.tenantId, {
        limit: input.limit ?? 20,
        cursor: input.cursor,
        actorType: input.actorType,
      });
    }

    // Read-time actorEmail enrichment: for user entries with empty actorEmail,
    // resolve from Clerk at query time. Never mutates stored rows (hash integrity).
    if (this.resolver) {
      const toEnrich = page.items.filter(
        (e) => e.actorType === 'user' && e.actorEmail === '' && e.actorUserId,
      );
      if (toEnrich.length > 0) {
        const userIds = [...new Set(toEnrich.map((e) => e.actorUserId as string))];
        const emailMap = await this.resolver.resolveEmails(userIds);
        page = {
          items: page.items.map((e) => {
            if (e.actorType === 'user' && e.actorEmail === '' && e.actorUserId) {
              const resolved = emailMap.get(e.actorUserId) ?? '';
              if (resolved) {
                return { ...e, actorEmail: resolved };
              }
            }
            return e;
          }),
          cursor: page.cursor,
        };
      }
    }

    return page;
  }
}
