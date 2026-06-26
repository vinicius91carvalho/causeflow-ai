import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { InvestigationSkill, SkillId } from './skill.entity.js';

export interface ISkillRepository {
    create(skill: InvestigationSkill): Promise<InvestigationSkill>;
    findById(tenantId: TenantId, id: SkillId): Promise<InvestigationSkill | null>;
    findByTenant(tenantId: TenantId): Promise<InvestigationSkill[]>;
    update(tenantId: TenantId, id: SkillId, data: Partial<InvestigationSkill>): Promise<InvestigationSkill>;
    delete(tenantId: TenantId, id: SkillId): Promise<void>;
}
