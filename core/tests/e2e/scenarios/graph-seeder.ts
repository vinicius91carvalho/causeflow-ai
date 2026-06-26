import type { TenantId } from '../../../src/shared/domain/value-objects.js';

/**
 * Stub — graph module was removed; seeding is now a no-op.
 * Kept so existing e2e / smoke / eval tests compile without changes.
 */
export async function seedServiceGraph(_useCases: unknown, _tenantId: TenantId): Promise<void> {
  // no-op
}
