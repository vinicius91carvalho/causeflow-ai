import { createHash } from 'node:crypto';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';
import type { AgentMemory } from '../../../shared/application/ports/agent-memory.port.js';
import type { IRunbookRegistryRepository } from '../../../shared/domain/runbook-registry.repository.js';
import type { RunbookEntry } from '../../../shared/domain/runbook-registry.entity.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
import { remediationId as toRemediationId } from '../../../shared/domain/value-objects.js';
import type { IRemediationRepository } from '../../remediation/domain/remediation.repository.js';
import type { ISkillRepository } from '../domain/skill.repository.js';
import type { SkillId } from '../domain/skill.entity.js';

export interface PinRunbookInput {
    tenantId: TenantId;
    skillId: SkillId;
    remediationId: string;
}

export interface PinRunbookResult {
    skillId: SkillId;
    remediationId: string;
    runbook: RunbookEntry;
}

/**
 * Pin a successful remediation to a tenant skill as a RunbookRegistryEntity,
 * and retain it in agent memory so a later similar incident surfaces it in
 * the orchestrator's recall results (AC-025).
 */
export class PinRunbookUseCase {
    constructor(
        private readonly skillRepo: ISkillRepository,
        private readonly remediationRepo: IRemediationRepository,
        private readonly runbookRegistry: IRunbookRegistryRepository,
        private readonly agentMemory?: AgentMemory,
    ) {}

    async execute(input: PinRunbookInput): Promise<PinRunbookResult> {
        const skill = await this.skillRepo.findById(input.tenantId, input.skillId);
        if (!skill) {
            throw new NotFoundError('Skill', input.skillId);
        }

        const remId = toRemediationId(input.remediationId);
        const remediation = await this.remediationRepo.findById(input.tenantId, remId);
        if (!remediation) {
            throw new NotFoundError('Remediation', input.remediationId);
        }
        if (remediation.status !== 'completed') {
            throw new ValidationError('Only a successful (completed) remediation can be pinned to a runbook', {
                status: remediation.status,
            });
        }

        const rootCause = remediation.rootCause?.trim() || remediation.description?.trim() || '';
        if (rootCause.length < 1) {
            throw new ValidationError('Remediation has no root cause to pin');
        }

        const normalized = rootCause.toLowerCase().trim();
        const hash = createHash('sha256').update(normalized).digest('hex').slice(0, 16);
        const now = new Date().toISOString();
        const firstStep = remediation.steps[0];
        const existing = await this.runbookRegistry.findByHash(input.tenantId, hash);

        const entry: RunbookEntry = {
            tenantId: input.tenantId,
            rootCauseHash: hash,
            rootCauseSummary: rootCause.slice(0, 500),
            occurrences: Math.max(existing?.occurrences ?? 0, 1),
            confirmations: Math.max(existing?.confirmations ?? 0, 1),
            lastSeen: now,
            fixAction: firstStep?.action ?? existing?.fixAction ?? '',
            fixDescription: firstStep?.description
                ?? remediation.description
                ?? existing?.fixDescription
                ?? '',
            automated: firstStep?.automated ?? existing?.automated ?? false,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
        };

        const runbook = await this.runbookRegistry.upsert(entry);

        const stepSummary = remediation.steps
            .map((s, i) => `${i + 1}. ${s.label || s.action}: ${s.description || ''}`.trim())
            .join('\n');
        const memoryContent =
            `Pinned runbook for skill "${skill.name}" (${skill.displayName}). ` +
            `Root cause: "${rootCause}". ` +
            `Remediation ${remediation.remediationId} for incident ${remediation.incidentId} succeeded. ` +
            `Fix actions:\n${stepSummary}`;

        if (this.agentMemory) {
            await this.agentMemory.retain(input.tenantId, memoryContent, {
                tags: ['investigation', 'remediation', 'runbook', `skill:${skill.name}`, `incident:${remediation.incidentId}`],
                context: `pinned-runbook:${skill.id}:${remediation.remediationId}`,
                metadata: {
                    skillId: skill.id,
                    remediationId: remediation.remediationId,
                    incidentId: remediation.incidentId,
                    rootCauseHash: hash,
                },
            });
        }

        // Keep the skill prompt aligned with the pinned remediation so skill
        // selection steers future investigations toward this runbook.
        const pinBlock =
            `\n\n--- Pinned runbook (remediation ${remediation.remediationId}) ---\n` +
            `Root cause: ${rootCause}\n` +
            `Steps:\n${stepSummary}\n`;
        if (!skill.systemPrompt.includes(remediation.remediationId)) {
            await this.skillRepo.update(input.tenantId, input.skillId, {
                systemPrompt: `${skill.systemPrompt}${pinBlock}`.slice(0, 10000),
                updatedAt: now,
            });
        }

        return {
            skillId: input.skillId,
            remediationId: remediation.remediationId,
            runbook,
        };
    }
}
