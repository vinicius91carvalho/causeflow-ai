/**
 * In-memory skill repository for the OSS runtime.
 *
 * Uses a Map for storage so the skills module works without DynamoDB.
 * Skills are per-tenant investigation runbooks and escalation paths.
 */
import type { ISkillRepository } from '../domain/skill.repository.js';
import type { InvestigationSkill, SkillId } from '../domain/skill.entity.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';

const store = new Map<string, InvestigationSkill>();

function key(tenantId: string, id: string): string {
  return `${tenantId}::${id}`;
}

export class PgSkillRepository implements ISkillRepository {
  async create(skill: InvestigationSkill): Promise<InvestigationSkill> {
    store.set(key(skill.tenantId, skill.id), { ...skill });
    return skill;
  }

  async findById(tenantId: TenantId, id: SkillId): Promise<InvestigationSkill | null> {
    return store.get(key(tenantId, id)) ?? null;
  }

  async findByTenant(tenantId: TenantId): Promise<InvestigationSkill[]> {
    const result: InvestigationSkill[] = [];
    for (const [k, v] of store) {
      if (k.startsWith(tenantId + '::')) {
        result.push(v);
      }
    }
    result.sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
    return result;
  }

  async update(
    tenantId: TenantId,
    id: SkillId,
    data: Partial<InvestigationSkill>,
  ): Promise<InvestigationSkill> {
    const existing = store.get(key(tenantId, id));
    if (!existing) throw new Error(`Skill not found: ${id}`);
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    store.set(key(tenantId, id), updated);
    return updated;
  }

  async delete(tenantId: TenantId, id: SkillId): Promise<void> {
    store.delete(key(tenantId, id));
  }
}
