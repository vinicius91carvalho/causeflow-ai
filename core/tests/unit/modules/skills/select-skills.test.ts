import { describe, it, expect, vi } from 'vitest';
import { SelectSkillsUseCase } from '../../../../src/modules/skills/application/select-skills.usecase.js';
import type { ISkillRepository } from '../../../../src/modules/skills/domain/skill.repository.js';
import type { InvestigationSkill } from '../../../../src/modules/skills/domain/skill.entity.js';
import type { LLMClient } from '../../../../src/shared/application/ports/llm-client.port.js';
import { tenantId } from '../../../../src/shared/domain/value-objects.js';

function makeSkill(overrides: Partial<InvestigationSkill> = {}): InvestigationSkill {
    return {
        id: 'skill-1' as any,
        tenantId: tenantId('t1'),
        name: 'k8s-crashloop',
        displayName: 'Kubernetes CrashLoop',
        description: 'Investigates pod crash loops',
        whenToUse: 'When pods are in CrashLoopBackOff',
        systemPrompt: 'You are a k8s specialist...',
        allowedTools: ['query_logs', 'query_metrics'],
        isEnabled: true,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        ...overrides,
    };
}

function mockRepo(skills: InvestigationSkill[]): ISkillRepository {
    return {
        create: vi.fn(),
        findById: vi.fn(),
        findByTenant: vi.fn().mockResolvedValue(skills),
        update: vi.fn(),
        delete: vi.fn(),
    };
}

function mockLLM(selectedSkills: string[]): LLMClient {
    return {
        complete: vi.fn().mockResolvedValue({
            content: { selectedSkills },
            costUsd: 0.001,
        }),
    } as unknown as LLMClient;
}

describe('SelectSkillsUseCase', () => {
    it('returns empty if tenant has no skills', async () => {
        const useCase = new SelectSkillsUseCase(mockRepo([]), mockLLM([]));
        const result = await useCase.execute({
            tenantId: tenantId('t1'),
            incidentTitle: 'OOM Kill',
            incidentDescription: 'Pod killed',
            severity: 'high',
        });
        expect(result).toEqual([]);
    });

    it('returns all enabled skills if count <= maxSkills (skips LLM)', async () => {
        const skills = [makeSkill({ name: 's1' }), makeSkill({ name: 's2' })];
        const llm = mockLLM([]);
        const useCase = new SelectSkillsUseCase(mockRepo(skills), llm);
        const result = await useCase.execute({
            tenantId: tenantId('t1'),
            incidentTitle: 'OOM',
            incidentDescription: 'desc',
            severity: 'high',
            maxSkills: 3,
        });
        expect(result).toHaveLength(2);
        // LLM should NOT be called when skill count <= maxSkills
        expect(llm.complete).not.toHaveBeenCalled();
    });

    it('filters disabled skills', async () => {
        const skills = [
            makeSkill({ name: 'enabled', isEnabled: true }),
            makeSkill({ name: 'disabled', isEnabled: false }),
        ];
        const useCase = new SelectSkillsUseCase(mockRepo(skills), mockLLM([]));
        const result = await useCase.execute({
            tenantId: tenantId('t1'),
            incidentTitle: 'test',
            incidentDescription: 'test',
            severity: 'low',
        });
        expect(result).toHaveLength(1);
        expect(result[0]!.name).toBe('enabled');
    });

    it('uses LLM to select when more skills than maxSkills', async () => {
        const skills = [
            makeSkill({ name: 'k8s', whenToUse: 'Kubernetes issues' }),
            makeSkill({ name: 'db', whenToUse: 'Database issues' }),
            makeSkill({ name: 'network', whenToUse: 'Network issues' }),
            makeSkill({ name: 'memory', whenToUse: 'Memory issues' }),
        ];
        const llm = mockLLM(['k8s', 'memory']);
        const useCase = new SelectSkillsUseCase(mockRepo(skills), llm);
        const result = await useCase.execute({
            tenantId: tenantId('t1'),
            incidentTitle: 'OOM Kill in K8s pod',
            incidentDescription: 'Pod CrashLoopBackOff with OOM',
            severity: 'critical',
            maxSkills: 2,
        });
        expect(result).toHaveLength(2);
        expect(result.map(s => s.name).sort()).toEqual(['k8s', 'memory']);
        expect(llm.complete).toHaveBeenCalledOnce();
    });

    it('respects maxSkills limit even when LLM returns more', async () => {
        const skills = [
            makeSkill({ name: 'a' }),
            makeSkill({ name: 'b' }),
            makeSkill({ name: 'c' }),
            makeSkill({ name: 'd' }),
        ];
        const llm = mockLLM(['a', 'b', 'c']); // returns 3
        const useCase = new SelectSkillsUseCase(mockRepo(skills), llm);
        const result = await useCase.execute({
            tenantId: tenantId('t1'),
            incidentTitle: 'test',
            incidentDescription: 'test',
            severity: 'low',
            maxSkills: 2, // but max is 2
        });
        expect(result).toHaveLength(2);
    });
});
