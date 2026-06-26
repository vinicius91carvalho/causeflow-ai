import type { InvestigationInput, InvestigationResult } from '../../domain/investigation.types.js';

/**
 * Pluggable investigation strategies. Each implementation represents a distinct
 * reasoning pattern (symptom-driven orchestrator, hypothesis-driven validator,
 * multi-agent debate, etc.) and produces the same InvestigationResult so the
 * rest of the system (persistence, streaming, UI) stays mode-agnostic.
 *
 * Guarantees a mode MUST respect:
 *  - Honor `input.channel` for progress/finding/evidence events.
 *  - Resolve with a populated InvestigationResult on success.
 *  - Throw on unrecoverable failure (the dispatcher records metrics and
 *    lets the error propagate to the caller).
 */
export interface InvestigationMode {
    /** Machine identifier used by the dispatcher and persisted on Incident. */
    readonly name: InvestigationModeName;
    /** Human-facing label for logs + admin UI. */
    readonly label: string;
    /** One-line description. Used by ops tooling / admin listings. */
    readonly description: string;
    run(input: InvestigationInput): Promise<InvestigationResult>;
}

export const INVESTIGATION_MODE_NAMES = ['orchestrator', 'hypothesis', 'debate'] as const;
export type InvestigationModeName = (typeof INVESTIGATION_MODE_NAMES)[number];

export const DEFAULT_INVESTIGATION_MODE: InvestigationModeName = 'orchestrator';

export function isInvestigationModeName(value: unknown): value is InvestigationModeName {
    return typeof value === 'string' && (INVESTIGATION_MODE_NAMES as readonly string[]).includes(value);
}
