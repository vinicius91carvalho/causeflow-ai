import { z } from 'zod';
export declare const triageResultSchema: z.ZodObject<{
    priority: z.ZodEnum<["critical", "high", "medium", "low", "info"]>;
    category: z.ZodEnum<["infrastructure", "application", "deployment", "third_party", "database", "unknown"]>;
    suggestedAgents: z.ZodArray<z.ZodString, "many">;
    summary: z.ZodString;
    confidence: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    confidence: number;
    suggestedAgents: string[];
    priority: "info" | "high" | "critical" | "medium" | "low";
    category: "database" | "deployment" | "unknown" | "infrastructure" | "application" | "third_party";
    summary: string;
}, {
    confidence: number;
    suggestedAgents: string[];
    priority: "info" | "high" | "critical" | "medium" | "low";
    category: "database" | "deployment" | "unknown" | "infrastructure" | "application" | "third_party";
    summary: string;
}>;
/**
 * Build a triage system prompt that includes available integrations and agents.
 * When connectedIntegrations is empty, falls back to the default agent list.
 */
export declare function buildTriagePrompt(connectedIntegrations: string[]): string;
/** @deprecated Use buildTriagePrompt() instead. Kept for backward compatibility. */
export declare const TRIAGE_SYSTEM_PROMPT: string;
