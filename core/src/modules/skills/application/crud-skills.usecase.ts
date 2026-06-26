import { v4 as uuidv4 } from 'uuid';
import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { ISkillRepository } from '../domain/skill.repository.js';
import type { InvestigationSkill, SkillId } from '../domain/skill.entity.js';
import { skillId } from '../domain/skill.entity.js';

export interface CreateSkillInput {
    tenantId: TenantId;
    name: string;
    displayName: string;
    description: string;
    whenToUse: string;
    systemPrompt: string;
    allowedTools: string[];
    model?: string;
    maxTurns?: number;
    minToolCalls?: number;
}

export class CreateSkillUseCase {
    constructor(private readonly repo: ISkillRepository) {}

    async execute(input: CreateSkillInput): Promise<InvestigationSkill> {
        const now = new Date().toISOString();
        const skill: InvestigationSkill = {
            id: skillId(uuidv4()),
            tenantId: input.tenantId,
            name: input.name,
            displayName: input.displayName,
            description: input.description,
            whenToUse: input.whenToUse,
            systemPrompt: input.systemPrompt,
            allowedTools: input.allowedTools,
            model: input.model,
            maxTurns: input.maxTurns ?? 5,
            minToolCalls: input.minToolCalls ?? 2,
            isEnabled: true,
            createdAt: now,
            updatedAt: now,
        };
        return this.repo.create(skill);
    }
}

export class ListSkillsUseCase {
    constructor(private readonly repo: ISkillRepository) {}

    async execute(tenantId: TenantId): Promise<InvestigationSkill[]> {
        return this.repo.findByTenant(tenantId);
    }
}

export class GetSkillUseCase {
    constructor(private readonly repo: ISkillRepository) {}

    async execute(tenantId: TenantId, id: SkillId): Promise<InvestigationSkill | null> {
        return this.repo.findById(tenantId, id);
    }
}

export class UpdateSkillUseCase {
    constructor(private readonly repo: ISkillRepository) {}

    async execute(tenantId: TenantId, id: SkillId, data: Partial<CreateSkillInput>): Promise<InvestigationSkill> {
        return this.repo.update(tenantId, id, { ...data, updatedAt: new Date().toISOString() });
    }
}

export class DeleteSkillUseCase {
    constructor(private readonly repo: ISkillRepository) {}

    async execute(tenantId: TenantId, id: SkillId): Promise<void> {
        return this.repo.delete(tenantId, id);
    }
}
