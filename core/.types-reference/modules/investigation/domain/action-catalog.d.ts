import type { RiskLevel } from './investigation.types.js';
export interface ActionDefinition {
    label: string;
    description: string;
    riskLevel: RiskLevel;
    estimatedDuration: string;
    requiresParams: string[];
}
export declare const ACTION_CATALOG: Record<string, ActionDefinition>;
export declare function buildAvailableActionsPrompt(): string;
