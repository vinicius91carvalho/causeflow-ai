import type { TenantId } from './value-objects.js';

export interface RunbookEntry {
    tenantId: TenantId;
    rootCauseHash: string;
    rootCauseSummary: string;
    occurrences: number;
    confirmations: number;
    lastSeen: string;
    fixAction: string;
    fixDescription: string;
    automated: boolean;
    createdAt: string;
    updatedAt: string;
}

export function canAutoRemediate(entry: RunbookEntry, minOccurrences: number = 5): boolean {
    return entry.automated && entry.occurrences >= minOccurrences && entry.confirmations >= 1;
}
