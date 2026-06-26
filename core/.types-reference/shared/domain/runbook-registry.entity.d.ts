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
export declare function canAutoRemediate(entry: RunbookEntry, minOccurrences?: number): boolean;
