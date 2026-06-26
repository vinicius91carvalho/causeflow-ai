import type { Severity } from '../../domain/types.js';
export interface RawAlert {
    source: string;
    externalId: string;
    payload: Record<string, unknown>;
}
export interface NormalizedAlert {
    externalId: string;
    source: string;
    title: string;
    description: string;
    severity: Severity;
    service: string;
    environment: string;
    tags: Record<string, string>;
    rawPayload: Record<string, unknown>;
    receivedAt: string;
}
export interface AlertParser {
    readonly source: string;
    canParse(payload: Record<string, unknown>): boolean;
    parse(raw: RawAlert): NormalizedAlert;
}
