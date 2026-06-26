import type { TenantId } from '../../../shared/domain/value-objects.js';

export type SkillId = string & { readonly __brand: 'SkillId' };
export function skillId(id: string): SkillId { return id as SkillId; }

export interface InvestigationSkill {
    id: SkillId;
    tenantId: TenantId;
    /** Unique name within tenant, e.g. "kubernetes-pod-crashloop" */
    name: string;
    /** Human-readable display name */
    displayName: string;
    /** Description of what this skill investigates */
    description: string;
    /** Condition for auto-selection by triage, e.g. "When incident involves OOMKilled or CrashLoopBackOff" */
    whenToUse: string;
    /** Static system prompt for the skill agent (cached via prompt caching) */
    systemPrompt: string;
    /** Subset of investigation tool names this skill can use */
    allowedTools: string[];
    /** Optional model override */
    model?: string;
    /** Max conversation turns. Default: 5 */
    maxTurns?: number;
    /** Minimum tool calls before concluding. Default: 2 */
    minToolCalls?: number;
    isEnabled: boolean;
    createdAt: string;
    updatedAt: string;
}
