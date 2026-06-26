import { describe, it, expect, vi } from 'vitest';
import { CreateSkillUseCase, ListSkillsUseCase, DeleteSkillUseCase } from '../../../../src/modules/skills/application/crud-skills.usecase.js';
import type { ISkillRepository } from '../../../../src/modules/skills/domain/skill.repository.js';
import type { InvestigationSkill } from '../../../../src/modules/skills/domain/skill.entity.js';
import { tenantId } from '../../../../src/shared/domain/value-objects.js';

function mockRepo(): ISkillRepository & { _store: InvestigationSkill[] } {
    const store: InvestigationSkill[] = [];
    return {
        _store: store,
        create: vi.fn(async (skill: InvestigationSkill) => { store.push(skill); return skill; }),
        findById: vi.fn(async (tid, id) => store.find(s => s.id === id && s.tenantId === tid) ?? null),
        findByTenant: vi.fn(async (tid) => store.filter(s => s.tenantId === tid)),
        update: vi.fn(async (tid, id, data) => {
            const idx = store.findIndex(s => s.id === id && s.tenantId === tid);
            if (idx === -1) throw new Error('Not found');
            store[idx] = { ...store[idx]!, ...data };
            return store[idx]!;
        }),
        delete: vi.fn(async (tid, id) => {
            const idx = store.findIndex(s => s.id === id && s.tenantId === tid);
            if (idx !== -1) store.splice(idx, 1);
        }),
    };
}

describe('CreateSkillUseCase', () => {
    it('creates a skill with defaults', async () => {
        const repo = mockRepo();
        const useCase = new CreateSkillUseCase(repo);
        const skill = await useCase.execute({
            tenantId: tenantId('t1'),
            name: 'k8s-crashloop',
            displayName: 'K8s CrashLoop',
            description: 'Investigates pod crash loops',
            whenToUse: 'When pods are CrashLoopBackOff',
            systemPrompt: 'You are a K8s specialist',
            allowedTools: ['query_logs'],
        });
        expect(skill.name).toBe('k8s-crashloop');
        expect(skill.isEnabled).toBe(true);
        expect(skill.maxTurns).toBe(5);
        expect(skill.minToolCalls).toBe(2);
        expect(skill.id).toBeDefined();
        expect(repo.create).toHaveBeenCalledOnce();
    });

    it('allows custom maxTurns and minToolCalls', async () => {
        const repo = mockRepo();
        const useCase = new CreateSkillUseCase(repo);
        const skill = await useCase.execute({
            tenantId: tenantId('t1'),
            name: 'custom',
            displayName: 'Custom',
            description: 'desc',
            whenToUse: 'when',
            systemPrompt: 'prompt',
            allowedTools: ['query_logs'],
            maxTurns: 10,
            minToolCalls: 5,
        });
        expect(skill.maxTurns).toBe(10);
        expect(skill.minToolCalls).toBe(5);
    });
});

describe('ListSkillsUseCase', () => {
    it('lists skills for tenant', async () => {
        const repo = mockRepo();
        const createUseCase = new CreateSkillUseCase(repo);
        await createUseCase.execute({
            tenantId: tenantId('t1'),
            name: 's1', displayName: 'S1', description: 'd', whenToUse: 'w',
            systemPrompt: 'p', allowedTools: ['query_logs'],
        });
        await createUseCase.execute({
            tenantId: tenantId('t1'),
            name: 's2', displayName: 'S2', description: 'd', whenToUse: 'w',
            systemPrompt: 'p', allowedTools: ['query_metrics'],
        });
        const listUseCase = new ListSkillsUseCase(repo);
        const skills = await listUseCase.execute(tenantId('t1'));
        expect(skills).toHaveLength(2);
    });
});

describe('DeleteSkillUseCase', () => {
    it('deletes a skill', async () => {
        const repo = mockRepo();
        const createUseCase = new CreateSkillUseCase(repo);
        const skill = await createUseCase.execute({
            tenantId: tenantId('t1'),
            name: 'doomed', displayName: 'Doomed', description: 'd', whenToUse: 'w',
            systemPrompt: 'p', allowedTools: ['query_logs'],
        });
        const deleteUseCase = new DeleteSkillUseCase(repo);
        await deleteUseCase.execute(tenantId('t1'), skill.id);
        expect(repo.delete).toHaveBeenCalledWith(tenantId('t1'), skill.id);
    });
});
