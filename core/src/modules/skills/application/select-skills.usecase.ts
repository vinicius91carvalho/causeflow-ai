import { z } from 'zod';
import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { LLMClient } from '../../../shared/application/ports/llm-client.port.js';
import type { ISkillRepository } from '../domain/skill.repository.js';
import type { InvestigationSkill } from '../domain/skill.entity.js';

const selectionSchema = z.object({
    selectedSkills: z.array(z.string()),
});

export interface SelectSkillsInput {
    tenantId: TenantId;
    incidentTitle: string;
    incidentDescription: string;
    severity: string;
    wave1Findings?: string;
    maxSkills?: number;
}

export class SelectSkillsUseCase {
    constructor(
        private readonly skillRepo: ISkillRepository,
        private readonly llmClient: LLMClient,
    ) {}

    async execute(input: SelectSkillsInput): Promise<InvestigationSkill[]> {
        const allSkills = await this.skillRepo.findByTenant(input.tenantId);
        const enabledSkills = allSkills.filter(s => s.isEnabled);
        if (enabledSkills.length === 0) return [];

        const maxSkills = input.maxSkills ?? 3;

        // If only 1-2 skills, skip LLM selection and use keyword matching
        if (enabledSkills.length <= maxSkills) {
            return enabledSkills;
        }

        // LLM-based selection (Haiku for speed and cost)
        const completion = await this.llmClient.complete({
            model: 'claude-haiku-4-5',
            systemPrompt: `You are a skill selector for SRE incident investigation. Given an incident and a list of available investigation skills, select the most relevant ones.

Rules:
- Select at most ${maxSkills} skills
- Only select skills whose "whenToUse" matches the incident context
- If no skills match, return an empty array
- Return ONLY a JSON object with selectedSkills array of skill names`,
            userPrompt: `Incident: ${input.incidentTitle}
Description: ${input.incidentDescription}
Severity: ${input.severity}
${input.wave1Findings ? `Wave 1 findings: ${input.wave1Findings}` : ''}

Available skills:
${enabledSkills.map(s => `- ${s.name}: ${s.whenToUse}`).join('\n')}`,
            maxTokens: 500,
            temperature: 0,
            responseSchema: selectionSchema,
        });

        const selected = (completion.content as z.infer<typeof selectionSchema>).selectedSkills;
        return enabledSkills
            .filter(s => selected.includes(s.name))
            .slice(0, maxSkills);
    }
}
